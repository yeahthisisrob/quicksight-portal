/**
 * Synthetic QuickSight definitions for stories and tests.
 *
 * Shapes follow DescribeDashboardDefinition / DescribeAnalysisDefinition as
 * QuickSight returns them; values are invented.
 */

const DS = 'arn:aws:quicksight:us-east-1:123456789012:dataset/sales-gold';
const DS_TARGETS = 'arn:aws:quicksight:us-east-1:123456789012:dataset/targets';

const column = (name: string, ds = 'sales') => ({ DataSetIdentifier: ds, ColumnName: name });

const dim = (name: string, id = name) => ({
  CategoricalDimensionField: { FieldId: id, Column: column(name) },
});
const dateDim = (name: string, granularity: string) => ({
  DateDimensionField: { FieldId: name, Column: column(name), DateGranularity: granularity },
});
const sum = (name: string) => ({
  NumericalMeasureField: {
    FieldId: name,
    Column: column(name),
    AggregationFunction: { SimpleNumericalAggregation: 'SUM' },
  },
});

const title = (text: string, hidden = false) => ({
  Visibility: hidden ? 'HIDDEN' : 'VISIBLE',
  FormatText: { RichText: `<visual-title>${text}</visual-title>` },
});

const grid = (
  ElementId: string,
  ElementType: string,
  ColumnIndex: number,
  RowIndex: number,
  ColumnSpan: number,
  RowSpan: number
) => ({ ElementId, ElementType, ColumnIndex, ColumnSpan, RowIndex, RowSpan });

