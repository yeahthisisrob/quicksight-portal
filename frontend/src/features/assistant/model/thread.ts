/**
 * The conversation as assistant-ui messages. Each answer becomes the parts
 * a model message is made of: the reply as a text part, and a tool call for
 * everything it drew or asked, which the thread renders with the tool UIs
 * registered for these names. What happened since (an action run, an
 * answered question) is the tool call's result, so the thread shows it
 * where it belongs; a tool UI reports new results through `addResult`,
 * which the runtime hands back to the conversation (`resultTarget`).
 * Pure: the chat derives the thread from the conversation on every change.
 */
import type { ThreadMessageLike } from '@assistant-ui/react';

import type {
  AgUiInterrupt,
  AgUiResumeEntry,
  AssistantAction,
  AssistantArtifact,
  AssistantChatResult,
} from '@/shared/api/modules/assistant';

import { type ActionRun, answerTo, type Conversation } from './conversation';

/** The tool names the thread's parts use; the tool UIs register under these. */
export const TOOL = {
  /** A preview of what a change would publish, or an asset as it is: a wireframe. */
  wireframe: 'show_wireframe',
  /** A calculated field's lineage. */
  lineage: 'show_lineage',
  /** What a change will build, from the sources to the asset. */
  plan: 'show_plan',
  /** Where each calculated field the change adds belongs. */
  fields: 'show_field_verdicts',
  /** A write prepared for the person to run. */
  action: 'prepare_action',
  /** A question the run paused on (an AG-UI input_required interrupt). */
  question: 'ask_person',
} as const;

export interface ArtifactArgs {
  artifact: AssistantArtifact;
  [key: string]: unknown;
}

export interface ActionArgs {
  action: AssistantAction;
  /** The preview this action publishes, drawn inside its card until it runs. */
  preview?: AssistantArtifact;
  [key: string]: unknown;
}

export interface QuestionArgs {
  interrupt: AgUiInterrupt;
  [key: string]: unknown;
}

/** What the thread shows under each answer, from the answer itself. */
export interface AnswerMeta {
  model: AssistantChatResult['model'];
  cost: number;
  usage: AssistantChatResult['usage'];
  calls: AssistantChatResult['calls'];
  helpers: NonNullable<AssistantChatResult['helpers']>;
}

/** The questions an answer asked (AG-UI input_required interrupts). */
function questionsOf(result: AssistantChatResult): AgUiInterrupt[] {
  return result.outcome?.type === 'interrupt'
    ? (result.outcome.interrupts ?? []).filter((i) => i.reason === 'input_required')
    : [];
}

/** The reply as prose; empty when it only repeats the question drawn as a card. */
function replyText(result: AssistantChatResult): string {
  return questionsOf(result).some((q) => q.message?.trim() === result.reply.trim())
    ? ''
    : result.reply;
}

type Part = Exclude<ThreadMessageLike['content'], string>[number];

const ARTIFACT_TOOL: Record<AssistantArtifact['kind'], string> = {
  preview: TOOL.wireframe,
  asset: TOOL.wireframe,
  lineage: TOOL.lineage,
  plan: TOOL.plan,
  fields: TOOL.fields,
};

/** Tool-call ids are unique per thread: the message id, then the id the answer gave. */
const SEPARATOR = ':';
const callId = (messageId: string, id: string) => `${messageId}${SEPARATOR}${id}`;

function actionPart(
  messageId: string,
  action: AssistantAction,
  preview: AssistantArtifact | undefined,
  run: ActionRun | undefined
): Part {
  const args: ActionArgs = { action, ...(preview ? { preview } : {}) };
  return {
    type: 'tool-call',
    toolCallId: callId(messageId, action.id),
    toolName: TOOL.action,
    args: args as never,
    ...(run ? { result: run } : {}),
  };
}

/**
 * One answer's parts, in reading order: the reply; each thing it drew, with
 * the actions that carry out a plan right under that plan; actions tied to
 * no plan; then the questions it stopped on.
 */
