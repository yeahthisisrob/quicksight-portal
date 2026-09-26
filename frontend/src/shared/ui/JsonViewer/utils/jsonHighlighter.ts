/**
 * What each highlight chip marks in an asset's JSON: the key patterns, and
 * the section to jump to first when there is one. Monaco draws the marks.
 */
export type HighlightType =
  | 'FIELDS'
  | 'CALCULATED_FIELDS'
  | 'VISUALS'
  | 'SHEETS'
  | 'DATASET'
  | 'DATASOURCE'
  | 'FILTERS'
  | 'EXPRESSIONS'
  | null;

export const highlightConfigs: Record<
  Exclude<HighlightType, null>,
  { patterns: string[]; jumpTo: string | null }
> = {
  FIELDS: { patterns: ['FieldId', 'ColumnIdentifier', 'FieldName', 'Column'], jumpTo: null },
  CALCULATED_FIELDS: {
    patterns: ['CalculatedField', 'Expression', 'CalculatedColumn'],
    jumpTo: '"CalculatedFields"',
  },
  VISUALS: {
    patterns: [
      'Visual',
      'ChartConfiguration',
      'BarChart',
      'LineChart',
      'PieChart',
      'Table',
      'PivotTable',
      'KPIVisual',
    ],
    jumpTo: '"Visuals"',
  },
  SHEETS: { patterns: ['Sheet', 'Layout', 'GridLayout'], jumpTo: '"Sheets"' },
  DATASET: {
    patterns: ['DataSet', 'DataSetIdentifier'],
    jumpTo: '"DataSetIdentifierDeclarations"',
  },
  DATASOURCE: { patterns: ['DataSource', 'DataSourceArn'], jumpTo: null },
  FILTERS: { patterns: ['Filter', 'ParameterControl', 'FilterGroup'], jumpTo: '"FilterGroups"' },
  EXPRESSIONS: { patterns: ['Expression', 'Aggregation', 'AggregateFunction'], jumpTo: null },
};
