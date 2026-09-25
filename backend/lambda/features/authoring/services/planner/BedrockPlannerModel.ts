import type { BedrockAdapter, ConverseCapabilities } from '../../../../adapters/aws/BedrockAdapter';
import type { PlannerModel, StructuredRequest, StructuredResult } from './PlannerModel';

/** Production provider. Any Bedrock model with tool use works. */
export class BedrockPlannerModel implements PlannerModel {
  public readonly provider = 'bedrock';

  public constructor(
    private readonly adapter: BedrockAdapter,
    private readonly modelId: string,
    /** Omitted for the configured model: the pre-catalog behaviour (temperature 0, forced tool). */
    private readonly capabilities?: ConverseCapabilities
  ) {}

  public async complete(request: StructuredRequest): Promise<StructuredResult> {
    const result = await this.adapter.structuredOutput({
      modelId: this.modelId,
      system: request.system,
      user: request.user,
      toolName: request.schemaName,
      toolDescription: request.schemaDescription,
      inputSchema: request.schema,
      maxTokens: request.maxTokens,
      capabilities: this.capabilities,
    });
    return {
      output: result.output,
      provider: this.provider,
      model: result.modelId,
      usage: result.usage,
    };
  }
}
