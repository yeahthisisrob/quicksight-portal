import { BedrockAdapter } from '../../../../adapters/aws/BedrockAdapter';
import { getPlannerConfig, type PlannerConfig } from '../../../../shared/config/plannerConfig';
import { BedrockPlannerModel } from './BedrockPlannerModel';
import { CLI_SPECS, CliPlannerModel } from './CliPlannerModel';
import { OpenAiCompatiblePlannerModel } from './OpenAiCompatiblePlannerModel';
import type { PlannerModel } from './PlannerModel';

/** One place that turns configuration into a model. */
export function createPlannerModel(config: PlannerConfig = getPlannerConfig()): PlannerModel {
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
