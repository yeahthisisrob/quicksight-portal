/**
 * The conversation, kept across reloads: sends a message, waits for the
 * answer while saying what the assistant is doing, and picks a pending
 * answer back up after a reload. Action runs are recorded here so their
 * cards resume following a job too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { assistantApi } from '@/shared/api';
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
} from './conversation';

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export interface ConversationState {
  conversation: Conversation;
  /** What the assistant said it is doing, while it works. */
  status: string | null;
  error: string | null;
  busy: boolean;
  ask: (text: string) => void;
  retry: () => void;
  recordRun: (actionId: string, run: ActionRun) => void;
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
        const jobId = await assistantApi.send({
          messages: historyOf(next),
          model: chatModel,
          authoringModel,
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

  /** Send the same history again, after an error. */
  const retry = useCallback(() => {
    if (!busy && conversation.entries[conversation.entries.length - 1]?.role === 'user') {
      void send(conversation);
    }
  }, [busy, conversation, send]);

  const recordRun = useCallback((actionId: string, run: ActionRun) => {
    setConversation((c) => withRun(c, actionId, run));
  }, []);

  const reset = useCallback(() => {
    waiting.current = null;
    setStatus(null);
    setError(null);
    setConversation(EMPTY_CONVERSATION);
  }, []);

  return { conversation, status, error, busy, ask, retry, recordRun, reset };
}
