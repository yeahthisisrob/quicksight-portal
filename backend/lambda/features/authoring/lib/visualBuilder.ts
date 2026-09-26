/**
 * One visual from a description by column names: field wells follow the
 * visual type, and a column's type decides whether it is a date, a category
 * or a measure. Shared by the builder (a sheet from nothing) and the addVisual
 * edit op. A column the dataset does not have is an error, never a visual
 * quietly missing a field.
 */
import { randomUUID } from 'node:crypto';

import type { TargetColumn } from './columnResolution';
import type { EditableVisualType } from './definitionOps';
import { GRID_COLUMNS, type Tile } from './grid';
import type { VisualActionSpec } from './visualActions';

export type BuildableVisualType = EditableVisualType | 'KPI';
type Aggregation = 'SUM' | 'AVERAGE' | 'COUNT' | 'DISTINCT_COUNT' | 'MIN' | 'MAX';
type DateGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface VisualSpec {
  /** How filters and actions refer to this visual; its title when omitted. */
  key?: string;
  type: BuildableVisualType;
  title: string;
  /** The dataset identifier every column below belongs to. */
  identifier: string;
  /** The dimension: category axis, group-by, pivot rows. Not for KPI. */
  category?: string;
  granularity?: DateGranularity;
  values: Array<{ column: string; aggregation?: Aggregation }>;
  /** A second dimension: colours, pivot columns. */
  color?: string;
  /** Interactions: a click that filters other visuals, or opens a sheet. */
  actions?: VisualActionSpec[];
}

const ID_LENGTH = 8;
const NUMERIC = new Set(['INTEGER', 'DECIMAL']);

/**
 * Tile sizes (grid units): charts half the width, a chart alone on its row
 * the full width; tables and pivot tables full width and tall.
 */
export const CHART_TILE = { colSpan: GRID_COLUMNS / 2, rowSpan: 12 };
export const WIDE_CHART_TILE = { colSpan: GRID_COLUMNS, rowSpan: 14 };
export const TABLE_TILE = { colSpan: GRID_COLUMNS, rowSpan: 18 };
export const DETAIL_TYPES = new Set<BuildableVisualType>(['Table', 'PivotTable']);

/** The tile a visual of this type gets when it is placed. */
export function tileFor(type: BuildableVisualType): Tile {
  return DETAIL_TYPES.has(type) ? TABLE_TILE : CHART_TILE;
}

const WRAPPER: Record<
  BuildableVisualType,
  { key: string; wells: string; dimension: string; values: string; color?: string }
> = {
  BarChart: {
    key: 'BarChartVisual',
    wells: 'BarChartAggregatedFieldWells',
    dimension: 'Category',
    values: 'Values',
    color: 'Colors',
  },
  ColumnChart: {
    key: 'BarChartVisual',
    wells: 'BarChartAggregatedFieldWells',
    dimension: 'Category',
    values: 'Values',
    color: 'Colors',
  },
  LineChart: {
    key: 'LineChartVisual',
    wells: 'LineChartAggregatedFieldWells',
    dimension: 'Category',
    values: 'Values',
    color: 'Colors',
  },
  PieChart: {
    key: 'PieChartVisual',
    wells: 'PieChartAggregatedFieldWells',
    dimension: 'Category',
    values: 'Values',
  },
  DonutChart: {
    key: 'PieChartVisual',
    wells: 'PieChartAggregatedFieldWells',
    dimension: 'Category',
    values: 'Values',
  },
  Table: {
    key: 'TableVisual',
    wells: 'TableAggregatedFieldWells',
    dimension: 'GroupBy',
    values: 'Values',
  },
  PivotTable: {
    key: 'PivotTableVisual',
    wells: 'PivotTableAggregatedFieldWells',
    dimension: 'Rows',
    values: 'Values',
    color: 'Columns',
  },
  KPI: { key: 'KPIVisual', wells: '', dimension: '', values: 'Values' },
};

