/**
 * QuickSight visual types and related constants
 */

/**
 * Map of QuickSight visual property names to their display type names
 * These are the property names used in the QuickSight API responses
 */
export const VISUAL_TYPE_MAP = {
  BarChartVisual: 'BarChart',
  LineChartVisual: 'LineChart',
  PieChartVisual: 'PieChart',
  TableVisual: 'Table',
  PivotTableVisual: 'PivotTable',
  KPIVisual: 'KPI',
  ScatterPlotVisual: 'ScatterPlot',
  ComboChartVisual: 'ComboChart',
  FilledMapVisual: 'FilledMap',
  FunnelChartVisual: 'FunnelChart',
  GaugeChartVisual: 'GaugeChart',
  GeospatialMapVisual: 'GeospatialMap',
  HeatMapVisual: 'HeatMap',
  HistogramVisual: 'Histogram',
  InsightVisual: 'Insight',
  SankeyDiagramVisual: 'SankeyDiagram',
  TreeMapVisual: 'TreeMap',
  WaterfallVisual: 'Waterfall',
  WordCloudVisual: 'WordCloud',
  BoxPlotVisual: 'BoxPlot',
  CustomContentVisual: 'CustomContent',
  EmptyVisual: 'Empty',
  LayerMapVisual: 'LayerMap',
  PluginVisual: 'Plugin',
  RadarChartVisual: 'RadarChart',
} as const;

/**
 * Visual type values
 */
export const VISUAL_TYPES = {
  BarChart: 'BarChart',
  LineChart: 'LineChart',
  PieChart: 'PieChart',
  Table: 'Table',
  PivotTable: 'PivotTable',
  KPI: 'KPI',
  ScatterPlot: 'ScatterPlot',
  ComboChart: 'ComboChart',
  FilledMap: 'FilledMap',
  FunnelChart: 'FunnelChart',
  GaugeChart: 'GaugeChart',
  GeospatialMap: 'GeospatialMap',
  HeatMap: 'HeatMap',
  Histogram: 'Histogram',
  Insight: 'Insight',
  SankeyDiagram: 'SankeyDiagram',
  TreeMap: 'TreeMap',
  Waterfall: 'Waterfall',
  WordCloud: 'WordCloud',
  BoxPlot: 'BoxPlot',
  CustomContent: 'CustomContent',
  Empty: 'Empty',
  LayerMap: 'LayerMap',
  Plugin: 'Plugin',
  RadarChart: 'RadarChart',
  Unknown: 'Unknown',
} as const;

export type VisualType = (typeof VISUAL_TYPES)[keyof typeof VISUAL_TYPES];
export type VisualPropertyName = keyof typeof VISUAL_TYPE_MAP;

/**
 * Chart visual types (bar, line, pie, etc.)
 */
export const CHART_VISUAL_TYPES: readonly VisualType[] = [
  VISUAL_TYPES.BarChart,
  VISUAL_TYPES.LineChart,
  VISUAL_TYPES.PieChart,
  VISUAL_TYPES.ScatterPlot,
  VISUAL_TYPES.ComboChart,
  VISUAL_TYPES.FunnelChart,
  VISUAL_TYPES.GaugeChart,
  VISUAL_TYPES.Histogram,
  VISUAL_TYPES.BoxPlot,
  VISUAL_TYPES.Waterfall,
  VISUAL_TYPES.RadarChart,
] as const;

/**
 * Table visual types
 */
export const TABLE_VISUAL_TYPES: readonly VisualType[] = [
  VISUAL_TYPES.Table,
  VISUAL_TYPES.PivotTable,
] as const;

/**
 * Map visual types
 */
export const MAP_VISUAL_TYPES: readonly VisualType[] = [
  VISUAL_TYPES.FilledMap,
  VISUAL_TYPES.GeospatialMap,
  VISUAL_TYPES.HeatMap,
  VISUAL_TYPES.LayerMap,
] as const;

/**
 * Advanced visual types
 */
export const ADVANCED_VISUAL_TYPES: readonly VisualType[] = [
  VISUAL_TYPES.SankeyDiagram,
  VISUAL_TYPES.TreeMap,
  VISUAL_TYPES.WordCloud,
  VISUAL_TYPES.Insight,
] as const;

/**
 * Special visual types
 */
export const SPECIAL_VISUAL_TYPES: readonly VisualType[] = [
  VISUAL_TYPES.KPI,
  VISUAL_TYPES.CustomContent,
  VISUAL_TYPES.Empty,
  VISUAL_TYPES.Plugin,
] as const;

/**
 * Determine visual type from a visual object
 * @param visual The visual object from QuickSight API
 * @returns The visual type string
 */
export function getVisualType(visual: any): VisualType {
  // Find the first matching visual type property
  for (const [property, type] of Object.entries(VISUAL_TYPE_MAP)) {
    if (visual[property]) {
      return type as VisualType;
    }
  }
  return VISUAL_TYPES.Unknown;
}

/**
 * Get the visual property name for a given visual type
 * @param visualType The visual type
 * @returns The property name used in QuickSight API
 */
export function getVisualPropertyName(visualType: VisualType): VisualPropertyName | undefined {
  for (const [property, type] of Object.entries(VISUAL_TYPE_MAP)) {
    if (type === visualType) {
      return property as VisualPropertyName;
    }
  }
  return undefined;
}

/**
 * Check if a visual type is a chart type
 */
export function isChartVisual(visualType: VisualType): boolean {
  return CHART_VISUAL_TYPES.includes(visualType);
}

/**
 * Check if a visual type is a table type
 */
export function isTableVisual(visualType: VisualType): boolean {
  return TABLE_VISUAL_TYPES.includes(visualType);
}

/**
 * Check if a visual type is a map type
 */
export function isMapVisual(visualType: VisualType): boolean {
  return MAP_VISUAL_TYPES.includes(visualType);
}

/**
 * Check if a visual type is an advanced type
 */
export function isAdvancedVisual(visualType: VisualType): boolean {
  return ADVANCED_VISUAL_TYPES.includes(visualType);
}

/**
 * Check if a visual type is a special type
 */
export function isSpecialVisual(visualType: VisualType): boolean {
  return SPECIAL_VISUAL_TYPES.includes(visualType);
}

/**
 * Type guard to check if a string is a valid visual type
 */
export function isVisualType(value: string): value is VisualType {
  return Object.values(VISUAL_TYPES).includes(value as VisualType);
}
