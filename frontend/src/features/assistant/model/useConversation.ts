/**
 * The conversation, kept across reloads: sends a message, waits for the
 * answer while saying what the assistant is doing, and picks a pending
 * answer back up after a reload. Action runs are recorded here so their
 * cards resume following a job too.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { assistantApi } from '@/shared/api';
import type { AgUiInterrupt } from '@/shared/api/modules/assistant';
import { useAiModel } from '@/shared/lib';

import {
  type ActionRun,
  type Conversation,
  EMPTY_CONVERSATION,
  historyOf,
  loadConversation,
  saveConversation,
  withAnswer,
  withoutPending,
  withPending,
  withQuestion,
  withRun,
  workingStateOf,
} from './conversation';

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

interface ConversationState {
  conversation: Conversation;
  /** What the assistant said it is doing, while it works. */
  status: string | null;
  error: string | null;
  busy: boolean;
  ask: (text: string) => void;
  /** Answer the question the last answer asked. */
  answer: (interrupt: AgUiInterrupt, selected: string[], other?: string) => void;
  retry: () => void;
  recordRun: (actionId: string, run: ActionRun) => void;
  /** Stop waiting for the answer in flight. */
  cancel: () => void;
  reset: () => void;
}

export function useConversation(): ConversationState {
  const [chatModel] = useAiModel('chat');
  const [authoringModel] = useAiModel('authoring');
  const [conversation, setConversation] = useState<Conversation>(() =>
    loadConversation(browserStorage())
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waiting = useRef<string | null>(null);

  useEffect(() => {
    saveConversation(browserStorage(), conversation);
  }, [conversation]);

  const wait = useCallback((jobId: string) => {
    if (waiting.current === jobId) {
      return;
    }
    waiting.current = jobId;
    setError(null);
    setStatus('Thinking');
    assistantApi
      .waitForAnswer(jobId, (job) => {
        if (waiting.current === jobId && job.message) {
          setStatus(job.message);
        }
      })
      .then((result) => {
        if (waiting.current === jobId) {
          setConversation((c) => withAnswer(c, result));
        }
      })
      .catch((e: unknown) => {
        if (waiting.current === jobId) {
          setConversation((c) => withoutPending(c));
          setError(e instanceof Error ? e.message : 'The assistant did not answer');
        }
      })
      .finally(() => {
        if (waiting.current === jobId) {
          waiting.current = null;
          setStatus(null);
        }
      });
  }, []);

  // A reload mid-answer: carry on waiting for the same job.
  useEffect(() => {
    if (conversation.pending && waiting.current !== conversation.pending.jobId) {
      wait(conversation.pending.jobId);
    }
  }, [conversation.pending, wait]);

  const send = useCallback(
    async (next: Conversation) => {
      setError(null);
      setStatus('Sending');
      try {
        const last = next.entries[next.entries.length - 1];
        const jobId = await assistantApi.send({
          messages: historyOf(next),
          model: chatModel,
          authoringModel,
          ...(next.threadId ? { threadId: next.threadId } : {}),
          state: workingStateOf(next),
          ...(last?.role === 'user' && last.resume?.length ? { resume: last.resume } : {}),
        });
        setConversation((c) => withPending(c, jobId, Date.now()));
      } catch (e) {
        setStatus(null);
        setError(e instanceof Error ? e.message : 'The message could not be sent');
      }
    },
    [chatModel, authoringModel]
  );

  const busy = Boolean(conversation.pending) || status === 'Sending';

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) {
        return;
      }
      const next = withQuestion(conversation, trimmed);
      setConversation(next);
      void send(next);
    },
    [conversation, busy, send]
  );

  /**
   * Answer a question the last answer asked (an AG-UI interrupt): the chosen
   * labels become the person's message, and the ids go back as a resume
   * entry the next run carries on from.
   */
  const answer = useCallback(
    (interrupt: AgUiInterrupt, selected: string[], other?: string) => {
      if (busy) {
        return;
      }
      const options = interrupt.metadata?.options ?? [];
      const labels = selected.map((id) => options.find((o) => o.id === id)?.label ?? id);
      const typed = other?.trim();
      const text = [...labels, ...(typed ? [typed] : [])].join(', ') || 'None of these';
      const next = withQuestion(conversation, text, [
        {
          interruptId: interrupt.id,
          status: 'resolved',
          payload: { selected, ...(typed ? { other: typed } : {}) },
        },
      ]);
      setConversation(next);
      void send(next);
    },
    [conversation, busy, send]
  );

  /** Send the same history again, after an error. */
  const retry = useCallback(() => {
    if (!busy && conversation.entries[conversation.entries.length - 1]?.role === 'user') {
      void send(conversation);
    }
  }, [busy, conversation, send]);

  const recordRun = useCallback((actionId: string, run: ActionRun) => {
    setConversation((c) => withRun(c, actionId, run));
  }, []);

  /**
   * Stop waiting for the answer being worked on. The job finishes on the
   * server regardless; its answer is simply not added, and the question
   * stays so it can be asked again.
   */
  const cancel = useCallback(() => {
    waiting.current = null;
    setStatus(null);
    setConversation((c) => withoutPending(c));
  }, []);

  const reset = useCallback(() => {
    waiting.current = null;
    setStatus(null);
    setError(null);
    setConversation(EMPTY_CONVERSATION);
  }, []);

  return { conversation, status, error, busy, ask, answer, retry, recordRun, cancel, reset };
}
