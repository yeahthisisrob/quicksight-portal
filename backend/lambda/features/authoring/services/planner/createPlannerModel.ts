import { BedrockAdapter } from '../../../../adapters/aws/BedrockAdapter';
import { type AiModelKey, aiModel, openAiModelId } from '../../../../shared/ai/modelCatalog';
import { getPlannerConfig, type PlannerConfig } from '../../../../shared/config/plannerConfig';
import { BedrockPlannerModel } from './BedrockPlannerModel';
import { CLI_SPECS, CliPlannerModel } from './CliPlannerModel';
import { OpenAiCompatiblePlannerModel } from './OpenAiCompatiblePlannerModel';
import type { PlannerModel } from './PlannerModel';

/**
 * One place that turns configuration into a model. A `choice` from the
 * catalog (the picker on the Author page, or `model` on an API call) wins
 * over the configured provider; without one the stack's configuration
 * decides, as it always has.
 */
export function createPlannerModel(
  config: PlannerConfig = getPlannerConfig(),
  choice?: AiModelKey
): PlannerModel {
  if (choice) {
    const model = aiModel(choice);
    if (model.provider === 'openai') {
      return new OpenAiCompatiblePlannerModel(
        config.openAi.baseUrl,
        config.openAi.apiKey,
        openAiModelId(),
        undefined,
        {
          temperature: model.capabilities.temperature,
          maxTokensParam: model.capabilities.maxTokensParam,
        }
      );
    }
    return new BedrockPlannerModel(
      new BedrockAdapter(config.region),
      model.modelId,
      model.capabilities
    );
  }
  switch (config.provider) {
    case 'claude-cli':
    case 'codex-cli':
      return new CliPlannerModel(CLI_SPECS[config.provider], config.cli.timeoutMs);
    case 'openai-compatible':
      return new OpenAiCompatiblePlannerModel(
        config.openAi.baseUrl,
        config.openAi.apiKey,
        config.modelId
      );
    default:
      return new BedrockPlannerModel(new BedrockAdapter(config.region), config.modelId);
  }
}