function answerParts(messageId: string, result: AssistantChatResult, c: Conversation): Part[] {
  const parts: Part[] = [];
  const text = replyText(result);
  if (text) parts.push({ type: 'text', text });

  const previewed = new Set(result.actions.map((a) => a.previewId).filter(Boolean));
  const placed = new Set<string>();
  const previewFor = (action: AssistantAction) =>
    result.artifacts.find((a) => a.id === action.previewId);

  for (const artifact of result.artifacts) {
    if (previewed.has(artifact.id)) continue;
    const args: ArtifactArgs = { artifact };
    parts.push({
      type: 'tool-call',
      toolCallId: callId(messageId, artifact.id),
      toolName: ARTIFACT_TOOL[artifact.kind],
      args: args as never,
      result: 'shown',
    });
    if (artifact.kind === 'plan') {
      for (const action of result.actions.filter((a) => a.planId === artifact.id)) {
        placed.add(action.id);
        parts.push(actionPart(messageId, action, previewFor(action), c.runs[action.id]));
      }
    }
  }
  for (const action of result.actions.filter((a) => !placed.has(a.id))) {
    parts.push(actionPart(messageId, action, previewFor(action), c.runs[action.id]));
  }
  for (const interrupt of questionsOf(result)) {
    const args: QuestionArgs = { interrupt };
    const answer = answerTo(c, interrupt.id);
    parts.push({
      type: 'tool-call',
      toolCallId: callId(messageId, interrupt.id),
      toolName: TOOL.question,
      args: args as never,
      ...(answer ? { result: answer } : {}),
    });
  }
  return parts;
}

/** The whole conversation as the thread's messages. */
export function threadOf(c: Conversation): ThreadMessageLike[] {
  return c.entries.map((entry, index): ThreadMessageLike => {
    if (entry.role === 'user') {
      return { id: `u${index}`, role: 'user', content: entry.text };
    }
    const id = `a${index}`;
    const { result } = entry;
    const meta: AnswerMeta = {
      model: result.model,
      cost: result.cost,
      usage: result.usage,
      calls: result.calls,
      helpers: result.helpers ?? [],
    };
    return {
      id,
      role: 'assistant',
      content: answerParts(id, result, c),
      status: { type: 'complete', reason: 'stop' },
      metadata: { custom: { answer: meta } },
    };
  });
}

/** The answer metadata a thread message carries, if it is an answer. */
export function answerMetaOf(custom: Record<string, unknown> | undefined): AnswerMeta | undefined {
  return custom?.answer as AnswerMeta | undefined;
}

/** A tool result reported from the thread, as the conversation records it. */
export type ResultTarget =
  | { kind: 'run'; actionId: string; run: ActionRun }
  | { kind: 'answer'; interrupt: AgUiInterrupt; selected: string[]; other?: string }
  | { kind: 'none' };

/** Where a result a tool UI reported (`addResult`) goes in the conversation. */
export function resultTarget(
  c: Conversation,
  toolName: string,
  toolCallId: string,
  result: unknown
): ResultTarget {
  const id = toolCallId.slice(toolCallId.indexOf(SEPARATOR) + 1);
  if (toolName === TOOL.action) {
    return { kind: 'run', actionId: id, run: result as ActionRun };
  }
  if (toolName === TOOL.question) {
    const interrupt = interruptOf(c, id);
    const payload = ((result as AgUiResumeEntry | undefined)?.payload ?? {}) as {
      selected?: string[];
      other?: string;
    };
    return interrupt
      ? {
          kind: 'answer',
          interrupt,
          selected: payload.selected ?? [],
          ...(payload.other ? { other: payload.other } : {}),
        }
      : { kind: 'none' };
  }
  return { kind: 'none' };
}

function interruptOf(c: Conversation, id: string): AgUiInterrupt | undefined {
  for (const e of c.entries) {
    if (e.role === 'assistant') {
      const found = questionsOf(e.result).find((i) => i.id === id);
      if (found) return found;
    }
  }
  return undefined;
}
