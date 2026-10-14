/**
 * An adaptive-thinking model (Claude 5) takes `output_config.effort`, and
 * without it thinks at Bedrock's default, high, on every call. The planner
 * asks for the effort Settings name; older models never see the field.
 */
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BedrockAdapter } from '../BedrockAdapter';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const bedrock = mockClient(BedrockRuntimeClient);

const request = {
  modelId: 'us.anthropic.claude-opus-5',
  system: 'Plan.',
  user: 'A table.',
  toolName: 'plan',
  toolDescription: 'The plan',
  inputSchema: { type: 'object' },
  maxTokens: 100,
};

describe('BedrockAdapter effort', () => {
  let adapter: BedrockAdapter;

  beforeEach(() => {
    bedrock.reset();
    bedrock.on(ConverseCommand).resolves({
      output: {
        message: { role: 'assistant', content: [{ toolUse: { name: 'plan', input: {} } }] },
      },
      stopReason: 'tool_use',
      usage: { inputTokens: 1, outputTokens: 1 },
    } as any);
    adapter = new BedrockAdapter('us-east-1', new BedrockRuntimeClient({}) as any);
  });

  const sent = () => bedrock.commandCalls(ConverseCommand)[0]?.args[0]?.input as any;

  it('asks a model that takes it for the effort named', async () => {
    await adapter.structuredOutput({
      ...request,
      capabilities: { temperature: false, forcedTool: false, promptCache: true, effort: true },
      effort: 'medium',
    });
    expect(sent().additionalModelRequestFields).toEqual({ output_config: { effort: 'medium' } });
    expect(sent().inferenceConfig).toEqual({ maxTokens: 100 });
  });

  it('sends nothing extra to a model that does not take it, or when no effort is asked', async () => {
    await adapter.structuredOutput({
      ...request,
      capabilities: { temperature: true, forcedTool: true, promptCache: true },
      effort: 'low',
    });
    expect(sent().additionalModelRequestFields).toBeUndefined();
    bedrock.resetHistory();
    await adapter.structuredOutput({
      ...request,
      capabilities: { temperature: false, forcedTool: false, promptCache: true, effort: true },
    });
    expect(sent().additionalModelRequestFields).toBeUndefined();
  });
});
