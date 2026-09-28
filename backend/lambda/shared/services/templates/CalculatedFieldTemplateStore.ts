/**
 * CalculatedFieldTemplateStore - calculated fields saved for reuse.
 *
 * SMUS has no home for a QuickSight calculated field, so the portal keeps
 * these in its library. Author adds them to the copies it creates; the
 * catalog marks the fields that match one so a canonical expression is easy
 * to find among conflicting variants.
 */

import { ValidationError } from '../../errors/ValidationError';
import { canonicalExpression } from '../../lib/expressionAnalysis';
import { TemplateStore } from './TemplateStore';

const NAME_MAX_LENGTH = 200;

export interface CalculatedFieldTemplate {
  id: string;
  name: string;
  expression: string;
  dataType?: string;
  description?: string;
  tags?: string[];
  source?: { datasetId?: string; datasetName?: string; listingId?: string };
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface CalculatedFieldTemplateInput {
  name: string;
  expression: string;
  dataType?: string;
  description?: string;
  tags?: string[];
  source?: { datasetId?: string; datasetName?: string; listingId?: string };
}

export function validateTemplateInput(raw: unknown): CalculatedFieldTemplateInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const expression = typeof body.expression === 'string' ? body.expression.trim() : '';
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required (at most ${NAME_MAX_LENGTH} characters)`);
  }
  if (!expression) {
    throw new ValidationError('expression is required');
  }
  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        .map((t) => t.trim())
    : undefined;
  const source =
    typeof body.source === 'object' && body.source !== null
      ? Object.fromEntries(
          Object.entries(body.source as Record<string, unknown>).filter(
            ([k, v]) =>
              ['datasetId', 'datasetName', 'listingId'].includes(k) && typeof v === 'string'
          )
        )
      : undefined;
  return {
    name,
    expression,
    dataType: typeof body.dataType === 'string' ? body.dataType : undefined,
    description:
      typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    source: source && Object.keys(source).length > 0 ? source : undefined,
  };
}

export class CalculatedFieldTemplateStore extends TemplateStore<
  CalculatedFieldTemplate,
  CalculatedFieldTemplateInput
> {
  public constructor() {
    super('calculated-field', 'Calculated-field template');
  }

  /** Template id by normalised expression, for marking matching fields. */
  public static indexByExpression(templates: CalculatedFieldTemplate[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const template of templates) {
      const key = canonicalExpression(template.expression);
      if (key && !map.has(key)) {
        map.set(key, template.id);
      }
    }
    return map;
  }
}
