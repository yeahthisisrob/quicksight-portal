import { logger } from '../../../../shared/utils/logger';
import {
  extractJsonObject,
  type PlannerModel,
  type StructuredRequest,
  type StructuredResult,
} from './PlannerModel';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const HTTP_OK_MAX = 299;

/**
 * Any endpoint that speaks the OpenAI chat-completions protocol: xAI (Grok),
 * OpenAI itself, or a self-hosted gateway. Structured output is requested
 * through `response_format: json_schema`; if the endpoint ignores it the
 * answer is still pulled out of the text and validated by the caller.
 */
export class OpenAiCompatiblePlannerModel implements PlannerModel {
  public readonly provider = 'openai-compatible';

  private readonly baseUrl: string;

  public constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {
    if (!baseUrl) {
      throw new Error('PLANNER_BASE_URL is required for the openai-compatible planner');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public async complete(request: StructuredRequest): Promise<StructuredResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        max_tokens: request.maxTokens,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schemaName, schema: request.schema, strict: true },
        },
      }),
    });

    if (response.status > HTTP_OK_MAX) {
      const text = await response.text();
      throw new Error(`${this.provider} ${this.model} returned ${response.status}: ${text}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = body.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((c) => c.text ?? '').join('')
      : (content ?? '');
    if (!text) {
      throw new Error(`${this.provider} ${this.model} returned no message content`);
    }

    const usage = {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
    logger.info('Planner chat completion', {
      provider: this.provider,
      model: this.model,
      ...usage,
    });

    return { output: extractJsonObject(text), provider: this.provider, model: this.model, usage };
  }
}
