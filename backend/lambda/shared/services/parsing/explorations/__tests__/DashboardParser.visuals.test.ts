import { describe, expect, it, vi } from 'vitest';

import { DashboardParser } from '../DashboardParser';

vi.mock('../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const column = (name: string) => ({ DataSetIdentifier: 'sales', ColumnName: name });

/** One sheet, two visuals: a bar chart on region/revenue and a KPI on revenue. */
const DEFINITION = {
  DataSetIdentifierDeclarations: [
    { Identifier: 'sales', DataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/ds-1' },
  ],
  CalculatedFields: [
    { DataSetIdentifier: 'sales', Name: 'margin', Expression: '{revenue}-{cost}' },
  ],
  Sheets: [
    {
      SheetId: 'sheet-1',
      Name: 'Overview',
      Visuals: [
        {
          BarChartVisual: {
            VisualId: 'vis-bar',
            Title: { Visibility: 'VISIBLE', FormatText: { PlainText: 'Revenue by region' } },
            ChartConfiguration: {
              FieldWells: {
                BarChartAggregatedFieldWells: {
                  Category: [
                    {
                      CategoricalDimensionField: { FieldId: 'f-region', Column: column('region') },
                    },
                  ],
                  Values: [
                    {
                      NumericalMeasureField: {
                        FieldId: 'f-revenue',
                        Column: column('revenue'),
                        AggregationFunction: { SimpleNumericalAggregation: 'SUM' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          KPIVisual: {
            VisualId: 'vis-kpi',
            ChartConfiguration: {
              FieldWells: {
                Values: [
                  { NumericalMeasureField: { FieldId: 'f-revenue-2', Column: column('revenue') } },
                ],
              },
            },
          },
        },
      ],
    },
  ],
};

const assetData = {
  assetType: 'dashboard',
  apiResponses: {
    definition: {
      data: { DashboardId: 'd-1', Name: 'Sales', Definition: DEFINITION },
      timestamp: '2026-01-01T00:00:00Z',
    },
    describe: {
      data: {
        Dashboard: {
          DashboardId: 'd-1',
          Name: 'Sales',
          Version: { Status: 'CREATION_SUCCESSFUL' },
        },
      },
      timestamp: '2026-01-01T00:00:00Z',
    },
  },
} as any;

describe('DashboardParser: visuals on fields', () => {
  it('stamps each field with the visuals that read it, titled where the visual has a title', () => {
    const metadata = new DashboardParser().extractMetadata(assetData) as any;

    const byName = new Map<string, any>(metadata.fields.map((f: any) => [f.fieldName, f]));
    const revenue = byName.get('revenue');
    expect(revenue.visuals.map((v: any) => v.visualId).sort()).toEqual(['vis-bar', 'vis-kpi']);
    expect(revenue.visuals.find((v: any) => v.visualId === 'vis-bar')).toMatchObject({
      title: 'Revenue by region',
      sheetId: 'sheet-1',
      sheetName: 'Overview',
    });
    expect(revenue.visuals.find((v: any) => v.visualId === 'vis-kpi').title).toBeUndefined();

    const region = byName.get('region');
    expect(region.visuals.map((v: any) => v.visualId)).toEqual(['vis-bar']);
  });

  it('leaves fields no visual reads without a visuals entry', () => {
    const metadata = new DashboardParser().extractMetadata(assetData) as any;
    const margin = metadata.calculatedFields.find((f: any) => f.fieldName === 'margin');
    expect(margin).toBeDefined();
    expect(margin.visuals).toBeUndefined();
  });
});

/**
 * A definition names its datasets by a label ("sales"), not by id. Everything
 * downstream — the field index, the SMUS tie-back, the lineage between a
 * dataset's fields and the ones a dashboard computes from them — joins on the
 * dataset id, so the label has to be resolved through the declaration's ARN.
 */
describe('DashboardParser: fields carry a dataset id, not a definition label', () => {
  it('resolves the DataSetIdentifier to the dataset the declaration points at', () => {
    const metadata = new DashboardParser().extractMetadata(assetData) as any;

    const margin = metadata.calculatedFields.find((f: any) => f.fieldName === 'margin');
    expect(margin.sourceDatasetId).toBe('ds-1');
    expect(metadata.fields.every((f: any) => f.sourceDatasetId === 'ds-1')).toBe(true);
  });

  it('keeps the label when no declaration claims it, rather than losing the field', () => {
    const orphan = {
      ...assetData,
      apiResponses: {
        ...assetData.apiResponses,
        definition: {
          ...assetData.apiResponses.definition,
          data: {
            DashboardId: 'd-1',
            Name: 'Sales',
            Definition: { ...DEFINITION, DataSetIdentifierDeclarations: [] },
          },
        },
      },
    };
    const metadata = new DashboardParser().extractMetadata(orphan) as any;
    const margin = metadata.calculatedFields.find((f: any) => f.fieldName === 'margin');
    expect(margin.sourceDatasetId).toBe('sales');
  });
});
