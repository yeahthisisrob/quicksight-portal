import type { AiModelKey } from '../../../shared/ai/modelCatalog';

/** One line of the conversation as the client keeps it: text only. */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantChatRequest {
  messages: ChatHistoryMessage[];
  model?: AiModelKey;
  /** The model the planner uses when the assistant asks it to propose. */
  authoringModel?: AiModelKey;
}

/** A call the assistant made itself (reads and previews). */
export interface AssistantCall {
  method: string;
  path: string;
  status: number;
  ok: boolean;
}

/**
 * Something to show the person, by reference: the page fetches or re-runs
 * it and draws it, so a whole definition never rides in the job result.
 * - preview: a read-only preview call; drawn as a wireframe of what it
 *   would publish, with its warnings.
 * - asset: an existing dashboard or analysis, drawn as it is now.
 * - lineage: a calculated field's lineage, both ways.
 */
export type AssistantArtifact =
  | { id: string; kind: 'preview'; title: string; method: 'POST'; path: string; body?: unknown }
  | {
      id: string;
      kind: 'asset';
      title: string;
      assetType: 'dashboard' | 'analysis';
      assetId: string;
    }
  | { id: string; kind: 'lineage'; title: string; fieldKey: string };

/** A write the assistant prepared; the person runs it, under their own session. */
export interface AssistantAction {
  id: string;
  title: string;
  why: string;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** The preview this action publishes, to confirm against before running. */
  previewId?: string;
}

export interface AssistantChatResult {
  reply: string;
  calls: AssistantCall[];
  actions: AssistantAction[];
  artifacts: AssistantArtifact[];
  model: { key: AiModelKey; label: string; modelId: string };
  usage: { inputTokens: number; outputTokens: number };
  /** Dollars at list price; a rough guide. */
  cost: number;
  rounds: number;
}
