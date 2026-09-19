/**
 * A dashboard or analysis from nothing: the datasets it reads, the visuals
 * by column names, and the request the server builds it from. Pure: the
 * hook holds this state, the Visuals step edits it, the fixtures fake it.
 *
 * A visual here is the server's VisualSpec with a client-side id, so a card
 * keeps its identity while it is being typed into and before it is complete.
 */
import type {
  AddedCalculatedField,
  AuthorableAssetType,
  NewAssetRequest,
  TemplateRequest,
  TypeRules,
  VisualSpec,
} from '@/shared/api/modules/authoring';

import { VISUAL_TYPE_LABELS } from './standard';

export type BuildableVisualType = VisualSpec['type'];
export type Aggregation = NonNullable<VisualSpec['values'][number]['aggregation']>;
export type Granularity = NonNullable<VisualSpec['granularity']>;

/** KPIs first: the builder lays them out first too. */
export const BUILDABLE_VISUAL_TYPES: readonly BuildableVisualType[] = [
  'KPI',
  'BarChart',
  'ColumnChart',
  'LineChart',
  'PieChart',
  'DonutChart',
  'Table',
  'PivotTable',
];

export const BUILDABLE_TYPE_LABELS: Record<BuildableVisualType, string> = {
  KPI: 'KPI',
  ...VISUAL_TYPE_LABELS,
};

export const AGGREGATIONS: ReadonlyArray<{ value: Aggregation; label: string }> = [
  { value: 'SUM', label: 'Sum' },
  { value: 'AVERAGE', label: 'Average' },
  { value: 'COUNT', label: 'Count' },
  { value: 'DISTINCT_COUNT', label: 'Distinct count' },
  { value: 'MIN', label: 'Min' },
  { value: 'MAX', label: 'Max' },
];

export const GRANULARITIES: ReadonlyArray<{ value: Granularity; label: string }> = [
  { value: 'DAY', label: 'Day' },
  { value: 'WEEK', label: 'Week' },
  { value: 'MONTH', label: 'Month' },
  { value: 'QUARTER', label: 'Quarter' },
  { value: 'YEAR', label: 'Year' },
];

/** A dataset the new asset reads, under the identifier its columns are addressed by. */
export interface NewAssetDataset {
  identifier: string;
  dataSetId: string;
  name: string;
}

/** One output column of a dataset, as the cached export lists it. */
export interface DatasetColumn {
  name: string;
  /** STRING, INTEGER, DECIMAL, DATETIME - QuickSight's output column types. */
  type: string;
}

export interface DraftValue {
  column: string;
  aggregation?: Aggregation;
}

/** A VisualSpec being edited: same fields, plus an id for the card. */
export interface DraftVisual {
  id: string;
  type: BuildableVisualType;
  title: string;
  identifier: string;
  category?: string;
  granularity?: Granularity;
  values: DraftValue[];
  color?: string;
}

/** What a New-mode preview or create sends, before the request is assembled. */
export interface NewAssetDraft {
  assetType: AuthorableAssetType;
  name: string;
  datasets: NewAssetDataset[];
  visuals: DraftVisual[];
  ask?: string;
  sheetName?: string;
  addCalculatedFields?: AddedCalculatedField[];
  template?: TemplateRequest;
  typeRules?: TypeRules;
  permissionsFrom?: { assetType: AuthorableAssetType; assetId: string };
  folderId?: string;
}

const DATE_TYPES = new Set(['DATETIME', 'DATE', 'TIMESTAMP']);
const NUMERIC_TYPES = new Set(['INTEGER', 'DECIMAL', 'INT', 'BIGINT', 'DOUBLE', 'FLOAT']);
const MAX_IDENTIFIER_LENGTH = 40;

export function isDateColumn(type: string | undefined): boolean {
  return type !== undefined && DATE_TYPES.has(type.toUpperCase());
}

export function isNumericColumn(type: string | undefined): boolean {
  return type !== undefined && NUMERIC_TYPES.has(type.toUpperCase());
}

/** "Sales gold (v2)" → "sales_gold_v2". Never empty. */
export function slugIdentifier(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_IDENTIFIER_LENGTH);
  return slug || 'dataset';
}

/** The slug, or the slug with a counter when another dataset already has it. */
export function uniqueIdentifier(name: string, taken: readonly string[]): string {
  const base = slugIdentifier(name);
  if (!taken.includes(base)) {
    return base;
  }
  let n = 2;
  while (taken.includes(`${base}_${n}`)) {
    n += 1;
  }
  return `${base}_${n}`;
}

let nextId = 0;
/** Ids only have to be unique within one page load. */
export function draftId(): string {
  nextId += 1;
  return `v${nextId}`;
}

export function newVisual(identifier: string, type: BuildableVisualType = 'BarChart'): DraftVisual {
  return { id: draftId(), type, title: '', identifier, values: [{ column: '' }] };
}

/** The server's specs as editable cards. */
export function draftsFromSpecs(specs: VisualSpec[]): DraftVisual[] {
  return specs.map((spec) => ({
    id: draftId(),
    type: spec.type,
    title: spec.title,
    identifier: spec.identifier,
    category: spec.category,
    granularity: spec.granularity,
    values: spec.values.map((v) => ({ column: v.column, aggregation: v.aggregation })),
    color: spec.color,
  }));
}

/** A visual the builder can place: a title, a dataset, and one value column. */
export function isComplete(visual: DraftVisual): boolean {
  return (
    visual.title.trim().length > 0 &&
    visual.identifier.length > 0 &&
    visual.values.some((v) => v.column.trim().length > 0)
  );
}

