import { describe, expect, it } from 'vitest';

import {
  emptyDefinition,
  freeFormDefinition,
  gridDashboardDefinition,
  paginatedReportDefinition,
  twoSheetAnalysisDefinition,
} from '../__fixtures__/definitions';
import { buildWireframeModel } from '../wireframeModel';

const byId = <T extends { id: string }>(elements: T[], id: string) =>
  elements.find((e) => e.id === id);

describe('buildWireframeModel', () => {
  describe('grid layout', () => {
    const model = buildWireframeModel(gridDashboardDefinition);
    const [sheet] = model.sheets;

    it('reads sheets, datasets and the summary counts', () => {
      expect(model.sheets).toHaveLength(1);
      expect(sheet.id).toBe('sheet-overview');
      expect(sheet.name).toBe('Overview');
      expect(sheet.layout).toBe('grid');
      expect(sheet.canvasWidth).toBe(1600);
      expect(model.datasets).toEqual([
        { identifier: 'sales', dataSetId: 'sales-gold' },
        { identifier: 'targets', dataSetId: 'targets' },
      ]);
      expect(model.visualCount).toBe(5);
      expect(model.parameterCount).toBe(1);
      expect(model.filterGroupCount).toBe(2);
      expect(model.calculatedFieldCount).toBe(1);
    });

    it('places every laid-out element with its grid cell', () => {
      expect(sheet.elements.map((e) => e.id)).toEqual([
        'text-intro',
        'ctl-region',
        'kpi-revenue',
        'kpi-orders',
        'bar-region',
        'line-trend',
        'table-detail',
      ]);
      expect(byId(sheet.elements, 'bar-region')?.position).toEqual({
        type: 'grid',
        col: 18,
        colSpan: 18,
        row: 2,
        rowSpan: 10,
      });
    });

    it('types visuals, controls and text boxes from where they are defined', () => {
      expect(byId(sheet.elements, 'bar-region')).toMatchObject({
        kind: 'visual',
        visualType: 'BarChart',
        subtitle: 'Last 12 months',
      });
      expect(byId(sheet.elements, 'kpi-revenue')).toMatchObject({
        kind: 'visual',
        visualType: 'KPI',
      });
      expect(byId(sheet.elements, 'ctl-region')).toMatchObject({
        kind: 'filterControl',
        visualType: 'Dropdown',
        title: 'Region',
      });
      expect(byId(sheet.elements, 'text-intro')).toMatchObject({
        kind: 'textBox',
        title: 'Sales overview - refreshed nightly from the gold dataset.',
      });
    });

    it('strips rich-text markup from titles and keeps hidden titles flagged', () => {
      expect(byId(sheet.elements, 'bar-region')?.title).toBe('Revenue by region');
      expect(byId(sheet.elements, 'table-detail')).toMatchObject({
        title: 'Top customers',
        titleHidden: true,
      });
      expect(byId(sheet.elements, 'bar-region')?.titleHidden).toBeUndefined();
    });

    it('extracts field wells with aggregation, granularity and dataset', () => {
      expect(byId(sheet.elements, 'bar-region')?.fieldWells).toEqual([
        { role: 'Category', fields: [{ label: 'region', dataSetIdentifier: 'sales' }] },
        {
          role: 'Values',
          fields: [{ label: 'revenue', dataSetIdentifier: 'sales', aggregation: 'SUM' }],
        },
        { role: 'Colors', fields: [{ label: 'channel', dataSetIdentifier: 'sales' }] },
      ]);
      expect(byId(sheet.elements, 'line-trend')?.fieldWells[0]).toEqual({
        role: 'Category',
        fields: [{ label: 'order_date', dataSetIdentifier: 'sales', granularity: 'MONTH' }],
      });
    });

    it('handles KPI bare wells, string aggregations and percentiles', () => {
      const kpi = byId(sheet.elements, 'kpi-revenue');
      expect(kpi?.fieldWells.map((w) => w.role)).toEqual(['Values', 'TargetValues']);
      expect(kpi?.fieldWells[1].fields[0]).toMatchObject({
        label: 'target_revenue',
        dataSetIdentifier: 'targets',
      });

      expect(byId(sheet.elements, 'kpi-orders')?.fieldWells[0].fields[0].aggregation).toBe(
        'DISTINCT_COUNT'
      );
      const table = byId(sheet.elements, 'table-detail');
      expect(table?.fieldWells.find((w) => w.role === 'Values')?.fields[1].aggregation).toBe(
        'PERCENTILE(90)'
      );
    });

    it('puts SheetControlLayouts controls in the control bar, not the canvas', () => {
      expect(sheet.controlBar.map((e) => e.id)).toEqual(['ctl-date']);
      expect(sheet.controlBar[0]).toMatchObject({
        kind: 'filterControl',
        visualType: 'DateTimePicker',
        title: 'Order date',
      });
      expect(byId(sheet.elements, 'ctl-date')).toBeUndefined();
    });
  });

  describe('free-form layout', () => {
    const model = buildWireframeModel(freeFormDefinition);
    const [sheet] = model.sheets;

    it('parses pixel positions and the canvas width', () => {
      expect(sheet.layout).toBe('freeform');
      expect(sheet.canvasWidth).toBe(1200);
      expect(byId(sheet.elements, 'pie-mix')?.position).toEqual({
        type: 'freeform',
        x: 20,
        y: 100,
        width: 560,
        height: 360,
      });
    });

    it('recognises images and visuals without field wells', () => {
      expect(byId(sheet.elements, 'img-logo')).toMatchObject({
        kind: 'image',
        title: 'Company logo',
      });
      expect(byId(sheet.elements, 'insight-anomaly')).toMatchObject({
        kind: 'visual',
        visualType: 'Insight',
        fieldWells: [],
      });
      expect(byId(sheet.elements, 'gauge-attainment')?.fieldWells.map((w) => w.role)).toEqual([
        'Values',
        'TargetValues',
      ]);
    });
  });

  describe('multiple sheets', () => {
    const model = buildWireframeModel(twoSheetAnalysisDefinition);

    it('keeps sheet order and per-sheet elements', () => {
      expect(model.sheets.map((s) => s.name)).toEqual(['Summary', 'Detail']);
      expect(model.sheets[0].elements.map((e) => e.kind)).toEqual([
        'parameterControl',
        'visual',
        'visual',
      ]);
      expect(model.visualCount).toBe(4);
    });

    it('reads pivot rows/columns/values and combo bar/line wells', () => {
      const pivot = byId(model.sheets[1].elements, 'pivot-1');
      expect(pivot?.visualType).toBe('PivotTable');
      expect(pivot?.fieldWells.map((w) => [w.role, w.fields.length])).toEqual([
        ['Rows', 2],
        ['Columns', 1],
        ['Values', 1],
      ]);
      const combo = byId(model.sheets[0].elements, 'combo-1');
      expect(combo?.fieldWells.map((w) => w.role)).toEqual(['Category', 'BarValues', 'LineValues']);
    });
  });

  describe('section-based layout', () => {
    const model = buildWireframeModel(paginatedReportDefinition);
    const [sheet] = model.sheets;

    it('flattens header, body and footer sections with their role', () => {
      expect(sheet.layout).toBe('section');
      expect(sheet.elements.map((e) => [e.id, e.section?.role, e.section?.id])).toEqual([
        ['hdr-title', 'header', 'hdr'],
        ['tbl-summary', 'body', 'body-1'],
        ['bar-trend', 'body', 'body-2'],
        ['ftr-page', 'footer', 'ftr'],
      ]);
      expect(byId(sheet.elements, 'tbl-summary')?.position).toEqual({
        type: 'freeform',
        x: 0,
        y: 0,
        width: 612,
        height: 300,
      });
    });
  });

  describe('degraded input', () => {
    it('returns an empty model for an empty or nonsensical definition', () => {
      for (const input of [emptyDefinition, null, undefined, 42, 'nope', []]) {
        expect(buildWireframeModel(input)).toEqual({
          sheets: [],
          datasets: [],
          visualCount: 0,
          parameterCount: 0,
          filterGroupCount: 0,
          calculatedFieldCount: 0,
        });
      }
    });

    it('falls back to a flow layout when a sheet has no Layouts', () => {
      const model = buildWireframeModel({
        Sheets: [
          {
            SheetId: 's',
            Visuals: [{ FunnelChartVisual: { VisualId: 'v1' } }],
            FilterControls: [{ Slider: { FilterControlId: 'c1', Title: 'Amount' } }],
          },
        ],
      });
      const [sheet] = model.sheets;
      expect(sheet.name).toBe('Sheet 1');
      expect(sheet.layout).toBe('flow');
      expect(sheet.elements).toEqual([
        {
          id: 'v1',
          kind: 'visual',
          visualType: 'FunnelChart',
          title: undefined,
          titleHidden: undefined,
          subtitle: undefined,
          fieldWells: [],
          position: { type: 'flow', index: 0 },
        },
      ]);
      expect(sheet.controlBar[0]).toMatchObject({ id: 'c1', kind: 'filterControl' });
    });

    it('keeps an unknown visual type and an unmatched layout element as drawable', () => {
      const model = buildWireframeModel({
        Sheets: [
          {
            SheetId: 's',
            Name: 'X',
            Visuals: [
              {
                HologramVisual: {
                  VisualId: 'v-holo',
                  Title: { FormatText: { PlainText: '3D' } },
                  ChartConfiguration: { FieldWells: { Whatever: [{ NotAField: 1 }] } },
                },
              },
              { Garbage: 'not an object' },
              null,
            ],
            Layouts: [
              {
                Configuration: {
                  GridLayout: {
                    Elements: [
                      { ElementId: 'v-holo', ElementType: 'VISUAL', ColumnIndex: 0, RowIndex: 0 },
                      { ElementId: 'ghost', ElementType: 'FILTER_CONTROL' },
                      { ElementId: 'mystery', ElementType: 'SOMETHING_NEW' },
                    ],
                  },
                },
              },
            ],
          },
        ],
      });
      const [sheet] = model.sheets;
      expect(sheet.elements).toHaveLength(3);
      expect(sheet.elements[0]).toMatchObject({
        kind: 'visual',
        visualType: 'Hologram',
        title: '3D',
        fieldWells: [],
        position: { type: 'grid', col: 0, colSpan: 1, row: 0, rowSpan: 1 },
      });
      expect(sheet.elements[1]).toMatchObject({ id: 'ghost', kind: 'filterControl' });
      expect(sheet.elements[2]).toMatchObject({ id: 'mystery', kind: 'other' });
    });
  });
});

