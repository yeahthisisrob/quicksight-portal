import {
  BedrockRuntimeClient,
  type ContentBlock,
  ConverseCommand,
  type ConverseCommandInput,
  type Message,
  type SystemContentBlock,
  type Tool,
  type ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';

import { logger } from '../../shared/utils/logger';

/** What a model accepts; the newer Claude models dropped some of the older surface. */
export interface ConverseCapabilities {
  temperature: boolean;
  forcedTool: boolean;
  promptCache: boolean;
}

const LEGACY_CAPABILITIES: ConverseCapabilities = {
  temperature: true,
  forcedTool: true,
  promptCache: false,
};

interface StructuredOutputRequest {
  modelId: string;
  system: string;
  user: string;
  /** The tool the model is asked to call; its input IS the structured output. */
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens: number;
  capabilities?: ConverseCapabilities;
}

interface StructuredOutputResult {
  output: unknown;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
}

interface ConverseTurnRequest {
  modelId: string;
  system: string;
  /** Changes per answer (the live brief), so it sits after the cache point. */
  context?: string;
  messages: Message[];
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  maxTokens: number;
  capabilities: ConverseCapabilities;
}

interface ConverseTurnResult {
  /** The assistant message exactly as returned, for replay within the tool loop. */
  message: Message;
  stopReason?: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Bedrock's Converse API: the one surface that works the same for every
 * model family with tool use, so callers stay model-agnostic. Two shapes:
 * a structured answer (the model's tool input is the answer), and one turn
 * of a tool-using conversation.
 */
export class BedrockAdapter {
  private readonly client: BedrockRuntimeClient;

  public constructor(region: string, client?: BedrockRuntimeClient) {
    this.client = client ?? new BedrockRuntimeClient({ region });
  }

  public async structuredOutput(req: StructuredOutputRequest): Promise<StructuredOutputResult> {
    const caps = req.capabilities ?? LEGACY_CAPABILITIES;
    // Where a forced call is refused (always-on thinking), ask for it in
    // words: the model still answers through the tool, and the check
    // below fails loudly if it does not.
    const system = caps.forcedTool
      ? req.system
      : `${req.system}\n\nAnswer only by calling the ${req.toolName} tool, exactly once.`;
    const input: ConverseCommandInput = {
      modelId: req.modelId,
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: req.user }] }],
      inferenceConfig: {
        maxTokens: req.maxTokens,
        ...(caps.temperature ? { temperature: 0 } : {}),
      },
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: req.toolName,
              description: req.toolDescription,
              inputSchema: { json: req.inputSchema as any },
            },
          },
        ],
        toolChoice: caps.forcedTool ? { tool: { name: req.toolName } } : { auto: {} },
      },
    };

    const response = await this.client.send(new ConverseCommand(input));
    const usage = {
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
    };
    // One line per call so cost is visible instead of assumed.
    logger.info('Bedrock converse', { modelId: req.modelId, ...usage, stop: response.stopReason });

    const blocks = response.output?.message?.content ?? [];
    const toolUse = blocks.find((b): b is { toolUse: ToolUseBlock } => Boolean(b.toolUse))?.toolUse;
    if (!toolUse || toolUse.name !== req.toolName) {
      throw new Error(
        `Bedrock returned no ${req.toolName} tool call (stopReason: ${response.stopReason})`
      );
    }
    return { output: toolUse.input, usage, modelId: req.modelId };
  }

  /** One turn of a tool-using conversation; the caller runs the loop. */
  public async converseTurn(req: ConverseTurnRequest): Promise<ConverseTurnResult> {
    const system: SystemContentBlock[] = [{ text: req.system }];
    if (req.capabilities.promptCache) {
      // The system prompt (with the API index) is the same every turn.
      system.push({ cachePoint: { type: 'default' } } as SystemContentBlock);
    }
    if (req.context) {
      system.push({ text: req.context });
    }
    const tools: Tool[] = req.tools.map((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: { json: t.inputSchema as any },
      },
    }));
    const response = await this.client.send(
      new ConverseCommand({
        modelId: req.modelId,
        system,
        messages: req.messages,
        inferenceConfig: {
          maxTokens: req.maxTokens,
          ...(req.capabilities.temperature ? { temperature: 0.2 } : {}),
        },
        toolConfig: { tools, toolChoice: { auto: {} } },
      })
    );
    const usage = {
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
    };
    logger.info('Bedrock converse turn', {
      modelId: req.modelId,
      ...usage,
      stop: response.stopReason,
    });
    const message: Message = response.output?.message ?? {
      role: 'assistant',
      content: [] as ContentBlock[],
    };
    return { message, stopReason: response.stopReason, usage };
  }
}
