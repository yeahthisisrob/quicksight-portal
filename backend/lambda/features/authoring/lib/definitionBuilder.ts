/**
 * Build a definition from nothing: the datasets it reads and the visuals
 * it shows, described by column names rather than QuickSight JSON. Field
 * wells follow the visual type (the same roles the retype op uses), a
 * column's type decides whether it is a date, a category or a measure, and
 * the sheet is laid out by fixed rules (see layoutSheet), so a model only
 * says what to show, never how big. Filters are by column name too; each
 * gets a control in the sheet's control bar, where QuickSight puts them by
 * default (definitionFilters, controlBar). Anything that cannot be built (an
 * unknown dataset, a column the dataset does not have, a visual left with
 * no values) is left out and said so.
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import type { TargetColumn } from './columnResolution';
import { controlBar } from './controlBar';
import { buildFilters, type FilterSpec } from './definitionFilters';
import { type EditableVisualType, GRID_COLUMNS } from './definitionOps';
import { reflow } from './definitionTemplate';

export type { FilterSpec } from './definitionFilters';

export type BuildableVisualType = EditableVisualType | 'KPI';
type Aggregation = 'SUM' | 'AVERAGE' | 'COUNT' | 'DISTINCT_COUNT' | 'MIN' | 'MAX';
type DateGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface BuilderDataset {
  identifier: string;
  dataSetArn: string;
  columns: TargetColumn[];
}

export interface VisualSpec {
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
}

interface BuildResult {
  definition: Record<string, any>;
  warnings: string[];
}

const ID_LENGTH = 8;
/**
 * The layout rules, in grid units (36 columns wide): KPIs in a band at
 * the top (controls are in the control bar, not on the canvas), sharing the
 * width (at most four to a row); charts two to a row, a chart left alone
 * on its row taking the full width; tables and pivot tables full width
 * and tall, last, because detail reads best across the page.
 */
const KPI_ROW_HEIGHT = 6;
const KPIS_PER_ROW = 4;
const CHART_TILE = { colSpan: GRID_COLUMNS / 2, rowSpan: 12 };
const WIDE_CHART_TILE = { colSpan: GRID_COLUMNS, rowSpan: 14 };
const TABLE_TILE = { colSpan: GRID_COLUMNS, rowSpan: 18 };
const DETAIL_TYPES = new Set<BuildableVisualType>(['Table', 'PivotTable']);
const MAX_VISUALS = 60;
const NUMERIC = new Set(['INTEGER', 'DECIMAL']);

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

type Tile = { colSpan: number; rowSpan: number };

/** Place a sheet's visuals on the canvas by the rules above. */
function layoutSheet(visuals: Array<{ id: string; type: BuildableVisualType }>): any[] {
  const elements: any[] = [];
  let row = 0;
  const band = (items: Array<{ id: string; tile: Tile }>, type: string) => {
    if (items.length === 0) return;
    const placed = reflow(items, row);
    elements.push(...placed.elements.map((e) => ({ ...e, ElementType: type })));
    row = placed.bottom;
  };
  const kpis = visuals.filter((v) => v.type === 'KPI');
  const kpiWidth = Math.floor(GRID_COLUMNS / Math.min(Math.max(kpis.length, 1), KPIS_PER_ROW));
  band(
    kpis.map((v) => ({ id: v.id, tile: { colSpan: kpiWidth, rowSpan: KPI_ROW_HEIGHT } })),
    'VISUAL'
  );
  const charts = visuals.filter((v) => v.type !== 'KPI' && !DETAIL_TYPES.has(v.type));
  band(
    charts.map((v, i) => ({
      id: v.id,
      // The last chart of an odd count has its row to itself.
      tile: i === charts.length - 1 && charts.length % 2 === 1 ? WIDE_CHART_TILE : CHART_TILE,
    })),
    'VISUAL'
  );
  band(
    visuals.filter((v) => DETAIL_TYPES.has(v.type)).map((v) => ({ id: v.id, tile: TABLE_TILE })),
    'VISUAL'
  );
  return elements;
}

