/**
 * QuickSight visual types and related constants
 */

/**
 * Map of QuickSight visual property names to their display type names
 * These are the property names used in the QuickSight API responses
 */
const VISUAL_TYPE_MAP = {
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
const VISUAL_TYPES = {
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
type VisualPropertyName = keyof typeof VISUAL_TYPE_MAP;

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
