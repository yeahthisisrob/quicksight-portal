/**
 * The plan a change is drawn as, and the judgement on each calculated field
 * it adds. Pure: the columns a dataset has are read through a function the
 * caller supplies, so the rules can be tested without a portal.
 */
import { placementOf, sameFieldName } from '../../../../../shared/lib/expressionPlacement';
import type { FieldStrategy } from '../../../shared/ai/authoringGuidance';
import type { BuildPlan, FieldVerdict } from '../types';

/** A column the dataset has, with what the catalog says about it. */
export interface KnownColumn {
  name: string;
  type?: string;
  /** From the SMUS listing column the dataset exposes, when there is one. */
  description?: string;
}

type ColumnReader = (dataSetId: string) => Promise<KnownColumn[]>;

const PLAN_STATUSES = new Set(['existing', 'new', 'edited']);

/** A plan from the model's input, or why it is not one. */
export function parsePlan(input: Record<string, unknown>): BuildPlan | string {
  const sources = Array.isArray(input.sources) ? (input.sources as any[]) : [];
  const datasets = Array.isArray(input.datasets) ? (input.datasets as any[]) : [];
  const fields = Array.isArray(input.calculatedFields) ? (input.calculatedFields as any[]) : [];
  const filters = Array.isArray(input.filters) ? (input.filters as any[]) : [];
  const asset = input.asset as any;
  if (
    datasets.length === 0 ||
    !asset?.name ||
    (asset.kind !== 'dashboard' && asset.kind !== 'analysis')
  ) {
    return 'A plan needs at least one dataset and the analysis or dashboard it builds.';
  }
  const missingId = datasets.find((d) => d?.status === 'existing' && !d?.id);
  if (missingId) {
    return `Existing dataset "${missingId.name}" needs its id; find it with context_search.`;
  }
  return {
    sources: sources
      .filter((s) => typeof s?.listing === 'string')
      .map((s) => ({
        listing: s.listing,
        ...(typeof s.project === 'string' ? { project: s.project } : {}),
        ...(typeof s.table === 'string' ? { table: s.table } : {}),
      })),
    datasets: datasets.map((d) => ({
      name: String(d.name),
      status: d.status === 'existing' ? ('existing' as const) : ('new' as const),
      ...(typeof d.id === 'string' ? { id: d.id } : {}),
      ...(typeof d.dataSource === 'string' ? { dataSource: d.dataSource } : {}),
    })),
    ...(fields.length
      ? {
          calculatedFields: fields.map((f) => ({
            name: String(f.name),
            status: f.status === 'existing' ? ('existing' as const) : ('new' as const),
            ...(typeof f.expression === 'string' ? { expression: f.expression } : {}),
            ...(typeof f.dataset === 'string' ? { dataset: f.dataset } : {}),
          })),
        }
      : {}),
    ...(filters.some((f) => typeof f?.column === 'string')
      ? {
          filters: filters
            .filter((f) => typeof f?.column === 'string' && f.column.trim())
            .map((f) => ({
              column: String(f.column).trim(),
              ...(typeof f.title === 'string' && f.title.trim() ? { title: f.title.trim() } : {}),
            })),
        }
      : {}),
    asset: {
      kind: asset.kind,
      name: String(asset.name),
      status: PLAN_STATUSES.has(asset.status) ? asset.status : 'new',
      ...(typeof asset.id === 'string' ? { id: asset.id } : {}),
    },
  };
}

function describe(column: KnownColumn): string {
  const facts = [column.type, column.description ? `"${column.description}"` : ''].filter(Boolean);
  return facts.length ? `${column.name} (${facts.join(', ')})` : column.name;
}

/** A row-level field the dataset has no column for, placed by the organisation's strategy. */
function rowLevelVerdict(
  base: { name: string; expression: string; dataset?: string },
  strategy: FieldStrategy
): FieldVerdict {
  if (strategy === 'source') {
    return {
      ...base,
      verdict: 'push-down',
      note: 'Row-level: it works here for now, and per your guidance belongs upstream, materialised in the source (for example gold).',
    };
  }
  if (strategy === 'dataset') {
    return {
      ...base,
      verdict: 'dataset',
      note: 'Row-level: per your guidance it belongs in the QuickSight dataset, computed once there rather than in every analysis.',
    };
  }
  return {
    ...base,
    verdict: 'row-level',
    note: 'Row-level, so it could be materialised in the dataset or upstream; your guidance states no preference.',
  };
}

/**
 * Each new calculated field in a plan, placed: query-time fields stay in
 * the analysis; row-level ones use a column the dataset already has by
 * that name, and are otherwise placed by the organisation's strategy.
 */
export async function judgeFields(
  plan: BuildPlan,
  strategy: FieldStrategy,
  readColumns: ColumnReader
): Promise<FieldVerdict[]> {
  const fields = (plan.calculatedFields ?? []).filter((f) => f.status === 'new' && f.expression);
  const columnsOf = new Map<string, KnownColumn[]>();
  const verdicts: FieldVerdict[] = [];
  for (const field of fields) {
    const expression = field.expression ?? '';
    const base = {
      name: field.name,
      expression,
      ...(field.dataset ? { dataset: field.dataset } : {}),
    };
    const placement = placementOf(expression);
    if (placement.placement === 'query-time') {
      verdicts.push({
        ...base,
        verdict: 'analysis',
        note: `Computed per visual (${placement.reasons.join(', ')}), so it belongs in the analysis.`,
      });
      continue;
    }
    let columns: KnownColumn[] = [];
    if (field.dataset) {
      if (!columnsOf.has(field.dataset)) {
        columnsOf.set(field.dataset, await readColumns(field.dataset).catch(() => []));
      }
      columns = columnsOf.get(field.dataset) ?? [];
    }
    const column = columns.find((c) => sameFieldName(c.name, field.name));
    verdicts.push(
      column
        ? {
            ...base,
            verdict: 'use-column',
            column: column.name,
            note: `Row-level, and the dataset already has ${describe(column)}: use it rather than recomputing.`,
          }
        : rowLevelVerdict(base, strategy)
    );
  }
  return verdicts;
}

/** What the model is told after a plan, so it acts on the verdicts. */
export function verdictsMessage(judged: FieldVerdict[]): string {
  if (judged.length === 0) {
    return 'Plan shown. Now prepare the actions that carry it out.';
  }
  return [
    'Plan shown. The calculated fields it adds, judged against the guidance:',
    ...judged.map((f) => `- ${f.name}: ${f.verdict}. ${f.note}`),
    judged.some((f) => f.verdict === 'use-column')
      ? 'Drop the use-column fields from what you prepare and read the existing column instead; show the plan again if that changes it.'
      : '',
    judged.some((f) => f.verdict === 'push-down')
      ? 'Suggest the push-down fields to the person as a follow-up: materialise them in the source.'
      : '',
    judged.some((f) => f.verdict === 'dataset')
      ? 'Suggest the dataset fields to the person as a follow-up: move them into the QuickSight dataset.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