export function buildDefinition(input: {
  datasets: BuilderDataset[];
  visuals: VisualSpec[];
  filters?: FilterSpec[];
  sheetName?: string;
}): BuildResult {
  if (input.datasets.length === 0) {
    throw new ValidationError('At least one dataset is required');
  }
  const warnings: string[] = [];
  const byIdentifier = new Map(input.datasets.map((d) => [d.identifier, d]));
  const columnOf = (identifier: string, name: string): TargetColumn | undefined =>
    byIdentifier.get(identifier)?.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());

  const visuals: any[] = [];
  const placed: Array<{ id: string; type: BuildableVisualType }> = [];
  for (const spec of input.visuals.slice(0, MAX_VISUALS)) {
    const wrapper = WRAPPER[spec.type];
    if (!wrapper) {
      warnings.push(`'${spec.title}' skipped: '${spec.type}' is not a type that can be built.`);
      continue;
    }
    if (!byIdentifier.has(spec.identifier)) {
      warnings.push(`'${spec.title}' skipped: no dataset '${spec.identifier}'.`);
      continue;
    }
    const visualId = newId('vis');
    const wells: Record<string, any[]> = {};
    let fieldIndex = 0;
    if (spec.type !== 'KPI' && spec.category) {
      const column = columnOf(spec.identifier, spec.category);
      if (column) {
        wells[wrapper.dimension] = [
          dimensionField(visualId, spec.identifier, column, fieldIndex++, spec.granularity),
        ];
      } else {
        warnings.push(
          `'${spec.title}': column '${spec.category}' is not in '${spec.identifier}', so it has no category.`
        );
      }
    }
    const values: any[] = [];
    for (const value of spec.values) {
      const column = columnOf(spec.identifier, value.column);
      if (!column) {
        warnings.push(
          `'${spec.title}': column '${value.column}' is not in '${spec.identifier}' and was left out.`
        );
        continue;
      }
      values.push(measureField(visualId, spec.identifier, column, fieldIndex++, value.aggregation));
    }
    if (values.length === 0) {
      warnings.push(`'${spec.title}' skipped: none of its values exist.`);
      continue;
    }
    wells[wrapper.values] = values;
    if (spec.type !== 'KPI' && spec.color && wrapper.color) {
      const column = columnOf(spec.identifier, spec.color);
      if (column) {
        wells[wrapper.color] = [dimensionField(visualId, spec.identifier, column, fieldIndex++)];
      } else {
        warnings.push(
          `'${spec.title}': colour column '${spec.color}' is not in '${spec.identifier}'.`
        );
      }
    }

    const config: Record<string, any> =
      spec.type === 'KPI' ? { FieldWells: wells } : { FieldWells: { [wrapper.wells]: wells } };
    if (spec.type === 'ColumnChart') config.Orientation = 'VERTICAL';
    if (spec.type === 'BarChart') config.Orientation = 'HORIZONTAL';
    if (spec.type === 'DonutChart')
      config.DonutOptions = { ArcOptions: { ArcThickness: 'MEDIUM' } };
    if (spec.type === 'PieChart') config.DonutOptions = { ArcOptions: { ArcThickness: 'WHOLE' } };

    visuals.push({
      [wrapper.key]: {
        VisualId: visualId,
        Title: { Visibility: 'VISIBLE', FormatText: { PlainText: spec.title } },
        ChartConfiguration: config,
      },
    });
    placed.push({ id: visualId, type: spec.type });
  }

  const sheetId = newId('sheet');
  const filters = buildFilters(sheetId, input.filters ?? [], columnOf);
  warnings.push(...filters.warnings);

  const sheet: Record<string, any> = {
    SheetId: sheetId,
    Name: input.sheetName?.trim() || 'Overview',
    Visuals: visuals,
    Layouts: [{ Configuration: { GridLayout: { Elements: layoutSheet(placed) } } }],
  };
  if (filters.filterControls.length > 0) {
    sheet.FilterControls = filters.filterControls;
    sheet.SheetControlLayouts = controlBar(
      filters.controlIds.map((id, i) => ({ id, type: 'FILTER_CONTROL', span: filters.spans[i] }))
    );
  }
  const definition: Record<string, any> = {
    DataSetIdentifierDeclarations: input.datasets.map((d) => ({
      Identifier: d.identifier,
      DataSetArn: d.dataSetArn,
    })),
    Sheets: [sheet],
    AnalysisDefaults: { DefaultNewSheetConfiguration: { SheetContentType: 'INTERACTIVE' } },
  };
  if (filters.filterGroups.length > 0) {
    definition.FilterGroups = filters.filterGroups;
  }
  if (visuals.length === 0) {
    warnings.push('No visual could be built; the sheet is empty.');
  }
  return { definition, warnings };
}