export const BUILDABLE_VISUAL_TYPES = Object.keys(WRAPPER) as BuildableVisualType[];

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, ID_LENGTH)}`;
}

function dimensionField(
  visualId: string,
  identifier: string,
  column: TargetColumn,
  index: number,
  granularity?: DateGranularity
) {
  const base = {
    FieldId: `${visualId}.${column.name}.${index}`,
    Column: { DataSetIdentifier: identifier, ColumnName: column.name },
  };
  return column.type === 'DATETIME'
    ? { DateDimensionField: { ...base, DateGranularity: granularity ?? 'MONTH' } }
    : { CategoricalDimensionField: base };
}

function measureField(
  visualId: string,
  identifier: string,
  column: TargetColumn,
  index: number,
  aggregation?: Aggregation
) {
  const base = {
    FieldId: `${visualId}.${column.name}.${index}`,
    Column: { DataSetIdentifier: identifier, ColumnName: column.name },
  };
  if (NUMERIC.has(column.type ?? '')) {
    return {
      NumericalMeasureField: {
        ...base,
        AggregationFunction: { SimpleNumericalAggregation: aggregation ?? 'SUM' },
      },
    };
  }
  if (column.type === 'DATETIME') {
    return {
      DateMeasureField: {
        ...base,
        AggregationFunction: aggregation === 'MIN' || aggregation === 'MAX' ? aggregation : 'COUNT',
      },
    };
  }
  return {
    CategoricalMeasureField: {
      ...base,
      AggregationFunction: aggregation === 'DISTINCT_COUNT' ? 'DISTINCT_COUNT' : 'COUNT',
    },
  };
}

/** The visual, its id and its inner object (where actions go), or why it cannot be built. */
export function buildVisual(
  spec: VisualSpec,
  columnOf: (identifier: string, name: string) => TargetColumn | undefined
): { visual: Record<string, any>; id: string; inner: Record<string, any> } | { error: string } {
  const wrapper = WRAPPER[spec.type];
  if (!wrapper) {
    return { error: `'${spec.title}': '${spec.type}' is not a type that can be built.` };
  }
  const visualId = newId('vis');
  const wells: Record<string, any[]> = {};
  let fieldIndex = 0;
  const missing: string[] = [];
  if (spec.type !== 'KPI' && spec.category) {
    const column = columnOf(spec.identifier, spec.category);
    if (column) {
      wells[wrapper.dimension] = [
        dimensionField(visualId, spec.identifier, column, fieldIndex++, spec.granularity),
      ];
    } else {
      missing.push(spec.category);
    }
  }
  const values: any[] = [];
  for (const value of spec.values) {
    const column = columnOf(spec.identifier, value.column);
    if (column) {
      values.push(measureField(visualId, spec.identifier, column, fieldIndex++, value.aggregation));
    } else {
      missing.push(value.column);
    }
  }
  if (spec.type !== 'KPI' && spec.color && wrapper.color) {
    const column = columnOf(spec.identifier, spec.color);
    if (column) {
      wells[wrapper.color] = [dimensionField(visualId, spec.identifier, column, fieldIndex++)];
    } else {
      missing.push(spec.color);
    }
  }
  if (missing.length > 0) {
    return {
      error: `'${spec.title}': ${missing.map((c) => `'${c}'`).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not in '${spec.identifier}'.`,
    };
  }
  if (values.length === 0) {
    return { error: `'${spec.title}' has no values to show.` };
  }
  wells[wrapper.values] = values;

  const config: Record<string, any> =
    spec.type === 'KPI' ? { FieldWells: wells } : { FieldWells: { [wrapper.wells]: wells } };
  if (spec.type === 'ColumnChart') config.Orientation = 'VERTICAL';
  if (spec.type === 'BarChart') config.Orientation = 'HORIZONTAL';
  if (spec.type === 'DonutChart') config.DonutOptions = { ArcOptions: { ArcThickness: 'MEDIUM' } };
  if (spec.type === 'PieChart') config.DonutOptions = { ArcOptions: { ArcThickness: 'WHOLE' } };

  const inner = {
    VisualId: visualId,
    Title: { Visibility: 'VISIBLE', FormatText: { PlainText: spec.title } },
    ChartConfiguration: config,
  };
  return { visual: { [wrapper.key]: inner }, id: visualId, inner };
}
