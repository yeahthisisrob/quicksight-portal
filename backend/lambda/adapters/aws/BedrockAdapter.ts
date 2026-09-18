import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';

import { logger } from '../../shared/utils/logger';

export interface StructuredOutputRequest {
  modelId: string;
  system: string;
  user: string;
  /** The tool the model is forced to call; its input IS the structured output. */
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens: number;
}

export interface StructuredOutputResult {
  output: unknown;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
}

/**
 * Structured output over the Bedrock Converse API.
 *
 * Converse is the one Bedrock surface that works the same for every model
 * family that supports tool use (Anthropic, Amazon Nova, Meta, Mistral...), so
 * the caller stays model-agnostic. Forcing a single tool call is how Converse
 * expresses "answer with JSON matching this schema": the model's tool input
 * is the answer, and the SDK has already parsed it.
 */
export class BedrockAdapter {
  private readonly client: BedrockRuntimeClient;

  public constructor(region: string, client?: BedrockRuntimeClient) {
    this.client = client ?? new BedrockRuntimeClient({ region });
  }

  public async structuredOutput(req: StructuredOutputRequest): Promise<StructuredOutputResult> {
    const input: ConverseCommandInput = {
      modelId: req.modelId,
      system: [{ text: req.system }],
      messages: [{ role: 'user', content: [{ text: req.user }] }],
      inferenceConfig: { maxTokens: req.maxTokens, temperature: 0 },
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
        toolChoice: { tool: { name: req.toolName } },
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
}
