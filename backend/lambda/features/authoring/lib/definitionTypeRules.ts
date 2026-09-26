/**
 * Type rules: conversions applied to every visual at once during a
 * migration, instead of one retype op per visual.
 *
 * - chart family swaps: table to pivot, bar to column, pie to donut and the
 *   reverse, wherever the field wells translate (each one is the same
 *   retype the inspector does; a visual whose wells do not fit is left
 *   alone and said so);
 * - KPI standardisation: gauges become KPIs, and every KPI takes the
 *   template's KPI options (sparkline, comparison, progress bar);
 * - column casts: where the dataset a definition now reads has a column of
 *   a different type than the definition was built for, a calculated field
 *   with the cast is added and the visuals read it instead.
 */
import { ValidationError } from '../../../shared/errors/ValidationError';
import type { AddedCalculatedField, DatasetRebindPlan } from '../types';
import type { TargetColumn } from './columnResolution';
import {
  applyOps,
  type DefinitionChange,
  EDITABLE_VISUAL_TYPES,
  type EditableVisualType,
} from './definitionOps';
import { renameColumns } from './definitionRebind';

interface ChartFamilyRule {
  from: EditableVisualType;
  to: EditableVisualType;
}

export interface TypeRules {
  chartFamily?: ChartFamilyRule[];
  /** Gauges become KPIs; every KPI takes the template's KPI options. */
  kpi?: boolean;
  /** Cast calculated fields where the target column type differs. */
  casts?: boolean;
}

interface TypeRulesResult {
  definition: Record<string, any>;
  changes: DefinitionChange[];
  warnings: string[];
}

const KPI_KEY = 'KPIVisual';
const GAUGE_KEY = 'GaugeChartVisual';

function visualEntry(wrapper: any): [string, any] | null {
  const entry = Object.entries(wrapper ?? {}).find(([, body]) => body && typeof body === 'object');
  return entry ? [entry[0], entry[1]] : null;
}

/** The editable type a visual currently is, or null when it is not one of them. */
export function currentEditableType(key: string, body: any): EditableVisualType | null {
  switch (key) {
    case 'BarChartVisual':
      return body?.ChartConfiguration?.Orientation === 'VERTICAL' ? 'ColumnChart' : 'BarChart';
    case 'LineChartVisual':
      return 'LineChart';
    case 'PieChartVisual': {
      const thickness = body?.ChartConfiguration?.DonutOptions?.ArcOptions?.ArcThickness;
      return thickness && thickness !== 'WHOLE' ? 'DonutChart' : 'PieChart';
    }
    case 'TableVisual':
      return 'Table';
    case 'PivotTableVisual':
      return 'PivotTable';
    default:
      return null;
  }
}

function titleOf(body: any): string {
  return body?.Title?.FormatText?.PlainText ?? body?.VisualId ?? 'a visual';
}

export function applyTypeRules(
  input: Record<string, any>,
  rules: TypeRules,
  context: { templateKpiOptions?: Record<string, any> } = {}
): TypeRulesResult {
  let definition = structuredClone(input);
  const changes: DefinitionChange[] = [];
  const warnings: string[] = [];

  // 1. Chart family swaps, one retype per matching visual.
  for (const rule of rules.chartFamily ?? []) {
    if (!EDITABLE_VISUAL_TYPES.includes(rule.from) || !EDITABLE_VISUAL_TYPES.includes(rule.to)) {
      throw new ValidationError(
        `Chart family rule ${rule.from} -> ${rule.to}: types must be one of ${EDITABLE_VISUAL_TYPES.join(', ')}`
      );
    }
    if (rule.from === rule.to) continue;
    for (const sheet of definition.Sheets ?? []) {
      for (const wrapper of [...(sheet.Visuals ?? [])]) {
        const entry = visualEntry(wrapper);
        if (!entry || currentEditableType(entry[0], entry[1]) !== rule.from) continue;
        try {
          const result = applyOps(definition, [
            {
              op: 'retype',
              sheetId: sheet.SheetId,
              elementId: entry[1].VisualId,
              visualType: rule.to,
            },
          ]);
          definition = result.definition;
          changes.push(...result.changes);
        } catch (error) {
          warnings.push(
            `${titleOf(entry[1])} stayed a ${rule.from}: ${error instanceof Error ? error.message.replace(/^Op \d+: /, '') : 'its fields do not fit'}`
          );
        }
      }
    }
  }

  // 2. KPI standardisation.
  if (rules.kpi) {
    for (const sheet of definition.Sheets ?? []) {
      sheet.Visuals = (sheet.Visuals ?? []).map((wrapper: any) => {
        const entry = visualEntry(wrapper);
        if (!entry) return wrapper;
        const [key, body] = entry;
        if (key === GAUGE_KEY) {
          const wells = body.ChartConfiguration?.FieldWells ?? {};
          const next = {
            [KPI_KEY]: {
              VisualId: body.VisualId,
              ...(body.Title ? { Title: body.Title } : {}),
              ...(body.Subtitle ? { Subtitle: body.Subtitle } : {}),
              ChartConfiguration: {
                FieldWells: {
                  ...(wells.Values ? { Values: wells.Values } : {}),
                  ...(wells.TargetValues ? { TargetValues: wells.TargetValues } : {}),
                },
                ...(context.templateKpiOptions
                  ? { KPIOptions: structuredClone(context.templateKpiOptions) }
                  : {}),
              },
              ...(body.Actions ? { Actions: body.Actions } : {}),
            },
          };
          changes.push({
            kind: 'visual',
            sheetId: sheet.SheetId,
            elementId: body.VisualId,
            description: `Changed ${titleOf(body)} from a gauge to a KPI${context.templateKpiOptions ? " with the template's KPI options" : ''}`,
          });
          return next;
        }
        if (key === KPI_KEY && context.templateKpiOptions) {
          body.ChartConfiguration = {
            ...(body.ChartConfiguration ?? {}),
            KPIOptions: structuredClone(context.templateKpiOptions),
          };
          changes.push({
            kind: 'visual',
            sheetId: sheet.SheetId,
            elementId: body.VisualId,
            description: `${titleOf(body)} takes the template's KPI options`,
          });
        }
        return wrapper;
      });
    }
  }

  return { definition, changes, warnings };
}

