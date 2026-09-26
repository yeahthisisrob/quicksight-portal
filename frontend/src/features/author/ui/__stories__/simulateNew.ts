/**
 * A story-side stand-in for the server's from-nothing builder: turns a
 * NewAssetRequest into a grid definition the way the authoring slice does
 * (KPIs first in a band, everything else in standard tiles), with the
 * plain-language change list and the warnings the UI expects.
 */
import { buildWireframeModel } from '@/entities/definition';

import type {
  DefinitionChange,
  NewAssetPreview,
  NewAssetRequest,
  VisualSpec,
} from '@/shared/api/modules/authoring';

import { outlineFromModel } from '../../lib/ops';
import type { DatasetColumn } from '../../model/newAsset';
import { describeVisual } from '../../model/newAsset';

type Json = Record<string, any>;

const GRID_COLUMNS = 36;
const KPI_TILE = { cols: 9, rows: 6 };
const TILE = { cols: 18, rows: 12 };
const SHEET_ID = 'sheet-main';

const column = (identifier: string, name: string) => ({
  DataSetIdentifier: identifier,
  ColumnName: name,
});

function dimension(spec: VisualSpec, name: string, columns: DatasetColumn[]): Json {
  const type = columns.find((c) => c.name === name)?.type;
  if (type === 'DATETIME') {
    return {
      DateDimensionField: {
        FieldId: name,
        Column: column(spec.identifier, name),
        DateGranularity: spec.granularity ?? 'MONTH',
      },
    };
  }
  return { CategoricalDimensionField: { FieldId: name, Column: column(spec.identifier, name) } };
}

function measure(spec: VisualSpec, value: VisualSpec['values'][number]): Json {
  const aggregation = value.aggregation ?? 'SUM';
  if (aggregation === 'COUNT' || aggregation === 'DISTINCT_COUNT') {
    return {
      CategoricalMeasureField: {
        FieldId: value.column,
        Column: column(spec.identifier, value.column),
        AggregationFunction: aggregation,
      },
    };
  }
  return {
    NumericalMeasureField: {
      FieldId: value.column,
      Column: column(spec.identifier, value.column),
      AggregationFunction: { SimpleNumericalAggregation: aggregation },
    },
  };
}

function fieldWells(spec: VisualSpec, columns: DatasetColumn[]): Json {
  const values = spec.values.map((v) => measure(spec, v));
  const category = spec.category ? [dimension(spec, spec.category, columns)] : [];
  const color = spec.color ? [dimension(spec, spec.color, columns)] : [];
  switch (spec.type) {
    case 'KPI':
      return { Values: values };
    case 'Table':
      return { TableAggregatedFieldWells: { GroupBy: [...category, ...color], Values: values } };
    case 'PivotTable':
      return { PivotTableAggregatedFieldWells: { Rows: category, Columns: color, Values: values } };
    case 'PieChart':
    case 'DonutChart':
      return { PieChartAggregatedFieldWells: { Category: category, Values: values } };
    default:
      return {
        [`${spec.type}AggregatedFieldWells`]: { Category: category, Values: values, Colors: color },
      };
  }
}

