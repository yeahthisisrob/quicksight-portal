/**
 * A small but honest analysis definition: two datasets, a bar chart, a KPI,
 * a filter, a parameter defaulted from a column, a sheet control, a
 * calculated field that depends on two columns and another calculated field.
 */

export const ORDERS_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/orders-silver';
export const REGIONS_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/regions';

const col = (dataSetIdentifier: string, columnName: string) => ({
  DataSetIdentifier: dataSetIdentifier,
  ColumnName: columnName,
});

export function sampleDefinition(): Record<string, any> {
  return {
    DataSetIdentifierDeclarations: [
      { Identifier: 'orders', DataSetArn: ORDERS_ARN },
      { Identifier: 'regions', DataSetArn: REGIONS_ARN },
    ],
    CalculatedFields: [
      {
        DataSetIdentifier: 'orders',
        Name: 'margin',
        Expression: '{revenue} - {cost}',
      },
      {
        DataSetIdentifier: 'orders',
        Name: 'margin_pct',
        Expression: 'ifelse({revenue} = 0, 0, {margin} / {revenue}) * ${scale}',
      },
    ],
    ParameterDeclarations: [
      {
        StringParameterDeclaration: {
          Name: 'region',
          ParameterValueType: 'SINGLE_VALUED',
          DefaultValues: {
            DynamicValue: { DefaultValueColumn: col('regions', 'region_name') },
          },
        },
      },
    ],
    FilterGroups: [
      {
        FilterGroupId: 'fg1',
        Filters: [
          {
            CategoryFilter: {
              FilterId: 'f1',
              Column: col('orders', 'status'),
              Configuration: { FilterListConfiguration: { MatchOperator: 'CONTAINS' } },
            },
          },
        ],
        ScopeConfiguration: { SelectedSheets: {} },
        CrossDataset: 'ALL_DATASETS',
      },
    ],
    Sheets: [
      {
        SheetId: 's1',
        Name: 'Overview',
        FilterControls: [
          {
            Dropdown: {
              FilterControlId: 'c1',
              Title: 'Status',
              SourceFilterId: 'f1',
              DisplayOptions: {},
            },
          },
        ],
        ParameterControls: [
          {
            Dropdown: {
              ParameterControlId: 'c2',
              Title: 'Region',
              SourceParameterName: 'region',
              SelectableValues: { LinkToDataSetColumn: col('regions', 'region_name') },
            },
          },
        ],
        Visuals: [
          {
            BarChartVisual: {
              VisualId: 'v1',
              Title: { Visibility: 'VISIBLE', FormatText: { PlainText: 'Revenue by status' } },
              ChartConfiguration: {
                FieldWells: {
                  BarChartAggregatedFieldWells: {
                    Category: [
                      {
                        CategoricalDimensionField: {
                          FieldId: 'v1.status.0',
                          Column: col('orders', 'status'),
                        },
                      },
                    ],
                    Values: [
                      {
                        NumericalMeasureField: {
                          FieldId: 'v1.revenue.1',
                          Column: col('orders', 'revenue'),
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
              VisualId: 'v2',
              ChartConfiguration: {
                FieldWells: {
                  Values: [
                    {
                      NumericalMeasureField: {
                        FieldId: 'v2.margin_pct.0',
                        Column: col('orders', 'margin_pct'),
                      },
                    },
                  ],
                  TrendGroups: [
                    {
                      DateDimensionField: {
                        FieldId: 'v2.order_date.1',
                        Column: col('orders', 'order_date'),
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
        Layouts: [
          {
            Configuration: {
              GridLayout: {
                Elements: [
                  { ElementId: 'v1', ElementType: 'VISUAL', ColumnIndex: 0, ColumnSpan: 18, RowIndex: 0, RowSpan: 12 },
                  { ElementId: 'v2', ElementType: 'VISUAL', ColumnIndex: 18, ColumnSpan: 18, RowIndex: 0, RowSpan: 12 },
                ],
              },
            },
          },
        ],
      },
    ],
    ColumnConfigurations: [
      {
        Column: col('orders', 'revenue'),
        FormatConfiguration: { NumberFormatConfiguration: {} },
      },
    ],
    AnalysisDefaults: { DefaultNewSheetConfiguration: { SheetContentType: 'INTERACTIVE' } },
  };
}

export const GOLD_COLUMNS = [
  { Name: 'status', Type: 'STRING' },
  { Name: 'revenue', Type: 'DECIMAL' },
  { Name: 'cost', Type: 'DECIMAL' },
  { Name: 'Order Date', Type: 'DATETIME' },
  { Name: 'customer_id', Type: 'STRING' },
];