/** A typical single-sheet grid dashboard: KPI row, two charts, a table, a filter. */
export const gridDashboardDefinition = {
  DataSetIdentifierDeclarations: [
    { Identifier: 'sales', DataSetArn: DS },
    { Identifier: 'targets', DataSetArn: DS_TARGETS },
  ],
  Sheets: [
    {
      SheetId: 'sheet-overview',
      Name: 'Overview',
      Visuals: [
        {
          KPIVisual: {
            VisualId: 'kpi-revenue',
            Title: title('Revenue'),
            ChartConfiguration: {
              FieldWells: {
                Values: [sum('revenue')],
                TargetValues: [
                  {
                    NumericalMeasureField: {
                      FieldId: 'target',
                      Column: column('target_revenue', 'targets'),
                      AggregationFunction: { SimpleNumericalAggregation: 'SUM' },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          KPIVisual: {
            VisualId: 'kpi-orders',
            Title: title('Orders'),
            ChartConfiguration: {
              FieldWells: {
                Values: [
                  {
                    CategoricalMeasureField: {
                      FieldId: 'order_id',
                      Column: column('order_id'),
                      AggregationFunction: 'DISTINCT_COUNT',
                    },
                  },
                ],
              },
            },
          },
        },
        {
          BarChartVisual: {
            VisualId: 'bar-region',
            Title: title('Revenue <b>by region</b>'),
            Subtitle: { Visibility: 'VISIBLE', FormatText: { PlainText: 'Last 12 months' } },
            ChartConfiguration: {
              FieldWells: {
                BarChartAggregatedFieldWells: {
                  Category: [dim('region')],
                  Values: [sum('revenue')],
                  Colors: [dim('channel')],
                },
              },
            },
          },
        },
        {
          LineChartVisual: {
            VisualId: 'line-trend',
            Title: title('Monthly trend'),
            ChartConfiguration: {
              FieldWells: {
                LineChartAggregatedFieldWells: {
                  Category: [dateDim('order_date', 'MONTH')],
                  Values: [sum('revenue'), sum('margin')],
                },
              },
            },
          },
        },
        {
          TableVisual: {
            VisualId: 'table-detail',
            Title: title('Top customers', true),
            ChartConfiguration: {
              FieldWells: {
                TableAggregatedFieldWells: {
                  GroupBy: [dim('customer_name'), dim('segment')],
                  Values: [
                    sum('revenue'),
                    {
                      NumericalMeasureField: {
                        FieldId: 'p90',
                        Column: column('order_value'),
                        AggregationFunction: {
                          PercentileAggregation: { PercentileValue: 90 },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
      FilterControls: [
        {
          Dropdown: {
            FilterControlId: 'ctl-region',
            Title: 'Region',
            SourceFilterId: 'filter-region',
          },
        },
        {
          DateTimePicker: {
            FilterControlId: 'ctl-date',
            Title: 'Order date',
            SourceFilterId: 'filter-date',
          },
        },
      ],
      TextBoxes: [
        {
          SheetTextBoxId: 'text-intro',
          Content:
            '<block><inline><b>Sales overview</b> - refreshed nightly from the gold dataset.</inline></block>',
        },
      ],
      SheetControlLayouts: [
        {
          Configuration: {
            GridLayout: { Elements: [grid('ctl-date', 'FILTER_CONTROL', 0, 0, 6, 1)] },
          },
        },
      ],
      Layouts: [
        {
          Configuration: {
            GridLayout: {
              CanvasSizeOptions: {
                ScreenCanvasSizeOptions: {
                  ResizeOption: 'FIXED',
                  OptimizedViewPortWidth: '1600px',
                },
              },
              Elements: [
                grid('text-intro', 'TEXT_BOX', 0, 0, 24, 2),
                grid('ctl-region', 'FILTER_CONTROL', 24, 0, 12, 2),
                grid('kpi-revenue', 'VISUAL', 0, 2, 9, 4),
                grid('kpi-orders', 'VISUAL', 9, 2, 9, 4),
                grid('bar-region', 'VISUAL', 18, 2, 18, 10),
                grid('line-trend', 'VISUAL', 0, 6, 18, 6),
                grid('table-detail', 'VISUAL', 0, 12, 36, 10),
              ],
            },
          },
        },
      ],
    },
  ],
  CalculatedFields: [
    { DataSetIdentifier: 'sales', Name: 'margin', Expression: '{revenue} - {cost}' },
  ],
  ParameterDeclarations: [
    { StringParameterDeclaration: { Name: 'Region', ParameterValueType: 'MULTI_VALUED' } },
  ],
  FilterGroups: [
    { FilterGroupId: 'fg-1', Filters: [], ScopeConfiguration: {}, CrossDataset: 'ALL_DATASETS' },
    { FilterGroupId: 'fg-2', Filters: [], ScopeConfiguration: {}, CrossDataset: 'ALL_DATASETS' },
  ],
};

/** One free-form sheet with pixel-positioned elements and an image. */
export const freeFormDefinition = {
  DataSetIdentifierDeclarations: [{ Identifier: 'sales', DataSetArn: DS }],
  Sheets: [
    {
      SheetId: 'sheet-free',
      Name: 'Executive view',
      Visuals: [
        {
          PieChartVisual: {
            VisualId: 'pie-mix',
            Title: title('Channel mix'),
            ChartConfiguration: {
              FieldWells: {
                PieChartAggregatedFieldWells: {
                  Category: [dim('channel')],
                  Values: [sum('revenue')],
                },
              },
            },
          },
        },
        {
          GaugeChartVisual: {
            VisualId: 'gauge-attainment',
            Title: title('Target attainment'),
            ChartConfiguration: {
              FieldWells: { Values: [sum('revenue')], TargetValues: [sum('target_revenue')] },
            },
          },
        },
        {
          InsightVisual: {
            VisualId: 'insight-anomaly',
            Title: title('Anomalies'),
            DataSetIdentifier: 'sales',
          },
        },
      ],
      Images: [{ SheetImageId: 'img-logo', ImageContentAltText: 'Company logo', Source: {} }],
      Layouts: [
        {
          Configuration: {
            FreeFormLayout: {
              CanvasSizeOptions: {
                ScreenCanvasSizeOptions: { OptimizedViewPortWidth: '1200px' },
              },
              Elements: [
                {
                  ElementId: 'img-logo',
                  ElementType: 'IMAGE',
                  XAxisLocation: '20px',
                  YAxisLocation: '20px',
                  Width: '160px',
                  Height: '60px',
                },
                {
                  ElementId: 'pie-mix',
                  ElementType: 'VISUAL',
                  XAxisLocation: '20px',
                  YAxisLocation: '100px',
                  Width: '560px',
                  Height: '360px',
                },
                {
                  ElementId: 'gauge-attainment',
                  ElementType: 'VISUAL',
                  XAxisLocation: '620px',
                  YAxisLocation: '100px',
                  Width: '560px',
                  Height: '170px',
                },
                {
                  ElementId: 'insight-anomaly',
                  ElementType: 'VISUAL',
                  XAxisLocation: '620px',
                  YAxisLocation: '290px',
                  Width: '560px',
                  Height: '170px',
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

/** Two grid sheets, the second mostly a pivot; a parameter control on each. */
export const twoSheetAnalysisDefinition = {
  DataSetIdentifierDeclarations: [{ Identifier: 'sales', DataSetArn: DS }],
  Sheets: [
    {
      SheetId: 'sheet-summary',
      Name: 'Summary',
      Visuals: [
        {
          BarChartVisual: {
            VisualId: 'bar-1',
            Title: title('Revenue by segment'),
            ChartConfiguration: {
              FieldWells: {
                BarChartAggregatedFieldWells: {
                  Category: [dim('segment')],
                  Values: [sum('revenue')],
                },
              },
            },
          },
        },
        {
          ComboChartVisual: {
            VisualId: 'combo-1',
            Title: title('Orders vs. margin'),
            ChartConfiguration: {
              FieldWells: {
                ComboChartAggregatedFieldWells: {
                  Category: [dateDim('order_date', 'WEEK')],
                  BarValues: [sum('orders')],
                  LineValues: [sum('margin')],
                },
              },
            },
          },
        },
      ],
      ParameterControls: [
        {
          Dropdown: {
            ParameterControlId: 'pctl-year',
            Title: 'Fiscal year',
            SourceParameterName: 'FiscalYear',
          },
        },
      ],
      Layouts: [
        {
          Configuration: {
            GridLayout: {
              Elements: [
                grid('pctl-year', 'PARAMETER_CONTROL', 0, 0, 8, 2),
                grid('bar-1', 'VISUAL', 0, 2, 18, 8),
                grid('combo-1', 'VISUAL', 18, 2, 18, 8),
              ],
            },
          },
        },
      ],
    },
    {
      SheetId: 'sheet-pivot',
      Name: 'Detail',
      Visuals: [
        {
          PivotTableVisual: {
            VisualId: 'pivot-1',
            Title: title('Revenue by region and month'),
            ChartConfiguration: {
              FieldWells: {
                PivotTableAggregatedFieldWells: {
                  Rows: [dim('region'), dim('country')],
                  Columns: [dateDim('order_date', 'MONTH')],
                  Values: [sum('revenue')],
                },
              },
            },
          },
        },
        {
          HeatMapVisual: {
            VisualId: 'heat-1',
            Title: title('Order density'),
            ChartConfiguration: {
              FieldWells: {
                HeatMapAggregatedFieldWells: {
                  Rows: [dim('weekday')],
                  Columns: [dim('hour')],
                  Values: [sum('orders')],
                },
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
                grid('pivot-1', 'VISUAL', 0, 0, 24, 12),
                grid('heat-1', 'VISUAL', 24, 0, 12, 12),
              ],
            },
          },
        },
      ],
    },
  ],
  ParameterDeclarations: [
    { IntegerParameterDeclaration: { Name: 'FiscalYear', ParameterValueType: 'SINGLE_VALUED' } },
  ],
};

/** A paginated report: header band, two body sections, footer. */
export const paginatedReportDefinition = {
  DataSetIdentifierDeclarations: [{ Identifier: 'sales', DataSetArn: DS }],
  Sheets: [
    {
      SheetId: 'sheet-report',
      Name: 'Monthly report',
      Visuals: [
        {
          TableVisual: {
            VisualId: 'tbl-summary',
            Title: title('Summary by region'),
            ChartConfiguration: {
              FieldWells: {
                TableAggregatedFieldWells: {
                  GroupBy: [dim('region')],
                  Values: [sum('revenue'), sum('orders')],
                },
              },
            },
          },
        },
        {
          BarChartVisual: {
            VisualId: 'bar-trend',
            Title: title('Trend'),
            ChartConfiguration: {
              FieldWells: {
                BarChartAggregatedFieldWells: {
                  Category: [dateDim('order_date', 'MONTH')],
                  Values: [sum('revenue')],
                },
              },
            },
          },
        },
      ],
      TextBoxes: [
        { SheetTextBoxId: 'hdr-title', Content: '<block>Monthly sales report</block>' },
        { SheetTextBoxId: 'ftr-page', Content: '<block>Confidential - page <<page>></block>' },
      ],
      Layouts: [
        {
          Configuration: {
            SectionBasedLayout: {
              CanvasSizeOptions: {
                PaperCanvasSizeOptions: { PaperSize: 'US_LETTER', PaperOrientation: 'PORTRAIT' },
              },
              HeaderSections: [
                {
                  SectionId: 'hdr',
                  Layout: {
                    FreeFormLayout: {
                      Elements: [
                        {
                          ElementId: 'hdr-title',
                          ElementType: 'TEXT_BOX',
                          XAxisLocation: '0px',
                          YAxisLocation: '0px',
                          Width: '612px',
                          Height: '40px',
                        },
                      ],
                    },
                  },
                },
              ],
              BodySections: [
                {
                  SectionId: 'body-1',
                  Layout: {
                    FreeFormLayout: {
                      Elements: [
                        {
                          ElementId: 'tbl-summary',
                          ElementType: 'VISUAL',
                          XAxisLocation: '0px',
                          YAxisLocation: '0px',
                          Width: '612px',
                          Height: '300px',
                        },
                      ],
                    },
                  },
                },
                {
                  SectionId: 'body-2',
                  Layout: {
                    FreeFormLayout: {
                      Elements: [
                        {
                          ElementId: 'bar-trend',
                          ElementType: 'VISUAL',
                          XAxisLocation: '0px',
                          YAxisLocation: '0px',
                          Width: '612px',
                          Height: '260px',
                        },
                      ],
                    },
                  },
                },
              ],
              FooterSections: [
                {
                  SectionId: 'ftr',
                  Layout: {
                    FreeFormLayout: {
                      Elements: [
                        {
                          ElementId: 'ftr-page',
                          ElementType: 'TEXT_BOX',
                          XAxisLocation: '0px',
                          YAxisLocation: '0px',
                          Width: '612px',
                          Height: '24px',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

/** Nothing to draw. */
export const emptyDefinition = {};
