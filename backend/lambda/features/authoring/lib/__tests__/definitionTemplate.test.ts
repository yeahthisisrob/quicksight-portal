import { describe, expect, it } from 'vitest';

import { applyTemplate, templateTiles } from '../definitionTemplate';
import { reflow } from '../grid';
import { sampleDefinition } from './fixtures';

const col = (identifier: string, name: string) => ({
  DataSetIdentifier: identifier,
  ColumnName: name,
});

/** A template: title band, status filter + region parameter, two KPIs, two 18x12 charts, a notes footer. */
function templateDefinition() {
  return {
    DataSetIdentifierDeclarations: [{ Identifier: 'tpl', DataSetArn: 'arn:tpl' }],
    ParameterDeclarations: [
      { StringParameterDeclaration: { Name: 'period', ParameterValueType: 'SINGLE_VALUED' } },
    ],
    FilterGroups: [
      {
        FilterGroupId: 'tfg',
        Filters: [
          {
            CategoryFilter: {
              FilterId: 'tf-status',
              Column: col('tpl', 'status'),
              Configuration: {},
            },
          },
          {
            CategoryFilter: {
              FilterId: 'tf-missing',
              Column: col('tpl', 'segment'),
              Configuration: {},
            },
          },
        ],
        ScopeConfiguration: {
          SelectedSheets: {
            SheetVisualScopingConfigurations: [{ SheetId: 'ts', Scope: 'ALL_VISUALS' }],
          },
        },
        CrossDataset: 'SINGLE_DATASET',
      },
    ],
    Sheets: [
      {
        SheetId: 'ts',
        Name: 'Standard overview',
        TextBoxes: [
          { SheetTextBoxId: 'title', Content: '<title>Team dashboard</title>' },
          { SheetTextBoxId: 'notes', Content: 'Notes · last refreshed nightly · open a SIM' },
        ],
        FilterControls: [
          {
            Dropdown: {
              FilterControlId: 'fc-status',
              Title: 'Status',
              SourceFilterId: 'tf-status',
            },
          },
          {
            Dropdown: {
              FilterControlId: 'fc-missing',
              Title: 'Segment',
              SourceFilterId: 'tf-missing',
            },
          },
        ],
        ParameterControls: [
          {
            Dropdown: {
              ParameterControlId: 'pc-period',
              Title: 'Period',
              SourceParameterName: 'period',
            },
          },
        ],
        Visuals: [
          { KPIVisual: { VisualId: 'tk1' } },
          { KPIVisual: { VisualId: 'tk2' } },
          { BarChartVisual: { VisualId: 'tb1' } },
          { LineChartVisual: { VisualId: 'tl1' } },
        ],
        Layouts: [
          {
            Configuration: {
              GridLayout: {
                Elements: [
                  {
                    ElementId: 'title',
                    ElementType: 'TEXT_BOX',
                    ColumnIndex: 0,
                    ColumnSpan: 36,
                    RowIndex: 0,
                    RowSpan: 2,
                  },
                  {
                    ElementId: 'fc-status',
                    ElementType: 'FILTER_CONTROL',
                    ColumnIndex: 0,
                    ColumnSpan: 9,
                    RowIndex: 2,
                    RowSpan: 3,
                  },
                  {
                    ElementId: 'fc-missing',
                    ElementType: 'FILTER_CONTROL',
                    ColumnIndex: 9,
                    ColumnSpan: 9,
                    RowIndex: 2,
                    RowSpan: 3,
                  },
                  {
                    ElementId: 'pc-period',
                    ElementType: 'PARAMETER_CONTROL',
                    ColumnIndex: 18,
                    ColumnSpan: 9,
                    RowIndex: 2,
                    RowSpan: 3,
                  },
                  {
                    ElementId: 'tk1',
                    ElementType: 'VISUAL',
                    ColumnIndex: 0,
                    ColumnSpan: 9,
                    RowIndex: 5,
                    RowSpan: 6,
                  },
                  {
                    ElementId: 'tk2',
                    ElementType: 'VISUAL',
                    ColumnIndex: 9,
                    ColumnSpan: 9,
                    RowIndex: 5,
                    RowSpan: 6,
                  },
                  {
                    ElementId: 'tb1',
                    ElementType: 'VISUAL',
                    ColumnIndex: 0,
                    ColumnSpan: 18,
                    RowIndex: 11,
                    RowSpan: 12,
                  },
                  {
                    ElementId: 'tl1',
                    ElementType: 'VISUAL',
                    ColumnIndex: 18,
                    ColumnSpan: 18,
                    RowIndex: 11,
                    RowSpan: 12,
                  },
                  {
                    ElementId: 'notes',
                    ElementType: 'TEXT_BOX',
                    ColumnIndex: 0,
                    ColumnSpan: 36,
                    RowIndex: 24,
                    RowSpan: 3,
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  };
}

const grid = (d: any) => d.Sheets[0].Layouts[0].Configuration.GridLayout.Elements as any[];
const columns = new Map([
  ['orders', new Set(['status', 'revenue', 'cost', 'order_date'])],
  ['regions', new Set(['region_name'])],
]);

describe('templateTiles and reflow', () => {
  it('reads the standard tile and the KPI tile from the template grid', () => {
    expect(templateTiles(templateDefinition().Sheets[0])).toEqual({
      tile: { colSpan: 18, rowSpan: 12 },
      kpi: { colSpan: 9, rowSpan: 6 },
    });
    expect(templateTiles({ Visuals: [], Layouts: [] })).toEqual({
      tile: { colSpan: 12, rowSpan: 10 },
      kpi: null,
    });
  });

  it('flows tiles left to right and wraps rows by the tallest tile', () => {
    const { elements, bottom } = reflow(
      [
        { id: 'a', tile: { colSpan: 18, rowSpan: 12 } },
        { id: 'b', tile: { colSpan: 18, rowSpan: 6 } },
        { id: 'c', tile: { colSpan: 36, rowSpan: 4 } },
      ],
      5
    );
    expect(elements.map((e) => [e.ColumnIndex, e.RowIndex])).toEqual([
      [0, 5],
      [18, 5],
      [0, 17],
    ]);
    expect(bottom).toBe(21);
  });
});

describe('applyTemplate', () => {
  it('does not touch the source', () => {
    const source = sampleDefinition();
    const before = JSON.stringify(source);
    applyTemplate(source, templateDefinition(), { columnsByIdentifier: columns });
    expect(JSON.stringify(source)).toBe(before);
  });

  it('carries the title band and rebindable controls, reflows visuals with KPIs first, and puts the footer after', () => {
    const { definition, changes, warnings, themeArn } = applyTemplate(
      sampleDefinition(),
      templateDefinition(),
      {
        columnsByIdentifier: columns,
        themeArn: 'arn:theme',
      }
    );
    const sheet = definition.Sheets[0];
    const elements = grid(definition);
    const byType = (t: string) => elements.filter((e) => e.ElementType === t);

    expect(sheet.Name).toBe('Standard overview');
    expect(themeArn).toBe('arn:theme');

    // Title band at row 0 and the notes footer after everything else.
    const boxes = byType('TEXT_BOX');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.RowIndex).toBe(0);
    expect(sheet.TextBoxes.map((t: any) => t.Content)).toEqual([
      '<title>Team dashboard</title>',
      'Notes · last refreshed nightly · open a SIM',
    ]);

    // The status control came across, rebound to orders; the segment one was dropped and said so.
    expect(sheet.FilterControls).toHaveLength(1);
    const added = definition.FilterGroups.find((g: any) => g.FilterGroupId.startsWith('tpl-fg'));
    expect(added.Filters[0].CategoryFilter.Column).toEqual(col('orders', 'status'));
    expect(added.ScopeConfiguration).toEqual({ AllSheets: {} });
    expect(sheet.FilterControls[0].Dropdown.SourceFilterId).toBe(
      added.Filters[0].CategoryFilter.FilterId
    );
    expect(warnings).toEqual([expect.stringContaining("'Segment' was dropped")]);

    // The period parameter control came with its declaration; the source's own controls were replaced.
    expect(sheet.ParameterControls).toHaveLength(1);
    expect(
      definition.ParameterDeclarations.some(
        (d: any) => d.StringParameterDeclaration?.Name === 'period'
      )
    ).toBe(true);
    expect(changes.some((c) => c.description.includes('Replaced 2 controls'))).toBe(true);

    // Visuals: the KPI (v2) first at 9x6, then the bar chart at 18x12, both below the band (rows 0-5).
    const visuals = byType('VISUAL');
    expect(
      visuals.map((e) => [e.ElementId, e.ColumnIndex, e.RowIndex, e.ColumnSpan, e.RowSpan])
    ).toEqual([
      ['v2', 0, 5, 9, 6],
      ['v1', 9, 5, 18, 12],
    ]);
    expect(boxes[1]!.RowIndex).toBeGreaterThan(17);
    expect(
      changes.find((c) => c.kind === 'template' && c.description.startsWith('Laid out'))
        ?.description
    ).toContain('18x12 tiles (KPIs 9x6 first)');
  });

  it('keeps the source furniture when the template parts are switched off', () => {
    const { definition, changes } = applyTemplate(sampleDefinition(), templateDefinition(), {
      textBoxes: false,
      controls: false,
      sheetNames: false,
      columnsByIdentifier: columns,
    });
    const sheet = definition.Sheets[0];
    expect(sheet.Name).toBe('Overview');
    expect(sheet.TextBoxes).toEqual([]);
    expect(sheet.FilterControls).toHaveLength(1);
    expect(sheet.ParameterControls).toHaveLength(1);
    const controls = grid(definition).filter((e) => e.ElementType.endsWith('_CONTROL'));
    expect(controls).toHaveLength(2);
    expect(grid(definition).filter((e) => e.ElementType === 'VISUAL')[0]!.RowIndex).toBe(0);
    expect(changes.every((c) => c.kind === 'template')).toBe(true);
  });

  it('serves extra source sheets from the last template sheet', () => {
    const source = sampleDefinition();
    source.Sheets.push({
      SheetId: 's2',
      Name: 'Detail',
      Visuals: [{ TableVisual: { VisualId: 'v3' } }],
      Layouts: [],
    });
    const { definition } = applyTemplate(source, templateDefinition(), {
      columnsByIdentifier: columns,
    });
    expect(definition.Sheets.map((s: any) => s.Name)).toEqual([
      'Standard overview',
      'Standard overview',
    ]);
    expect(
      definition.Sheets[1].Layouts[0].Configuration.GridLayout.Elements.some(
        (e: any) => e.ElementId === 'v3'
      )
    ).toBe(true);
  });

  it('refuses a template with no sheets', () => {
    expect(() => applyTemplate(sampleDefinition(), { Sheets: [] })).toThrow('no sheets');
  });

  it('keeps controls where they sat: the control bar stays the control bar, on both sides', () => {
    const template = templateDefinition();
    const ts: any = template.Sheets[0];
    // The template keeps Status in its control bar instead of on the canvas.
    ts.Layouts[0].Configuration.GridLayout.Elements =
      ts.Layouts[0].Configuration.GridLayout.Elements.filter(
        (e: any) => e.ElementId !== 'fc-status'
      );
    ts.SheetControlLayouts = [
      {
        Configuration: {
          GridLayout: {
            Elements: [
              { ElementId: 'fc-status', ElementType: 'FILTER_CONTROL', ColumnSpan: 3, RowSpan: 1 },
            ],
          },
        },
      },
    ];
    const source: any = sampleDefinition();
    const sheet = source.Sheets[0];
    sheet.FilterControls = [
      { Dropdown: { FilterControlId: 'own-ctl', Title: 'Own', SourceFilterId: 'own-f' } },
    ];
    sheet.SheetControlLayouts = [
      {
        Configuration: {
          GridLayout: {
            Elements: [
              { ElementId: 'own-ctl', ElementType: 'FILTER_CONTROL', ColumnSpan: 2, RowSpan: 1 },
            ],
          },
        },
      },
    ];

    const { definition } = applyTemplate(source, template, {
      columnsByIdentifier: columns,
      controls: true,
    });
    const out = definition.Sheets[0];
    const bar = out.SheetControlLayouts[0].Configuration.GridLayout.Elements;
    const status = out.FilterControls.find((c: any) => c.Dropdown?.Title === 'Status').Dropdown
      .FilterControlId;
    // The template's controls replace the source's, and Status stays in the bar at its width.
    expect(bar).toEqual([
      { ElementId: status, ElementType: 'FILTER_CONTROL', ColumnSpan: 3, RowSpan: 1 },
    ]);
    expect(grid(definition).some((e) => e.ElementId === status)).toBe(false);

    const kept = applyTemplate(sampleDefinition() as any, templateDefinition(), {
      columnsByIdentifier: columns,
      controls: false,
    });
    expect(kept.definition.Sheets[0].SheetControlLayouts).toBeUndefined();

    const own: any = sampleDefinition();
    own.Sheets[0].FilterControls = sheet.FilterControls;
    own.Sheets[0].SheetControlLayouts = sheet.SheetControlLayouts;
    const noTemplateControls = templateDefinition();
    for (const t of noTemplateControls.Sheets as any[]) {
      t.FilterControls = [];
      t.ParameterControls = [];
    }
    const mine = applyTemplate(own, noTemplateControls, {
      columnsByIdentifier: columns,
    }).definition;
    // The source's own bar control is not dragged onto the canvas.
    expect(
      mine.Sheets[0].SheetControlLayouts[0].Configuration.GridLayout.Elements.map(
        (e: any) => e.ElementId
      )
    ).toEqual(['own-ctl']);
    expect(grid(mine).some((e) => e.ElementId === 'own-ctl')).toBe(false);
  });
});