describe('grid tiles without indexes', () => {
  it('leaves col and row unset so the renderer flows them after the previous tile', () => {
    const model = buildWireframeModel({
      Sheets: [
        {
          SheetId: 's',
          Name: 'Flow',
          Visuals: [
            { KPIVisual: { VisualId: 'a', ChartConfiguration: {} } },
            { KPIVisual: { VisualId: 'b', ChartConfiguration: {} } },
          ],
          TextBoxes: [{ SheetTextBoxId: 't', Content: '<p>Hello</p>' }],
          Layouts: [
            {
              Configuration: {
                GridLayout: {
                  Elements: [
                    { ElementId: 'a', ElementType: 'VISUAL', ColumnSpan: 12, RowSpan: 6 },
                    { ElementId: 'b', ElementType: 'VISUAL', ColumnSpan: 12, RowSpan: 6 },
                    { ElementId: 't', ElementType: 'TEXT_BOX', ColumnSpan: 12, RowSpan: 6 },
                  ],
                },
              },
            },
          ],
        },
      ],
    });
    const positions = model.sheets[0]!.elements.map((e) => e.position);
    expect(positions).toEqual([
      { type: 'grid', colSpan: 12, rowSpan: 6 },
      { type: 'grid', colSpan: 12, rowSpan: 6 },
      { type: 'grid', colSpan: 12, rowSpan: 6 },
    ]);
    expect(model.sheets[0]!.elements[2]).toMatchObject({ kind: 'textBox', title: 'Hello' });
  });
});