/** QuickSight column types, as OutputColumns report them. */
type ColumnType = 'STRING' | 'INTEGER' | 'DECIMAL' | 'DATETIME';

/** The expression that turns the target's type into what the definition expects, or null when none is needed or known. */
export function castExpression(
  column: string,
  from: ColumnType | string,
  to: ColumnType | string
): string | null {
  if (from === to) return null;
  if ((from === 'INTEGER' && to === 'DECIMAL') || (from === 'DECIMAL' && to === 'INTEGER'))
    return null;
  const ref = `{${column}}`;
  switch (to) {
    case 'DATETIME':
      return from === 'STRING'
        ? `parseDate(${ref})`
        : from === 'INTEGER'
          ? `epochDate(${ref})`
          : null;
    case 'DECIMAL':
      return from === 'STRING' ? `parseDecimal(${ref})` : null;
    case 'INTEGER':
      return from === 'STRING' ? `parseInt(${ref})` : null;
    case 'STRING':
      return `toString(${ref})`;
    default:
      return null;
  }
}

interface CastPlan {
  addCalculatedFields: AddedCalculatedField[];
  /** identifier -> target column name -> cast field name */
  renames: Map<string, Record<string, string>>;
  changes: DefinitionChange[];
  warnings: string[];
}

/**
 * Casts for a rebind plan: for every column that resolved to a target column
 * of a different type than the current dataset had, a calculated field that
 * casts the target column back, and the rename that makes visuals read it.
 */
export function castPlan(
  datasets: DatasetRebindPlan[],
  currentColumns: Map<string, TargetColumn[]>
): CastPlan {
  const plan: CastPlan = { addCalculatedFields: [], renames: new Map(), changes: [], warnings: [] };
  for (const dataset of datasets) {
    const current = new Map(
      (currentColumns.get(dataset.identifier) ?? []).map((c) => [c.name, c.type])
    );
    for (const column of dataset.columns) {
      if (!column.resolvedTo || !column.targetType) continue;
      const wanted = current.get(column.name);
      if (!wanted || wanted === column.targetType) continue;
      const expression = castExpression(column.resolvedTo, column.targetType, wanted);
      if (!expression) {
        if (
          !(wanted === 'DECIMAL' && column.targetType === 'INTEGER') &&
          !(wanted === 'INTEGER' && column.targetType === 'DECIMAL')
        ) {
          plan.warnings.push(
            `${dataset.identifier}: ${column.name} was ${wanted} and is now ${column.targetType}; no cast is known, visuals may fail.`
          );
        }
        continue;
      }
      const name = `${column.resolvedTo}_as_${wanted.toLowerCase()}`;
      plan.addCalculatedFields.push({ identifier: dataset.identifier, name, expression });
      const map = plan.renames.get(dataset.identifier) ?? {};
      map[column.resolvedTo] = name;
      plan.renames.set(dataset.identifier, map);
      plan.changes.push({
        kind: 'calculatedField',
        description: `${dataset.identifier}: ${column.resolvedTo} is ${column.targetType} now, so ${name} = ${expression} takes its place`,
      });
    }
  }
  return plan;
}

/** Point every reference at the cast fields. Leaves the cast fields' own expressions alone. */
export function applyCastRenames(
  definition: Record<string, any>,
  renames: Map<string, Record<string, string>>
): void {
  for (const [identifier, map] of renames) {
    renameColumns(definition.Sheets, identifier, map);
    renameColumns(definition.FilterGroups, identifier, map);
    renameColumns(definition.ParameterDeclarations, identifier, map);
    renameColumns(definition.ColumnConfigurations, identifier, map);
  }
}
