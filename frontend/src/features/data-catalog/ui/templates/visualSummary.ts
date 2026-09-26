import type { TemplateVisual } from '@/shared/api/modules/data-catalog';

const TYPE_NAMES: Record<TemplateVisual['type'], string> = {
  KPI: 'KPI',
  BarChart: 'Bar chart',
  ColumnChart: 'Column chart',
  LineChart: 'Line chart',
  PieChart: 'Pie chart',
  DonutChart: 'Donut chart',
  Table: 'Table',
  PivotTable: 'Pivot table',
};

export const VISUAL_TYPES = Object.keys(TYPE_NAMES) as Array<TemplateVisual['type']>;

export function visualTypeName(type: TemplateVisual['type']): string {
  return TYPE_NAMES[type] ?? type;
}

/** "Line chart of SUM(revenue) by order_date, by month". */
export function describeVisual(visual: TemplateVisual): string {
  const values = visual.values.map((v) => `${v.aggregation ?? 'SUM'}(${v.column})`).join(', ');
  return [
    `${visualTypeName(visual.type)} of ${values}`,
    visual.category ? ` by ${visual.category}` : '',
    visual.granularity ? `, by ${visual.granularity.toLowerCase()}` : '',
    visual.color ? `, split by ${visual.color}` : '',
  ].join('');
}
