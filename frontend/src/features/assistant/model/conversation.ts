/**
 * The assistant conversation as it is kept in the person's browser, so a
 * reload loses nothing: the transcript, the answer still being worked on
 * (its job id, so the wait resumes), and what happened to each action the
 * assistant prepared (so a running job is followed again). Pure: the hook
 * holds it, these functions change it, storage is injected.
 */
import type {
  AgUiResumeEntry,
  AssistantChatResult,
  AssistantWorkingState,
} from '@/shared/api/modules/assistant';

export type ConversationEntry =
  /** `resume`: this message answers the previous answer's question (AG-UI resume). */
  | { role: 'user'; text: string; resume?: AgUiResumeEntry[] }
  | { role: 'assistant'; text: string; result: AssistantChatResult };

export type ActionRunStatus = 'running' | 'completed' | 'failed';

export interface ActionRun {
  status: ActionRunStatus;
  /** Set when the action queued a job, which is then followed. */
  jobId?: string;
  message?: string;
  /** What the action or its job returned, for showing and for the follow-up. */
  result?: unknown;
  error?: string;
}

export interface Conversation {
  version: 1;
  /** The AG-UI thread; one per conversation, kept across reloads. */
  threadId?: string;
  entries: ConversationEntry[];
  /** The answer being worked on, and since when (ms). */
  pending?: { jobId: string; since: number };
  runs: Record<string, ActionRun>;
}

export const EMPTY_CONVERSATION: Conversation = { version: 1, entries: [], runs: {} };

export const CONVERSATION_KEY = 'qsp.assistant.conversation.v1';
/** Long conversations cost more per message and more storage; keep the recent ones. */
export const MAX_ENTRIES = 60;
/** What the follow-up hands back to the assistant from a finished job. */
export const MAX_FOLLOW_UP_CHARS = 4_000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadConversation(storage: StorageLike | undefined): Conversation {
  try {
    const raw = storage?.getItem(CONVERSATION_KEY);
    if (!raw) {
      return EMPTY_CONVERSATION;
    }
    const parsed = JSON.parse(raw) as Conversation;
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) {
      return EMPTY_CONVERSATION;
    }
    return { ...EMPTY_CONVERSATION, ...parsed, runs: parsed.runs ?? {} };
  } catch {
    return EMPTY_CONVERSATION;
  }
}

export function saveConversation(
  storage: StorageLike | undefined,
  conversation: Conversation
): void {
  try {
    if (conversation.entries.length === 0 && !conversation.pending) {
      storage?.removeItem(CONVERSATION_KEY);
      return;
    }
    storage?.setItem(CONVERSATION_KEY, JSON.stringify(conversation));
  } catch {
    // Full or blocked storage: the conversation lasts this page view.
  }
}

function trimmed(entries: ConversationEntry[]): ConversationEntry[] {
  return entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
}

export function withQuestion(
  c: Conversation,
  text: string,
  resume?: AgUiResumeEntry[]
): Conversation {
  return {
    ...c,
    threadId: c.threadId ?? newThreadId(),
    entries: trimmed([...c.entries, { role: 'user', text, ...(resume?.length ? { resume } : {}) }]),
  };
}

function newThreadId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function withPending(c: Conversation, jobId: string, since: number): Conversation {
  return { ...c, pending: { jobId, since } };
}

export function withAnswer(c: Conversation, result: AssistantChatResult): Conversation {
  const { pending: _done, ...rest } = c;
  return {
    ...rest,
    entries: trimmed([...c.entries, { role: 'assistant', text: result.reply, result }]),
  };
}

export function withoutPending(c: Conversation): Conversation {
  const { pending: _dropped, ...rest } = c;
  return rest;
}

export function withRun(c: Conversation, actionId: string, run: ActionRun): Conversation {
  return { ...c, runs: { ...c.runs, [actionId]: run } };
}

/** The history the assistant is sent: text only. State and answers travel as data. */
export function historyOf(c: Conversation): Array<{ role: 'user' | 'assistant'; text: string }> {
  return c.entries.map((e) => ({ role: e.role, text: e.text }));
}

