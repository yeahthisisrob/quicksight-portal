/**
 * CalculatedFieldTemplateStore - calculated fields saved for reuse.
 *
 * SMUS has no home for a QuickSight calculated field, so the portal keeps
 * these: one DynamoDB item per template in the jobs table under the
 * CALC_TEMPLATE partition. Author adds them to the copies it creates; the
 * catalog marks the fields that match one so a canonical expression is easy
 * to find among conflicting variants.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import { DynamoDBService } from '../../../shared/services/aws/DynamoDBService';
import { logger } from '../../../shared/utils/logger';
import { canonicalExpression } from '../lib/expressionAnalysis';

const TEMPLATE_PK = 'CALC_TEMPLATE';
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

interface StoredTemplate extends CalculatedFieldTemplate {
  pk: string;
  sk: string;
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

export class CalculatedFieldTemplateStore {
  private readonly tableName: string;

  public constructor(
    private readonly dynamo: DynamoDBService = new DynamoDBService(),
    tableName?: string
  ) {
    this.tableName =
      tableName ||
      process.env.JOBS_TABLE_NAME ||
      `quicksight-portal-jobs-${process.env.AWS_ACCOUNT_ID || ''}`;
  }

  public async list(): Promise<CalculatedFieldTemplate[]> {
    const items = await this.dynamo.queryPartition<StoredTemplate>(
      this.tableName,
      'pk',
      TEMPLATE_PK
    );
    return items.map(strip).sort((a, b) => a.name.localeCompare(b.name));
  }

  public async get(id: string): Promise<CalculatedFieldTemplate | null> {
    const item = await this.dynamo.getItem<StoredTemplate>(this.tableName, {
      pk: TEMPLATE_PK,
      sk: id,
    });
    return item ? strip(item) : null;
  }

  public async create(
    input: CalculatedFieldTemplateInput,
    createdBy: string
  ): Promise<CalculatedFieldTemplate> {
    const now = new Date().toISOString();
    const item: StoredTemplate = {
      pk: TEMPLATE_PK,
      sk: randomUUID(),
      id: '',
      ...input,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
    item.id = item.sk;
    await this.dynamo.putItem(this.tableName, item);
    logger.info('Calculated-field template saved', { id: item.id, name: item.name, createdBy });
    return strip(item);
  }

  public async update(
    id: string,
    input: CalculatedFieldTemplateInput
  ): Promise<CalculatedFieldTemplate> {
    const existing = await this.get(id);
    if (!existing) {
      throw Object.assign(new ValidationError(`No template '${id}'`), { statusCode: 404 });
    }
    const item: StoredTemplate = {
      pk: TEMPLATE_PK,
      sk: id,
      ...existing,
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };
    await this.dynamo.putItem(this.tableName, item);
    return strip(item);
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      throw Object.assign(new ValidationError(`No template '${id}'`), { statusCode: 404 });
    }
    await this.dynamo.deleteItem(this.tableName, { pk: TEMPLATE_PK, sk: id });
    logger.info('Calculated-field template deleted', { id });
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

function strip(item: StoredTemplate): CalculatedFieldTemplate {
  const { pk: _pk, sk: _sk, ...rest } = item;
  return rest;
}