const visualId = (index: number, spec: VisualSpec) =>
  `${spec.type.toLowerCase()}-${index}-${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

interface Placed {
  id: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/** KPIs in a band at the top, then the rest, left to right, wrapping. */
function reflow(specs: Array<{ id: string; kpi: boolean }>, startRow = 0): Placed[] {
  const out: Placed[] = [];
  let col = 0;
  let row = startRow;
  let bandHeight = 0;
  for (const { id, kpi } of specs) {
    const tile = kpi ? KPI_TILE : TILE;
    if (col + tile.cols > GRID_COLUMNS) {
      col = 0;
      row += bandHeight;
      bandHeight = 0;
    }
    out.push({ id, col, row, colSpan: tile.cols, rowSpan: tile.rows });
    col += tile.cols;
    bandHeight = Math.max(bandHeight, tile.rows);
  }
  return out;
}

interface SimulatedNew extends NewAssetPreview {}

/**
 * Build what the server would: unknown columns are warned about and their
 * visuals skipped; a template adds a title band above the visuals.
 */
export function simulateNew(
  request: NewAssetRequest,
  columnsById: Record<string, DatasetColumn[]>,
  proposed?: { visuals: VisualSpec[]; reason: string; model: { provider: string; model: string } }
): SimulatedNew {
  const changes: DefinitionChange[] = [];
  const warnings: string[] = [];
  const sheetName = request.sheetName?.trim() || 'Sheet 1';
  const byIdentifier = new Map(
    request.datasets.map((d) => [d.identifier, columnsById[d.dataSetId] ?? []])
  );
  const visuals = request.visuals?.length ? request.visuals : (proposed?.visuals ?? []);

  const kept: Array<{ spec: VisualSpec; id: string }> = [];
  visuals.forEach((spec, index) => {
    const columns = byIdentifier.get(spec.identifier);
    if (!columns) {
      warnings.push(`${spec.title}: dataset '${spec.identifier}' is not declared; skipped.`);
      return;
    }
    const named = [spec.category, spec.color, ...spec.values.map((v) => v.column)].filter(
      (c): c is string => Boolean(c)
    );
    const unknown =
      columns.length > 0 ? named.filter((c) => !columns.some((k) => k.name === c)) : [];
    if (unknown.length > 0) {
      warnings.push(
        `${spec.title}: ${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not in '${spec.identifier}'; skipped.`
      );
      return;
    }
    kept.push({ spec, id: visualId(index, spec) });
  });

  // KPIs lead, in the order given; the rest follow in theirs.
  const ordered = [
    ...kept.filter((k) => k.spec.type === 'KPI'),
    ...kept.filter((k) => k.spec.type !== 'KPI'),
  ];
  const hasTemplate = Boolean(request.template);
  const bandRows = hasTemplate ? 2 : 0;
  const placed = reflow(
    ordered.map((k) => ({ id: k.id, kpi: k.spec.type === 'KPI' })),
    bandRows
  );

  const sheet: Json = {
    SheetId: SHEET_ID,
    Name: hasTemplate ? 'Standard overview' : sheetName,
    Visuals: ordered.map(({ spec, id }) => ({
      [`${spec.type}Visual`]: {
        VisualId: id,
        Title: { Visibility: 'VISIBLE', FormatText: { PlainText: spec.title } },
        ChartConfiguration: { FieldWells: fieldWells(spec, byIdentifier.get(spec.identifier)!) },
      },
    })),
    TextBoxes: hasTemplate
      ? [
          {
            SheetTextBoxId: 'text-band',
            Content:
              '<block><inline><b>Standard</b> - title band from the template.</inline></block>',
          },
        ]
      : [],
    Layouts: [
      {
        Configuration: {
          GridLayout: {
            CanvasSizeOptions: {
              ScreenCanvasSizeOptions: { ResizeOption: 'FIXED', OptimizedViewPortWidth: '1600px' },
            },
            Elements: [
              ...(hasTemplate
                ? [
                    {
                      ElementId: 'text-band',
                      ElementType: 'TEXT_BOX',
                      ColumnIndex: 0,
                      RowIndex: 0,
                      ColumnSpan: GRID_COLUMNS,
                      RowSpan: bandRows,
                    },
                  ]
                : []),
              ...placed.map((p) => ({
                ElementId: p.id,
                ElementType: 'VISUAL',
                ColumnIndex: p.col,
                RowIndex: p.row,
                ColumnSpan: p.colSpan,
                RowSpan: p.rowSpan,
              })),
            ],
          },
        },
      },
    ],
  };

  const definition: Json = {
    DataSetIdentifierDeclarations: request.datasets.map((d) => ({
      Identifier: d.identifier,
      DataSetArn: `arn:aws:quicksight:us-east-1:1:dataset/${d.dataSetId}`,
    })),
    Sheets: [sheet],
    CalculatedFields: (request.addCalculatedFields ?? []).map((f) => ({
      DataSetIdentifier: f.identifier,
      Name: f.name,
      Expression: f.expression,
    })),
  };

  for (const { spec, id } of ordered) {
    changes.push({
      kind: 'visual',
      sheetId: SHEET_ID,
      elementId: id,
      description: `Added ${describeVisual(spec)}`,
    });
  }
  for (const f of request.addCalculatedFields ?? []) {
    changes.push({
      kind: 'calculatedField',
      description: `Calculated field ${f.name} added to "${f.identifier}"`,
    });
  }
  if (hasTemplate) {
    changes.push({
      kind: 'template',
      sheetId: SHEET_ID,
      description: `Laid out ${ordered.length} visuals on Standard overview in ${TILE.cols}x${TILE.rows} tiles (KPIs ${KPI_TILE.cols}x${KPI_TILE.rows} first), with 1 element from the template`,
    });
    changes.push({ kind: 'template', description: "Takes the template's theme" });
  }

  return {
    definition,
    outline: outlineFromModel(buildWireframeModel(definition)),
    changes,
    warnings,
    visuals,
    filters: request.filters ?? [],
    ...(request.visuals?.length || !proposed
      ? {}
      : { proposal: { reason: proposed.reason, model: proposed.model } }),
    ...(hasTemplate ? { themeArn: 'arn:aws:quicksight:us-east-1:1:theme/standard' } : {}),
  };
}
