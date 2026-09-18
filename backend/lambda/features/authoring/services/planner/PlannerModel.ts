/**
 * The one thing a planner needs from a model: a prompt in, JSON that fits a
 * schema out. No tool loops, no streaming, no memory. Keeping the contract
 * this narrow is what lets Bedrock, a local `claude` or `codex` session, and
 * any OpenAI-compatible endpoint (Grok included) sit behind the same
 * interface.
 */

export interface StructuredRequest {
  /** Short tag for logs: 'choose-target', 'map-columns'. */
  label: string;
  system: string;
  user: string;
  /** Name of the schema / forced tool. Letters, digits and underscores. */
  schemaName: string;
  schemaDescription: string;
  /** JSON Schema (draft 2020-12 subset every provider accepts). */
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface StructuredResult {
  output: unknown;
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface PlannerModel {
  readonly provider: string;
  complete(request: StructuredRequest): Promise<StructuredResult>;
}

/**
 * Pull the first JSON object out of free text. CLIs and chat endpoints
 * sometimes wrap the answer in prose or a ```json fence even when told not to.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  if (start === -1) {
    throw new Error('Model answer contained no JSON object');
  }
  let depth = 0;
  let inString = false;
  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (inString) {
      if (ch === '\\') {
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
  }
  throw new Error('Model answer contained an unterminated JSON object');
}