/** Complete visuals as the request carries them; blank rows and blank wells dropped. */
export function specsFromDrafts(visuals: DraftVisual[]): VisualSpec[] {
  return visuals.filter(isComplete).map((visual) => {
    const isKpi = visual.type === 'KPI';
    const category = isKpi ? undefined : visual.category?.trim() || undefined;
    return {
      type: visual.type,
      title: visual.title.trim(),
      identifier: visual.identifier,
      ...(category ? { category } : {}),
      ...(category && visual.granularity ? { granularity: visual.granularity } : {}),
      values: visual.values
        .filter((v) => v.column.trim().length > 0)
        .map((v) => ({
          column: v.column.trim(),
          ...(v.aggregation ? { aggregation: v.aggregation } : {}),
        })),
      ...(!isKpi && visual.color?.trim() ? { color: visual.color.trim() } : {}),
    };
  });
}

export function updateVisual(
  visuals: DraftVisual[],
  id: string,
  patch: Partial<Omit<DraftVisual, 'id'>>
): DraftVisual[] {
  return visuals.map((v) => (v.id === id ? { ...v, ...patch } : v));
}

export function removeVisual(visuals: DraftVisual[], id: string): DraftVisual[] {
  return visuals.filter((v) => v.id !== id);
}

export function updateValue(
  visuals: DraftVisual[],
  id: string,
  index: number,
  patch: Partial<DraftValue>
): DraftVisual[] {
  return visuals.map((v) =>
    v.id === id
      ? { ...v, values: v.values.map((value, i) => (i === index ? { ...value, ...patch } : value)) }
      : v
  );
}

export function addValue(visuals: DraftVisual[], id: string): DraftVisual[] {
  return visuals.map((v) => (v.id === id ? { ...v, values: [...v.values, { column: '' }] } : v));
}

/** The last value row stays; a visual always has one to type into. */
export function removeValue(visuals: DraftVisual[], id: string, index: number): DraftVisual[] {
  return visuals.map((v) =>
    v.id === id && v.values.length > 1
      ? { ...v, values: v.values.filter((_, i) => i !== index) }
      : v
  );
}

/** Sum for numbers, a count for anything else, so a fresh row does something sensible. */
export function defaultAggregation(columnType: string | undefined): Aggregation {
  return isNumericColumn(columnType) ? 'SUM' : 'COUNT';
}

/** The output columns of a dataset from its cached export; empty when not cached. */
export function columnsFromExport(exportData: unknown): DatasetColumn[] {
  const describe = (exportData as { apiResponses?: { describe?: { data?: unknown } } } | null)
    ?.apiResponses?.describe?.data as { OutputColumns?: unknown } | undefined;
  const raw = Array.isArray(describe?.OutputColumns) ? describe.OutputColumns : [];
  return raw
    .map((c) => {
      const column = c as { Name?: unknown; Type?: unknown };
      return {
        name: typeof column.Name === 'string' ? column.Name : '',
        type: typeof column.Type === 'string' ? column.Type : 'STRING',
      };
    })
    .filter((c) => c.name.length > 0);
}

/**
 * The request body for a preview or a create. With visuals it sends them;
 * with none and an ask, the planner proposes them.
 */
export function newAssetRequest(draft: NewAssetDraft): NewAssetRequest {
  const visuals = specsFromDrafts(draft.visuals);
  const ask = draft.ask?.trim();
  return {
    assetType: draft.assetType,
    name: draft.name.trim(),
    datasets: draft.datasets.map((d) => ({ identifier: d.identifier, dataSetId: d.dataSetId })),
    ...(visuals.length > 0 ? { visuals } : ask ? { ask } : {}),
    ...(draft.sheetName?.trim() ? { sheetName: draft.sheetName.trim() } : {}),
    ...(draft.addCalculatedFields?.length
      ? { addCalculatedFields: draft.addCalculatedFields }
      : {}),
    ...(draft.template ? { template: draft.template } : {}),
    ...(draft.typeRules ? { typeRules: draft.typeRules } : {}),
    ...(draft.permissionsFrom ? { permissionsFrom: draft.permissionsFrom } : {}),
    ...(draft.folderId ? { folderId: draft.folderId } : {}),
  };
}

const AGGREGATION_WORDS: Record<Aggregation, string> = {
  SUM: 'sum of',
  AVERAGE: 'average',
  COUNT: 'count of',
  DISTINCT_COUNT: 'distinct',
  MIN: 'min',
  MAX: 'max',
};

/** "Bar chart 'Revenue by region': sum of revenue by region, coloured by channel". */
export function describeVisual(spec: VisualSpec | DraftVisual): string {
  const label = BUILDABLE_TYPE_LABELS[spec.type];
  const values = spec.values
    .filter((v) => v.column)
    .map((v) => (v.aggregation ? `${AGGREGATION_WORDS[v.aggregation]} ${v.column}` : v.column))
    .join(', ');
  const parts = [values || 'no values'];
  if (spec.type !== 'KPI' && spec.category) {
    parts.push(
      `by ${spec.category}${spec.granularity ? ` (${spec.granularity.toLowerCase()})` : ''}`
    );
  }
  if (spec.type !== 'KPI' && spec.color) {
    parts.push(`coloured by ${spec.color}`);
  }
  const title = spec.title.trim() || 'untitled';
  return `${label} "${title}": ${parts.join(', ')}`;
}
