/**
 * One turn of a tool-using conversation, the same for every provider.
 * The assistant runs the loop; a ChatModel only translates its turns into
 * the provider's wire format and back. Bedrock (Converse) and OpenAI
 * (chat completions) sit behind it.
 */
import type { ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime';

import type { BedrockAdapter } from '../../../adapters/aws/BedrockAdapter';
import type { AiModel } from '../../../shared/ai/modelCatalog';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
  isError?: boolean;
}

export type ChatTurn =
  | { role: 'user'; text: string }
  /** `raw` is the provider's own message, replayed as-is inside one tool loop. */
  | { role: 'assistant'; text: string; toolCalls: ToolCall[]; raw?: unknown }
  | { role: 'tool'; results: ToolResult[] };

export interface ChatTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ChatTurnResult {
  text: string;
  toolCalls: ToolCall[];
  raw: unknown;
  usage: { inputTokens: number; outputTokens: number };
}

/** The rules (identical every turn, so cached) and the live brief of the account. */
export interface ChatSystem {
  stable: string;
  context?: string;
}

export interface ChatModel {
  turn(system: ChatSystem, turns: ChatTurn[], tools: ChatTool[]): Promise<ChatTurnResult>;
}

const THINKING_MAX_TOKENS = 16_000;
const PLAIN_MAX_TOKENS = 4_096;

function maxTokensFor(model: AiModel): number {
  return model.thinks ? THINKING_MAX_TOKENS : PLAIN_MAX_TOKENS;
}

export class BedrockChatModel implements ChatModel {
  public constructor(
    private readonly adapter: BedrockAdapter,
    private readonly model: AiModel
  ) {}

  public async turn(
    system: ChatSystem,
    turns: ChatTurn[],
    tools: ChatTool[]
  ): Promise<ChatTurnResult> {
    const messages: Message[] = turns.map((turn): Message => {
      if (turn.role === 'user') {
        return { role: 'user', content: [{ text: turn.text }] };
      }
      if (turn.role === 'tool') {
        return {
          role: 'user',
          content: turn.results.map(
            (r) =>
              ({
                toolResult: {
                  toolUseId: r.id,
                  content: [{ text: r.content || '(empty)' }],
                  status: r.isError ? 'error' : 'success',
                },
              }) as ContentBlock
          ),
        };
      }
      if (turn.raw) {
        // Thinking models need their own blocks back, unchanged, mid-loop.
        return turn.raw as Message;
      }
      const content: ContentBlock[] = [];
      if (turn.text.trim()) {
        content.push({ text: turn.text });
      }
      for (const call of turn.toolCalls) {
        content.push({
          toolUse: { toolUseId: call.id, name: call.name, input: call.input as any },
        } as ContentBlock);
      }
      return { role: 'assistant', content };
    });

    const result = await this.adapter.converseTurn({
      modelId: this.model.modelId,
      system: system.stable,
      ...(system.context ? { context: system.context } : {}),
      messages,
      tools,
      maxTokens: maxTokensFor(this.model),
      capabilities: this.model.capabilities,
    });
    const blocks = result.message.content ?? [];
    return {
      text: blocks
        .map((b) => b.text ?? '')
        .join('')
        .trim(),
      toolCalls: blocks
        .filter((b) => b.toolUse)
        .map((b) => ({
          id: b.toolUse!.toolUseId ?? '',
          name: b.toolUse!.name ?? '',
          input: (b.toolUse!.input ?? {}) as Record<string, unknown>,
        })),
      raw: result.message,
      usage: result.usage,
    };
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const HTTP_OK_MAX = 299;

export class OpenAiChatModel implements ChatModel {
  public constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly model: AiModel,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {
    if (!baseUrl) {
      throw new Error('PLANNER_BASE_URL is required for OpenAI');
    }
  }

  public async turn(
    system: ChatSystem,
    turns: ChatTurn[],
    tools: ChatTool[]
  ): Promise<ChatTurnResult> {
    const messages: unknown[] = [
      {
        role: 'system',
        content: system.context ? `${system.stable}\n\n${system.context}` : system.stable,
      },
    ];
    for (const turn of turns) {
      if (turn.role === 'user') {
        messages.push({ role: 'user', content: turn.text });
      } else if (turn.role === 'tool') {
        for (const r of turn.results) {
          messages.push({ role: 'tool', tool_call_id: r.id, content: r.content || '(empty)' });
        }
      } else {
        messages.push({
          role: 'assistant',
          content: turn.text || null,
          ...(turn.toolCalls.length
            ? {
                tool_calls: turn.toolCalls.map((c) => ({
                  id: c.id,
                  type: 'function',
                  function: { name: c.name, arguments: JSON.stringify(c.input) },
                })),
              }
            : {}),
        });
      }
    }
    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.modelId,
        messages,
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        })),
        [this.model.capabilities.maxTokensParam ?? 'max_tokens']: maxTokensFor(this.model),
      }),
    });
    if (response.status > HTTP_OK_MAX) {
      throw new Error(
        `OpenAI ${this.modelId} returned ${response.status}: ${await response.text()}`
      );
    }
    const body = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = body.choices?.[0]?.message ?? {};
    return {
      text: (message.content ?? '').trim(),
      toolCalls: (message.tool_calls ?? []).map((c) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(c.function.arguments || '{}');
        } catch {
          input = { _unparsed: c.function.arguments };
        }
        return { id: c.id, name: c.function.name, input };
      }),
      raw: undefined,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      },
    };
  }
}
