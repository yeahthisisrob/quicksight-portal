/**
 * Planner (LLM) configuration.
 *
 * The planner turns a natural-language ask into a structured rebind proposal.
 * It is model-agnostic on purpose: every provider answers the same single-shot
 * "prompt in, JSON out" request, so switching is an env var, not a rewrite.
 *
 *   PLANNER_PROVIDER      bedrock (default) | claude-cli | codex-cli | openai-compatible
 *   PLANNER_MODEL_ID      provider-specific model id; each provider has a default
 *   PLANNER_BASE_URL      openai-compatible only, e.g. https://api.x.ai/v1 for Grok
 *   PLANNER_API_KEY       openai-compatible only
 *   PLANNER_CLI_TIMEOUT_MS  claude-cli / codex-cli only (default 120000)
 *
 * The CLI providers exist for local development: they shell out to a logged-in
 * `claude` or `codex` on the developer's machine, so the whole flow runs with
 * no AWS credentials. They are never used inside Lambda - there is no session
 * there to answer - so a misconfigured deploy falls back to Bedrock instead
 * of hanging every call.
 */

export type PlannerProvider = 'bedrock' | 'claude-cli' | 'codex-cli' | 'openai-compatible';

export interface PlannerConfig {
  provider: PlannerProvider;
  /** Model id in the provider's own vocabulary. */
  modelId: string;
  region: string;
  openAi: { baseUrl: string; apiKey: string };
  cli: { timeoutMs: number };
}

const PROVIDERS: readonly PlannerProvider[] = [
  'bedrock',
  'claude-cli',
  'codex-cli',
  'openai-compatible',
];

/** Cross-region inference profile; works from any US region. */
const DEFAULT_BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-6';
const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'grok-4';
const DEFAULT_CLI_TIMEOUT_MS = 120_000;

const DEFAULT_MODEL_BY_PROVIDER: Record<PlannerProvider, string> = {
  bedrock: DEFAULT_BEDROCK_MODEL,
  // The CLIs use whatever model the developer's session is configured for.
  'claude-cli': '',
  'codex-cli': '',
  'openai-compatible': DEFAULT_OPENAI_COMPATIBLE_MODEL,
};

export function isPlannerProvider(value: string): value is PlannerProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function runningInLambda(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.AWS_LAMBDA_FUNCTION_NAME) && !env.AWS_SAM_LOCAL;
}

export function getPlannerConfig(env: NodeJS.ProcessEnv = process.env): PlannerConfig {
  const requested = env.PLANNER_PROVIDER || 'bedrock';
  let provider: PlannerProvider = isPlannerProvider(requested) ? requested : 'bedrock';
  if (provider.endsWith('-cli') && runningInLambda(env)) {
    provider = 'bedrock';
  }

  return {
    provider,
    modelId: env.PLANNER_MODEL_ID || DEFAULT_MODEL_BY_PROVIDER[provider],
    region: env.PLANNER_REGION || env.AWS_REGION || 'us-east-1',
    openAi: {
      baseUrl: (env.PLANNER_BASE_URL || '').replace(/\/$/, ''),
      apiKey: env.PLANNER_API_KEY || '',
    },
    cli: {
      timeoutMs: Number.parseInt(env.PLANNER_CLI_TIMEOUT_MS || '', 10) || DEFAULT_CLI_TIMEOUT_MS,
    },
  };
}
