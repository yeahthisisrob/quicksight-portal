import { describe, expect, it } from 'vitest';

import { diffDefinitions, jsonDiff } from '../definitionDiff';

const visual = (id: string, title: string, kind = 'BarChartVisual') => ({
  [kind]: { VisualId: id, Title: { FormatText: { PlainText: title } } },
});
const element = (id: string, col: number, row: number, w = 12, h = 8) => ({
  ElementId: id,
  ElementType: 'VISUAL',
  ColumnIndex: col,
  RowIndex: row,
  ColumnSpan: w,
  RowSpan: h,
});
const exploration = (over: Record<string, unknown> = {}) => ({
  Name: 'Sales',
  Definition: {
    DataSetIdentifierDeclarations: [{ Identifier: 'orders', DataSetArn: 'arn:ds/orders' }],
    CalculatedFields: [{ DataSetIdentifier: 'orders', Name: 'margin', Expression: '{rev}-{cost}' }],
    FilterGroups: [],
    Sheets: [
      {
        SheetId: 's1',
        Name: 'Overview',
        Visuals: [visual('v1', 'Revenue'), visual('v2', 'Cost')],
        Layouts: [
          {
            Configuration: {
              GridLayout: { Elements: [element('v1', 0, 0), element('v2', 12, 0)] },
            },
          },
        ],
      },
    ],
    ...over,
  },
});

describe('diffDefinitions', () => {
  it('says what changed in an analysis in words, and counts it', () => {
    const before = exploration();
    const after = exploration({
      CalculatedFields: [
        { DataSetIdentifier: 'orders', Name: 'margin', Expression: '{rev}-{cost}-{tax}' },
      ],
      Sheets: [
        {
          SheetId: 's1',
          Name: 'Overview',
          Visuals: [visual('v1', 'Revenue'), visual('v3', 'Units', 'LineChartVisual')],
          Layouts: [
            {
              Configuration: {
                GridLayout: { Elements: [element('v1', 0, 4), element('v3', 12, 0, 24, 8)] },
              },
            },
          ],
        },
      ],
    });
    const diff = diffDefinitions('analysis', before, after);
    expect(diff.changes).toEqual([
      'Calculated field "margin" expression changed',
      'Visual "Units" (line chart) added on "Overview"',
      'Visual "Cost" (bar chart) removed from "Overview"',
      'Visual "Revenue" (bar chart) moved',
    ]);
    expect(diff.summary).toBe(
      '1 calculated field changed, 1 visual added, 1 visual removed, 1 visual moved'
    );
    expect(diff.entries.length).toBeGreaterThan(0);
  });

  it('reads the first version as first seen', () => {
    const diff = diffDefinitions('dashboard', null, exploration());
    expect(diff.summary).toBe('First version seen');
  });

  it('says what changed in a dataset: sources, query, columns, calculated columns', () => {
    const before = {
      Name: 'Orders',
      ImportMode: 'DIRECT_QUERY',
      PhysicalTableMap: { q: { CustomSql: { Name: 'orders', SqlQuery: 'select 1' } } },
      OutputColumns: [{ Name: 'id', Type: 'INTEGER' }],
      LogicalTableMap: {
        l: {
          DataTransforms: [
            { CreateColumnsOperation: { Columns: [{ ColumnName: 'x', Expression: '1' }] } },
          ],
        },
      },
    };
    const after = {
      Name: 'Orders',
      ImportMode: 'SPICE',
      PhysicalTableMap: {
        q: { CustomSql: { Name: 'orders', SqlQuery: 'select 2' } },
        r: { RelationalTable: { Schema: 'gold', Name: 'regions' } },
      },
      OutputColumns: [
        { Name: 'id', Type: 'STRING' },
        { Name: 'region', Type: 'STRING' },
      ],
      LogicalTableMap: {
        l: {
          DataTransforms: [
            { CreateColumnsOperation: { Columns: [{ ColumnName: 'x', Expression: '2' }] } },
          ],
        },
      },
    };
    const diff = diffDefinitions('dataset', before, after);
    expect(diff.changes).toEqual([
      'Import mode changed from DIRECT_QUERY to SPICE',
      'Reads table gold.regions (added)',
      'Query "orders" changed',
      'Column "region" added',
      'Column "id" is now STRING (was INTEGER)',
      'Calculated column "x" expression changed',
    ]);
  });

  it('falls back to counting differing fields when nothing it names changed', () => {
    const diff = diffDefinitions(
      'dashboard',
      exploration(),
      exploration({ AnalysisDefaults: { x: 1 } })
    );
    expect(diff.summary).toBe('1 field changed');
    expect(diff.changes).toEqual(['1 field changed']);
  });

  it('lists differing paths with clipped values', () => {
    const { entries } = jsonDiff({ a: 1, b: { c: [1, 2] } }, { a: 2, b: { c: [1, 3] }, d: true });
    expect(entries).toEqual([
      { path: 'a', kind: 'changed', before: 1, after: 2 },
      { path: 'b.c.1', kind: 'changed', before: 2, after: 3 },
      { path: 'd', kind: 'added', after: true },
    ]);
  });
});
