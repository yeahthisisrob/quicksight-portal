import { describe, expect, it, vi } from 'vitest';

import { BedrockAdapter } from '../../../../../adapters/aws/BedrockAdapter';
import { BedrockPlannerModel } from '../BedrockPlannerModel';
import { CLI_SPECS, CliPlannerModel, type CommandRunner } from '../CliPlannerModel';
import { OpenAiCompatiblePlannerModel } from '../OpenAiCompatiblePlannerModel';
import { extractJsonObject, type StructuredRequest } from '../PlannerModel';

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const REQUEST: StructuredRequest = {
  label: 'test',
  system: 'You are a test.',
  user: 'Answer.',
  schemaName: 'answer',
  schemaDescription: 'The answer.',
  schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
  maxTokens: 100,
};

describe('extractJsonObject', () => {
  it('parses a bare object', () => {
    expect(extractJsonObject('{"ok":true}')).toEqual({ ok: true });
  });

  it('digs an object out of prose and code fences', () => {
    expect(extractJsonObject('Sure!\n```json\n{"ok": true, "s": "a}b"}\n```\nDone.')).toEqual({
      ok: true,
      s: 'a}b',
    });
    expect(extractJsonObject('Here: {"a":{"b":[1,2]}} trailing')).toEqual({ a: { b: [1, 2] } });
  });

  it('fails clearly without an object', () => {
    expect(() => extractJsonObject('no json here')).toThrow('no JSON object');
    expect(() => extractJsonObject('{"open": true')).toThrow('unterminated');
  });
});

describe('CliPlannerModel', () => {
  it('sends the schema in the prompt and unwraps the claude JSON envelope', async () => {
    const run: CommandRunner = vi.fn(async () =>
      JSON.stringify({ type: 'result', result: 'Here you go:\n{"ok": true}' })
    );
    const model = new CliPlannerModel(CLI_SPECS['claude-cli'], 1000, run);

    const result = await model.complete(REQUEST);

    expect(result).toEqual({ output: { ok: true }, provider: 'claude-cli', model: 'claude' });
    const [command, args, stdin, timeout] = (run as any).mock.calls[0];
    expect(command).toBe('claude');
    expect(args).toEqual(['-p', '--output-format', 'json']);
    expect(stdin).toContain('You are a test.');
    expect(stdin).toContain('"required":["ok"]');
    expect(timeout).toBe(1000);
  });

  it('reads codex output straight from stdout', async () => {
    const run: CommandRunner = vi.fn(async () => '{"ok": false}\n');
    const model = new CliPlannerModel(CLI_SPECS['codex-cli'], 1000, run);
    const result = await model.complete(REQUEST);
    expect(result.output).toEqual({ ok: false });
    expect((run as any).mock.calls[0][0]).toBe('codex');
  });

  it('surfaces a failed command', async () => {
    const run: CommandRunner = vi.fn(async () => {
      throw new Error('claude failed: not logged in');
    });
    const model = new CliPlannerModel(CLI_SPECS['claude-cli'], 1000, run);
    await expect(model.complete(REQUEST)).rejects.toThrow('not logged in');
  });
});

describe('OpenAiCompatiblePlannerModel', () => {
  const okResponse = (content: unknown) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status: 200 }
    );

  it('posts a chat completion with a json_schema response format', async () => {
    const fetchImpl = vi.fn(async () => okResponse('{"ok":true}'));
    const model = new OpenAiCompatiblePlannerModel(
      'https://api.x.ai/v1/',
      'key',
      'grok-4',
      fetchImpl
    );

    const result = await model.complete(REQUEST);

    expect(result).toEqual({
      output: { ok: true },
      provider: 'openai-compatible',
      model: 'grok-4',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('grok-4');
    expect(body.response_format.json_schema.name).toBe('answer');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a test.' });
  });

  it('accepts content parts and fails on HTTP errors', async () => {
    const parts = vi.fn(async () => okResponse([{ text: '{"ok":' }, { text: 'true}' }]));
    expect(
      (await new OpenAiCompatiblePlannerModel('u', '', 'm', parts).complete(REQUEST)).output
    ).toEqual({ ok: true });

    const failing = vi.fn(async () => new Response('rate limited', { status: 429 }));
    await expect(
      new OpenAiCompatiblePlannerModel('u', '', 'm', failing).complete(REQUEST)
    ).rejects.toThrow('429: rate limited');
  });

  it('requires a base url', () => {
    expect(() => new OpenAiCompatiblePlannerModel('', '', 'm')).toThrow('PLANNER_BASE_URL');
  });
});

describe('BedrockAdapter and BedrockPlannerModel', () => {
  const client = { send: vi.fn() };

  it('forces the schema tool and returns its parsed input', async () => {
    client.send.mockResolvedValue({
      stopReason: 'tool_use',
      usage: { inputTokens: 40, outputTokens: 8 },
      output: {
        message: {
          content: [{ text: 'thinking' }, { toolUse: { name: 'answer', input: { ok: true } } }],
        },
      },
    });
    const model = new BedrockPlannerModel(
      new BedrockAdapter('us-east-1', client as any),
      'us.anthropic.test'
    );

    const result = await model.complete(REQUEST);

    expect(result).toEqual({
      output: { ok: true },
      provider: 'bedrock',
      model: 'us.anthropic.test',
      usage: { inputTokens: 40, outputTokens: 8 },
    });
    const input = (client.send.mock.calls[0] as any)[0].input;
    expect(input.modelId).toBe('us.anthropic.test');
    expect(input.toolConfig.toolChoice).toEqual({ tool: { name: 'answer' } });
    expect(input.toolConfig.tools[0].toolSpec.inputSchema.json).toEqual(REQUEST.schema);
    expect(input.inferenceConfig).toEqual({ maxTokens: 100, temperature: 0 });
  });

  it('asks newer models in words: no temperature, auto tool choice', async () => {
    const newer = {
      send: vi.fn().mockResolvedValue({
        output: { message: { content: [{ toolUse: { name: 'answer', input: { ok: true } } }] } },
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    };
    const model = new BedrockPlannerModel(
      new BedrockAdapter('us-east-1', newer as any),
      'us.anthropic.claude-opus-5',
      { temperature: false, forcedTool: false, promptCache: true }
    );
    const result = await model.complete({
      label: 't',
      system: 'sys',
      user: 'u',
      schemaName: 'answer',
      schemaDescription: 'd',
      schema: { type: 'object' },
      maxTokens: 100,
    });
    expect(result.output).toEqual({ ok: true });
    const input = newer.send.mock.calls[0]![0].input;
    expect(input.toolConfig.toolChoice).toEqual({ auto: {} });
    expect(input.inferenceConfig).toEqual({ maxTokens: 100 });
    expect(input.system[0].text).toContain('Answer only by calling the answer tool');
  });

  it('fails when the model did not call the tool', async () => {
    client.send.mockResolvedValue({
      stopReason: 'end_turn',
      output: { message: { content: [{ text: 'no' }] } },
    });
    const adapter = new BedrockAdapter('us-east-1', client as any);
    await expect(
      adapter.structuredOutput({
        modelId: 'm',
        system: 's',
        user: 'u',
        toolName: 'answer',
        toolDescription: 'd',
        inputSchema: {},
        maxTokens: 10,
      })
    ).rejects.toThrow('no answer tool call (stopReason: end_turn)');
  });
});
