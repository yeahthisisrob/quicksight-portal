/**
 * VisualTemplateStore - visuals the organisation saves for reuse: "Revenue
 * trend" is a line chart of SUM(revenue) by order_date, by month. Stored by
 * column names, so one works on any dataset that has those columns; a
 * dataset without them leaves the visual out and says so.
 */
import { ValidationError } from '../../errors/ValidationError';
import type { DynamoDBService } from '../aws/DynamoDBService';
import { type TemplateMeta, TemplateStore } from './TemplateStore';

const TEMPLATE_PK = 'VISUAL_TEMPLATE';
const NAME_MAX_LENGTH = 200;
const MAX_VALUES = 10;

/** The visual types the builder makes; kept equal to authoring's BUILDABLE_VISUAL_TYPES by a test. */
export const VISUAL_TEMPLATE_TYPES = [
  'KPI',
  'BarChart',
  'ColumnChart',
  'LineChart',
  'PieChart',
  'DonutChart',
  'Table',
  'PivotTable',
] as const;
type VisualTemplateType = (typeof VISUAL_TEMPLATE_TYPES)[number];
const AGGREGATIONS = ['SUM', 'AVERAGE', 'COUNT', 'DISTINCT_COUNT', 'MIN', 'MAX'] as const;
const GRANULARITIES = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;

interface TemplateVisual {
  type: VisualTemplateType;
  title?: string;
  category?: string;
  granularity?: (typeof GRANULARITIES)[number];
  values: Array<{ column: string; aggregation?: (typeof AGGREGATIONS)[number] }>;
  color?: string;
}

interface VisualTemplate extends TemplateMeta {
  visual: TemplateVisual;
}

interface VisualTemplateInput {
  name: string;
  description?: string;
  visual: TemplateVisual;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function validateVisualTemplateInput(raw: unknown): VisualTemplateInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = text(body.name) ?? '';
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`name is required (at most ${NAME_MAX_LENGTH} characters)`);
  }
  const v = (body.visual ?? {}) as Record<string, unknown>;
  const type = v.type as VisualTemplateType;
  if (!VISUAL_TEMPLATE_TYPES.includes(type)) {
    throw new ValidationError(`visual.type must be one of ${VISUAL_TEMPLATE_TYPES.join(', ')}`);
  }
  const values = (Array.isArray(v.values) ? v.values : [])
    .map((entry) => (entry ?? {}) as Record<string, unknown>)
    .filter((entry) => text(entry.column))
    .map((entry) => {
      const aggregation = entry.aggregation as TemplateVisual['values'][number]['aggregation'];
      if (aggregation !== undefined && !AGGREGATIONS.includes(aggregation!)) {
        throw new ValidationError(`aggregation must be one of ${AGGREGATIONS.join(', ')}`);
      }
      return { column: text(entry.column)!, ...(aggregation ? { aggregation } : {}) };
    });
  if (values.length === 0 || values.length > MAX_VALUES) {
    throw new ValidationError(`visual.values must list 1 to ${MAX_VALUES} columns`);
  }
  const category = text(v.category);
  if (type !== 'KPI' && !category && type !== 'Table') {
    throw new ValidationError(`a ${type} needs visual.category`);
  }
  const granularity = v.granularity as TemplateVisual['granularity'];
  if (granularity !== undefined && !GRANULARITIES.includes(granularity!)) {
    throw new ValidationError(`granularity must be one of ${GRANULARITIES.join(', ')}`);
  }
  return {
    name,
    ...(text(body.description) ? { description: text(body.description) } : {}),
    visual: {
      type,
      ...(text(v.title) ? { title: text(v.title) } : {}),
      ...(category && type !== 'KPI' ? { category } : {}),
      ...(granularity ? { granularity } : {}),
      values,
      ...(text(v.color) ? { color: text(v.color) } : {}),
    },
  };
}

export class VisualTemplateStore extends TemplateStore<VisualTemplate, VisualTemplateInput> {
  public constructor(dynamo?: DynamoDBService, tableName?: string) {
    super(TEMPLATE_PK, 'Visual template', dynamo, tableName);
  }
}
