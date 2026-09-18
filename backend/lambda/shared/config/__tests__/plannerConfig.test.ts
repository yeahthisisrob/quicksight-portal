import { describe, expect, it } from 'vitest';

import { getPlannerConfig, runningInLambda } from '../plannerConfig';

describe('getPlannerConfig', () => {
  it('defaults to Bedrock with a cross-region Sonnet profile', () => {
    const config = getPlannerConfig({});
    expect(config.provider).toBe('bedrock');
    expect(config.modelId).toBe('us.anthropic.claude-sonnet-4-6');
    expect(config.region).toBe('us-east-1');
  });

  it('honours an explicit provider and model', () => {
    const config = getPlannerConfig({
      PLANNER_PROVIDER: 'openai-compatible',
      PLANNER_MODEL_ID: 'grok-4-fast',
      PLANNER_BASE_URL: 'https://api.x.ai/v1/',
      PLANNER_API_KEY: 'k',
    });
    expect(config).toMatchObject({
      provider: 'openai-compatible',
      modelId: 'grok-4-fast',
      openAi: { baseUrl: 'https://api.x.ai/v1', apiKey: 'k' },
    });
  });

  it('allows the CLI providers locally, including under SAM', () => {
    expect(getPlannerConfig({ PLANNER_PROVIDER: 'claude-cli' }).provider).toBe('claude-cli');
    expect(
      getPlannerConfig({
        PLANNER_PROVIDER: 'codex-cli',
        AWS_LAMBDA_FUNCTION_NAME: 'fn',
        AWS_SAM_LOCAL: 'true',
      }).provider
    ).toBe('codex-cli');
  });

  it('never uses a CLI provider inside Lambda - there is no session there to answer', () => {
    const config = getPlannerConfig({
      PLANNER_PROVIDER: 'claude-cli',
      AWS_LAMBDA_FUNCTION_NAME: 'fn',
    });
    expect(config.provider).toBe('bedrock');
    expect(runningInLambda({ AWS_LAMBDA_FUNCTION_NAME: 'fn' })).toBe(true);
  });

  it('falls back to Bedrock for an unknown provider and parses the CLI timeout', () => {
    expect(getPlannerConfig({ PLANNER_PROVIDER: 'gemini' }).provider).toBe('bedrock');
    expect(getPlannerConfig({ PLANNER_CLI_TIMEOUT_MS: '5000' }).cli.timeoutMs).toBe(5000);
    expect(getPlannerConfig({ PLANNER_CLI_TIMEOUT_MS: 'x' }).cli.timeoutMs).toBe(120000);
  });
});
