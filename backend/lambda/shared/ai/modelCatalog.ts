/**
 * The models a person can pick for authoring and for the assistant chat,
 * with what each costs and what each accepts. Five on purpose: a cheap
 * one for conversation, the proven default, a newer and cheaper Sonnet, an
 * Opus for the hardest asks, and OpenAI for whoever has a key there.
 * Claude Fable is left out: at $10 / $50 per million tokens it costs
 * twice an Opus for work that does not need it.
 *
 * Prices are Anthropic and OpenAI list prices per million tokens. Bedrock
 * bills Claude at its own (usually equal) rates, so every figure derived
 * from these is a rough guide, not a quote.
 *
 * Capabilities matter because the newer Claude models changed the request
 * surface: Sonnet 5 and Opus 5 reject sampling parameters (`temperature`),
 * and with their always-on thinking a forced tool call is refused, so the
 * structured answer is asked for with `auto` tool choice and an
 * instruction instead.
 */

export type AiModelKey = 'haiku-4-5' | 'sonnet-4-6' | 'sonnet-5' | 'opus-5' | 'openai';
export type AiProvider = 'bedrock' | 'openai';

export interface AiModelCapabilities {
  /** Accepts `temperature`. */
  temperature: boolean;
  /** Accepts a forced tool choice (answer by calling exactly this tool). */
  forcedTool: boolean;
  /** Accepts Bedrock `cachePoint` blocks (prompt caching). */
  promptCache: boolean;
  /** OpenAI's newer models take `max_completion_tokens`. */
  maxTokensParam?: 'max_tokens' | 'max_completion_tokens';
}

export interface AiModel {
  key: AiModelKey;
  label: string;
  provider: AiProvider;
  /** Bedrock: a cross-region inference profile. OpenAI: the model name (overridable). */
  modelId: string;
  /** Dollars per million tokens. */
  price: { input: number; output: number };
  /** One line on when to pick it. */
  bestFor: string;
  capabilities: AiModelCapabilities;
  /** Thinks before it answers, so a typical ask writes more tokens. */
  thinks: boolean;
}

const CLAUDE_46_AND_OLDER: AiModelCapabilities = {
  temperature: true,
  forcedTool: true,
  promptCache: true,
};
const CLAUDE_5: AiModelCapabilities = { temperature: false, forcedTool: false, promptCache: true };

export const AI_MODELS: readonly AiModel[] = [
  {
    key: 'haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'bedrock',
    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    price: { input: 1, output: 5 },
    bestFor: 'Conversation and quick lookups. The cheapest; the chat default.',
    capabilities: CLAUDE_46_AND_OLDER,
    thinks: false,
  },
  {
    key: 'sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'bedrock',
    modelId: 'us.anthropic.claude-sonnet-4-6',
    price: { input: 3, output: 15 },
    bestFor: 'Authoring: rebinds, column mapping, visuals from an ask. The proven default.',
    capabilities: CLAUDE_46_AND_OLDER,
    thinks: false,
  },
  {
    key: 'sonnet-5',
    label: 'Claude Sonnet 5',
    provider: 'bedrock',
    modelId: 'us.anthropic.claude-sonnet-5',
    price: { input: 2, output: 10 },
    bestFor: 'Newer and cheaper per token than 4.6, and thinks before it answers.',
    capabilities: CLAUDE_5,
    thinks: true,
  },
  {
    key: 'opus-5',
    label: 'Claude Opus 5',
    provider: 'bedrock',
    modelId: 'us.anthropic.claude-opus-5',
    price: { input: 5, output: 25 },
    bestFor: 'The hardest asks: many datasets, messy column names, big definitions.',
    capabilities: CLAUDE_5,
    thinks: true,
  },
  {
    key: 'openai',
    label: 'OpenAI',
    provider: 'openai',
    modelId: 'gpt-5',
    price: { input: 1.25, output: 10 },
    bestFor: 'For teams on OpenAI. Needs PLANNER_BASE_URL and PLANNER_API_KEY on the stack.',
    capabilities: {
      temperature: false,
      forcedTool: false,
      promptCache: false,
      maxTokensParam: 'max_completion_tokens',
    },
    thinks: true,
  },
];

const TOKENS_PER_PRICE_UNIT = 1_000_000;

export const DEFAULT_AUTHORING_MODEL: AiModelKey = 'sonnet-4-6';
export const DEFAULT_CHAT_MODEL: AiModelKey = 'haiku-4-5';

/** Token shapes of a typical call, for the estimates shown beside each model. */
const TYPICAL = {
  /** One planner ask: the definition's datasets and columns in, a proposal out. */
  authoring: { inputTokens: 8_000, outputTokens: 2_000 },
  /** One chat message: system prompt, history, and a few tool rounds. */
  chat: { inputTokens: 30_000, outputTokens: 1_500 },
};
/** Thinking models write their reasoning too; it is billed as output. */
const THINKING_OUTPUT_FACTOR = 2.5;

export function isAiModelKey(value: unknown): value is AiModelKey {
  return typeof value === 'string' && AI_MODELS.some((m) => m.key === value);
}

export function aiModel(key: AiModelKey): AiModel {
  const model = AI_MODELS.find((m) => m.key === key);
  if (!model) {
    throw new Error(`Unknown model '${key}'`);
  }
  return model;
}

/** Dollars for a given usage at the model's list price. */
export function costOf(
  model: AiModel,
  usage: { inputTokens: number; outputTokens: number }
): number {
  return (
    (usage.inputTokens * model.price.input + usage.outputTokens * model.price.output) /
    TOKENS_PER_PRICE_UNIT
  );
}

/** A rough per-call estimate for the picker. */
export function typicalCost(model: AiModel, kind: 'authoring' | 'chat'): number {
  const shape = TYPICAL[kind];
  const outputTokens = model.thinks
    ? shape.outputTokens * THINKING_OUTPUT_FACTOR
    : shape.outputTokens;
  return costOf(model, { inputTokens: shape.inputTokens, outputTokens });
}

/** OpenAI is only offered when the stack has an endpoint and a key for it. */
export function openAiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.PLANNER_BASE_URL || '').trim() && (env.PLANNER_API_KEY || '').trim());
}

/** The OpenAI model name, overridable per stack. */
export function openAiModelId(env: NodeJS.ProcessEnv = process.env): string {
  return (env.OPENAI_MODEL_ID || '').trim() || aiModel('openai').modelId;
}

export interface AiModelView {
  key: AiModelKey;
  label: string;
  provider: AiProvider;
  modelId: string;
  price: { input: number; output: number };
  bestFor: string;
  thinks: boolean;
  available: boolean;
  unavailableReason?: string;
  typicalCost: { authoring: number; chat: number };
}

/** The catalog as the picker shows it. */
export function aiModelViews(env: NodeJS.ProcessEnv = process.env): AiModelView[] {
  const openAi = openAiConfigured(env);
  return AI_MODELS.map((m) => ({
    key: m.key,
    label: m.label,
    provider: m.provider,
    modelId: m.provider === 'openai' ? openAiModelId(env) : m.modelId,
    price: m.price,
    bestFor: m.bestFor,
    thinks: m.thinks,
    available: m.provider !== 'openai' || openAi,
    ...(m.provider === 'openai' && !openAi
      ? { unavailableReason: 'Set PLANNER_BASE_URL and PLANNER_API_KEY on the stack to enable.' }
      : {}),
    typicalCost: { authoring: typicalCost(m, 'authoring'), chat: typicalCost(m, 'chat') },
  }));
}