describe('grid tiles without indexes', () => {
  it('leaves col and row unset so the renderer flows them after the previous tile', () => {
    const model = buildWireframeModel({
      Sheets: [
        {
          SheetId: 's',
          Name: 'Flow',
          Visuals: [
            { KPIVisual: { VisualId: 'a', ChartConfiguration: {} } },
            { KPIVisual: { VisualId: 'b', ChartConfiguration: {} } },
          ],
          TextBoxes: [{ SheetTextBoxId: 't', Content: '<p>Hello</p>' }],
          Layouts: [
            {
              Configuration: {
                GridLayout: {
                  Elements: [
                    { ElementId: 'a', ElementType: 'VISUAL', ColumnSpan: 12, RowSpan: 6 },
                    { ElementId: 'b', ElementType: 'VISUAL', ColumnSpan: 12, RowSpan: 6 },
                    { ElementId: 't', ElementType: 'TEXT_BOX', ColumnSpan: 12, RowSpan: 6 },
                  ],
                },
              },
            },
          ],
        },
      ],
    });
    const positions = model.sheets[0]!.elements.map((e) => e.position);
    expect(positions).toEqual([
      { type: 'grid', colSpan: 12, rowSpan: 6 },
      { type: 'grid', colSpan: 12, rowSpan: 6 },
      { type: 'grid', colSpan: 12, rowSpan: 6 },
    ]);
    expect(model.sheets[0]!.elements[2]).toMatchObject({ kind: 'textBox', title: 'Hello' });
  });
});
