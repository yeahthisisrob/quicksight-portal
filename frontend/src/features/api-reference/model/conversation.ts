/**
 * The assistant conversation as it is kept in the person's browser, so a
 * reload loses nothing: the transcript, the answer still being worked on
 * (its job id, so the wait resumes), and what happened to each action the
 * assistant prepared (so a running job is followed again). Pure: the hook
 * holds it, these functions change it, storage is injected.
 */
import type { AssistantChatResult } from '@/shared/api/modules/assistant';

export type ConversationEntry =
  | { role: 'user'; text: string }
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

export function withQuestion(c: Conversation, text: string): Conversation {
  return { ...c, entries: trimmed([...c.entries, { role: 'user', text }]) };
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

/** How much of an action's result goes back to the assistant with the history. */
export const MAX_RUN_RESULT_CHARS = 1_500;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * What the person ran from one answer, as a line the assistant reads with
 * the history: without it the assistant cannot know an action ran, and
 * prepares it again.
 */
export function runsNote(result: AssistantChatResult, runs: Record<string, ActionRun>): string {
  const lines = result.actions.flatMap((action) => {
    const run = runs[action.id];
    if (!run) {
      return [];
    }
    const outcome =
      run.status === 'running'
        ? `still running${run.jobId ? ` (job ${run.jobId})` : ''}`
        : run.status === 'failed'
          ? `failed: ${run.error ?? run.message ?? 'no reason given'}`
          : 'done';
    const detail =
      run.result === undefined
        ? ''
        : ` Result: ${clip(JSON.stringify(run.result), MAX_RUN_RESULT_CHARS)}`;
    return [`- "${action.title}" (${action.method} ${action.path}): ${outcome}.${detail}`];
  });
  return lines.length ? `[The person ran, after this answer:\n${lines.join('\n')}]` : '';
}

/** The history the assistant is sent: text, with what the person ran after each answer. */
export function historyOf(c: Conversation): Array<{ role: 'user' | 'assistant'; text: string }> {
  return c.entries.map((e) => {
    if (e.role === 'user') {
      return { role: e.role, text: e.text };
    }
    const note = runsNote(e.result, c.runs);
    return { role: e.role, text: note ? `${e.text}\n\n${note}` : e.text };
  });
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
