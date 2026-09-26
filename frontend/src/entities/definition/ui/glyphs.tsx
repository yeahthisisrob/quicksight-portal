/**
 * One glyph per element kind / visual type, so a wireframe card reads at a
 * glance the way a QuickSight visual does without the data.
 */

import type { SvgIconComponent } from '@mui/icons-material';
import {
  AccountTree,
  BarChart,
  CandlestickChart,
  Cloud,
  CropSquare,
  Extension,
  FilterAlt,
  GridOn,
  HelpOutlined,
  Image,
  Insights,
  Map as MapIcon,
  PieChart,
  PivotTableChart,
  Radar,
  ScatterPlot,
  ShowChart,
  Speed,
  StackedLineChart,
  TableChart,
  TextFields,
  Timeline,
  Tune,
  ViewQuilt,
  Web,
} from '@mui/icons-material';

import type { WireframeElement } from '../model/types';

const VISUAL_GLYPHS: Record<string, SvgIconComponent> = {
  BarChart: BarChart,
  Histogram: BarChart,
  LineChart: ShowChart,
  ComboChart: StackedLineChart,
  PieChart: PieChart,
  DonutChart: PieChart,
  Table: TableChart,
  PivotTable: PivotTableChart,
  KPI: Speed,
  GaugeChart: Speed,
  Insight: Insights,
  HeatMap: GridOn,
  TreeMap: ViewQuilt,
  ScatterPlot: ScatterPlot,
  FunnelChart: FilterAlt,
  WaterfallChart: Timeline,
  BoxPlot: CandlestickChart,
  GeospatialMap: MapIcon,
  FilledMap: MapIcon,
  LayerMap: MapIcon,
  RadarChart: Radar,
  SankeyDiagram: AccountTree,
  WordCloud: Cloud,
  CustomContent: Web,
  Plugin: Extension,
  Empty: CropSquare,
};

export function glyphFor(element: Pick<WireframeElement, 'kind' | 'visualType'>): SvgIconComponent {
  switch (element.kind) {
    case 'visual':
      return VISUAL_GLYPHS[element.visualType ?? ''] ?? BarChart;
    case 'filterControl':
    case 'parameterControl':
      return Tune;
    case 'textBox':
      return TextFields;
    case 'image':
      return Image;
    default:
      return HelpOutlined;
  }
}

/** "BarChart" -> "Bar chart", "KPI" -> "KPI", "PivotTable" -> "Pivot table". */
function humanize(type?: string): string {
  if (!type) return 'Visual';
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word, i) => (i === 0 || /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(' ');
}

export function kindLabel(element: Pick<WireframeElement, 'kind' | 'visualType'>): string {
  switch (element.kind) {
    case 'visual':
      return humanize(element.visualType);
    case 'filterControl':
      return `${humanize(element.visualType)} filter`;
    case 'parameterControl':
      return `${humanize(element.visualType)} parameter`;
    case 'textBox':
      return 'Text';
    case 'image':
      return 'Image';
    default:
      return 'Unknown element';
  }
}