/**
 * The page's working state (AG-UI state), sent with every message: the
 * latest answer's actions that were not run are the working draft (earlier
 * unrun ones were superseded), and every action that ran is reported with
 * its result, most recent last.
 */
export function workingStateOf(c: Conversation): AssistantWorkingState {
  const answers = c.entries.filter(
    (e): e is Extract<ConversationEntry, { role: 'assistant' }> => e.role === 'assistant'
  );
  const latest = answers[answers.length - 1];
  const drafts = (latest?.result.actions ?? [])
    .filter((a) => !c.runs[a.id])
    .map((a) => ({
      title: a.title,
      method: a.method,
      path: a.path,
      ...(a.body !== undefined ? { body: a.body } : {}),
    }));
  const ran = answers.flatMap((e) =>
    e.result.actions.flatMap((a) => {
      const run = c.runs[a.id];
      if (!run) return [];
      return [
        {
          title: a.title,
          method: a.method,
          path: a.path,
          status: run.status === 'completed' ? ('done' as const) : run.status,
          ...(run.result !== undefined ? { result: run.result } : {}),
          ...(run.error ? { error: run.error } : {}),
          ...(run.jobId ? { jobId: run.jobId } : {}),
        },
      ];
    })
  );
  return { drafts, ran: ran.slice(-MAX_RAN) };
}

const MAX_RAN = 20;

/** The answer a later message gave to one of this answer's questions, if any. */
export function answerTo(c: Conversation, interruptId: string): AgUiResumeEntry | undefined {
  for (const e of c.entries) {
    if (e.role === 'user') {
      const found = e.resume?.find((r) => r.interruptId === interruptId);
      if (found) return found;
    }
  }
  return undefined;
}

/** What a finished action created, when it created an asset. */
export function createdAsset(
  result: unknown
): { assetType: 'dashboard' | 'analysis'; assetId: string; name?: string } | undefined {
  const r = result as { assetType?: unknown; assetId?: unknown; name?: unknown } | null;
  if (
    (r?.assetType === 'dashboard' || r?.assetType === 'analysis') &&
    typeof r.assetId === 'string'
  ) {
    return {
      assetType: r.assetType,
      assetId: r.assetId,
      ...(typeof r.name === 'string' ? { name: r.name } : {}),
    };
  }
  return undefined;
}

/** The job id an action's response carries, whichever envelope it came in. */
export function jobIdOf(response: unknown): string | undefined {
  const r = response as { jobId?: unknown; data?: { jobId?: unknown } } | null;
  const id = r?.jobId ?? r?.data?.jobId;
  return typeof id === 'string' && id ? id : undefined;
}

/**
 * An answer that ends by announcing more work. The server pushes the model
 * once to do it; if the answer still ends that way the chat offers to
 * continue, so it never looks busy when nothing is running. Mirrors
 * `announcesMore` in the backend's AssistantService.
 */
const ANNOUNCES_MORE =
  /\b(let me(?! know)|i'll|i will|i am going to|i'm going to|next,? i|now i'll|i'll now|going to (check|try|look|run))\b[^.?!]*[.…:]?\s*$/i;
const ASKS_TO_PROCEED =
  /\b(shall i|should i|want me to|would you like me to|do you want me to|ready for me to|can i go ahead|may i)\b[^?]*\?\s*$/i;

export function endsOnAPromise(text: string): boolean {
  const lastSentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(-2)
    .join(' ');
  return ANNOUNCES_MORE.test(lastSentences) || ASKS_TO_PROCEED.test(lastSentences);
}

export const CONTINUE_MESSAGE = 'Go ahead and do that now.';

/** A finished action, told back to the assistant so it can carry on. */
export function followUpFor(title: string, run: ActionRun): string {
  const outcome =
    run.status === 'failed'
      ? `failed: ${run.error ?? run.message ?? 'no reason given'}`
      : 'finished';
  const detail = run.result === undefined ? '' : JSON.stringify(run.result);
  const clipped =
    detail.length > MAX_FOLLOW_UP_CHARS ? `${detail.slice(0, MAX_FOLLOW_UP_CHARS)}…` : detail;
  return `"${title}" ${outcome}.${clipped ? ` Result: ${clipped}` : ''} What next?`;
}
