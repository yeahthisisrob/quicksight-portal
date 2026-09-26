/**
 * FilterBarTemplateStore - the organisation's standard filter bars.
 *
 * A filter bar template says which filters a sheet's control bar carries,
 * in what order and how wide: "Date, then Region, then Product line". One
 * can be the default, which every analysis the portal builds starts from;
 * a control whose column the datasets do not have is skipped. Stored like
 * the calculated-field templates: one DynamoDB item per template in the
 * jobs table, under the FILTER_BAR_TEMPLATE partition. Shared, because
 * the catalog edits them and authoring applies them.
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../errors/ValidationError';
import { logger } from '../../utils/logger';
import { DynamoDBService } from '../aws/DynamoDBService';

const TEMPLATE_PK = 'FILTER_BAR_TEMPLATE';
const NAME_MAX_LENGTH = 200;
const MAX_CONTROLS = 12;
/** Control-bar widths, in the bar's grid units. */
export const MIN_CONTROL_SPAN = 1;
export const MAX_CONTROL_SPAN = 6;
export const DEFAULT_CONTROL_SPAN = 2;

export interface FilterBarControl {
  /** Column name, matched case-insensitively against the datasets' columns. */
  column: string;
  title?: string;
  span: number;
  /** Text columns: values selected to start with. */
  values?: string[];
}

export interface FilterBarTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  controls: FilterBarControl[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterBarTemplateInput {
  name: string;
  description?: string;
  isDefault?: boolean;
  controls: FilterBarControl[];
}

interface Stored extends FilterBarTemplate {
  pk: string;
  sk: string;
}

function strip({ pk: _pk, sk: _sk, ...rest }: Stored): FilterBarTemplate {
  return rest;
}

export function validateFilterBarInput(raw: unknown): FilterBarTemplateInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required (at most ${NAME_MAX_LENGTH} characters)`);
  }
  if (
    !Array.isArray(body.controls) ||
    body.controls.length === 0 ||
    body.controls.length > MAX_CONTROLS
  ) {
    throw new ValidationError(`controls must list 1 to ${MAX_CONTROLS} filters`);
  }
  const seen = new Set<string>();
  const controls = body.controls.map((entry, i): FilterBarControl => {
    const c = (entry ?? {}) as Record<string, unknown>;
    const column = typeof c.column === 'string' ? c.column.trim() : '';
    if (!column) {
      throw new ValidationError(`controls[${i}].column is required`);
    }
    if (seen.has(column.toLowerCase())) {
      throw new ValidationError(`controls[${i}]: '${column}' is already in the bar`);
    }
    seen.add(column.toLowerCase());
    const span = typeof c.span === 'number' ? Math.round(c.span) : DEFAULT_CONTROL_SPAN;
    if (span < MIN_CONTROL_SPAN || span > MAX_CONTROL_SPAN) {
      throw new ValidationError(
        `controls[${i}].span must be ${MIN_CONTROL_SPAN} to ${MAX_CONTROL_SPAN}`
      );
    }
    const values = Array.isArray(c.values)
      ? c.values
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .map((v) => v.trim())
      : [];
    const title = typeof c.title === 'string' ? c.title.trim() : '';
    return { column, span, ...(title ? { title } : {}), ...(values.length ? { values } : {}) };
  });
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  return {
    name,
    ...(description ? { description } : {}),
    isDefault: body.isDefault === true,
    controls,
  };
}

export class FilterBarTemplateStore {
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

  public async list(): Promise<FilterBarTemplate[]> {
    const items = await this.dynamo.queryPartition<Stored>(this.tableName, 'pk', TEMPLATE_PK);
    return items
      .map(strip)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  }

  public async get(id: string): Promise<FilterBarTemplate | null> {
    const item = await this.dynamo.getItem<Stored>(this.tableName, { pk: TEMPLATE_PK, sk: id });
    return item ? strip(item) : null;
  }

  /** The one every built analysis starts from, if the organisation set one. */
  public async getDefault(): Promise<FilterBarTemplate | null> {
    return (await this.list()).find((t) => t.isDefault) ?? null;
  }

  public async create(
    input: FilterBarTemplateInput,
    createdBy: string
  ): Promise<FilterBarTemplate> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const item: Stored = {
      pk: TEMPLATE_PK,
      sk: id,
      id,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      isDefault: input.isDefault === true,
      controls: input.controls,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
    if (item.isDefault) {
      await this.clearDefault(id);
    }
    await this.dynamo.putItem(this.tableName, item);
    logger.info('Filter bar template saved', { id, name: item.name, createdBy });
    return strip(item);
  }

  public async update(id: string, input: FilterBarTemplateInput): Promise<FilterBarTemplate> {
    const existing = await this.get(id);
    if (!existing) {
      throw Object.assign(new ValidationError(`No filter bar template '${id}'`), {
        statusCode: 404,
      });
    }
    const item: Stored = {
      ...existing,
      pk: TEMPLATE_PK,
      sk: id,
      id,
      name: input.name,
      description: input.description,
      isDefault: input.isDefault === true,
      controls: input.controls,
      updatedAt: new Date().toISOString(),
    };
    if (item.isDefault && !existing.isDefault) {
      await this.clearDefault(id);
    }
    await this.dynamo.putItem(this.tableName, item);
    return strip(item);
  }

  public async delete(id: string): Promise<void> {
    await this.dynamo.deleteItem(this.tableName, { pk: TEMPLATE_PK, sk: id });
  }

  /** Only one default: the others stop being it. */
  private async clearDefault(except: string): Promise<void> {
    for (const other of (await this.list()).filter((t) => t.isDefault && t.id !== except)) {
      await this.dynamo.putItem(this.tableName, {
        ...other,
        pk: TEMPLATE_PK,
        sk: other.id,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * A template's controls as filters on these datasets: each control's column
 * is found on the first dataset that has it; a control no dataset can serve
 * is left out and named.
 */
export function filtersFromTemplate(
  template: Pick<FilterBarTemplate, 'name' | 'controls'>,
  datasets: Array<{ identifier: string; columns: Array<{ name: string }> }>
): {
  filters: Array<{
    identifier: string;
    column: string;
    title?: string;
    values?: string[];
    span: number;
  }>;
  skipped: string[];
} {
  const filters: Array<{
    identifier: string;
    column: string;
    title?: string;
    values?: string[];
    span: number;
  }> = [];
  const skipped: string[] = [];
  for (const control of template.controls) {
    const owner = datasets.find((d) =>
      d.columns.some((c) => c.name.toLowerCase() === control.column.toLowerCase())
    );
    if (!owner) {
      skipped.push(control.column);
      continue;
    }
    filters.push({
      identifier: owner.identifier,
      column: control.column,
      span: control.span,
      ...(control.title ? { title: control.title } : {}),
      ...(control.values?.length ? { values: control.values } : {}),
    });
  }
  return { filters, skipped };
}
