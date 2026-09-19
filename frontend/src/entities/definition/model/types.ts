/**
 * Wireframe model - what the renderer draws.
 *
 * A pure projection of a QuickSight dashboard/analysis Definition: sheets,
 * where each element sits, what type of visual it is and which fields it
 * reads. No data, no formatting, no colours. That is deliberate: the same
 * model can be built from a live definition, a cached export, or a proposed
 * clone/rebind, and compared by eye.
 */

export type WireframeLayoutKind = 'grid' | 'freeform' | 'section' | 'flow';

export type WireframeElementKind =
  | 'visual'
  | 'filterControl'
  | 'parameterControl'
  | 'textBox'
  | 'image'
  | 'other';

export type WireframeSectionRole = 'header' | 'body' | 'footer';

export interface WireframeField {
  /** Column name, calculated-field id, or whatever best names the field. */
  label: string;
  dataSetIdentifier?: string;
  /** SUM, COUNT, DISTINCT_COUNT, PERCENTILE(90) ... */
  aggregation?: string;
  /** Date dimension granularity: YEAR, MONTH, DAY ... */
  granularity?: string;
}

export interface WireframeFieldWell {
  /** Category, Values, Colors, Rows, Columns, GroupBy ... as QuickSight names them. */
  role: string;
  fields: WireframeField[];
}

export type WireframePosition =
  /**
   * GridLayout: 36 columns wide, integer rows. QuickSight leaves `col` and
   * `row` out when tiles simply flow left to right; then only the spans are
   * known and the renderer auto-places the tile after the previous one.
   */
  | { type: 'grid'; col?: number; colSpan: number; row?: number; rowSpan: number }
  /** FreeFormLayout and SectionBasedLayout: absolute pixels on the canvas. */
  | { type: 'freeform'; x: number; y: number; width: number; height: number }
  /** No layout information; render in order. */
  | { type: 'flow'; index: number };

export interface WireframeElement {
  id: string;
  kind: WireframeElementKind;
  /** Visuals: BarChart, KPI, PivotTable ... Controls: Dropdown, Slider ... */
  visualType?: string;
  title?: string;
  /** The title exists in the definition but QuickSight does not show it. */
  titleHidden?: boolean;
  subtitle?: string;
  position: WireframePosition;
  fieldWells: WireframeFieldWell[];
  /** Section-based layouts only: which page band the element belongs to. */
  section?: { id: string; role: WireframeSectionRole };
}

export interface WireframeSheet {
  id: string;
  name: string;
  layout: WireframeLayoutKind;
  /** The designed viewport width in px, when the layout declares one. */
  canvasWidth?: number;
  /** Elements placed on the canvas by the sheet's layout. */
  elements: WireframeElement[];
  /**
   * Controls that live in the sheet's control bar (SheetControlLayouts) or
   * are defined but not placed on the canvas. QuickSight draws these in a
   * collapsible strip above the sheet.
   */
  controlBar: WireframeElement[];
}

export interface WireframeDataset {
  identifier: string;
  dataSetId: string;
}

export interface WireframeModel {
  sheets: WireframeSheet[];
  datasets: WireframeDataset[];
  visualCount: number;
  parameterCount: number;
  filterGroupCount: number;
  calculatedFieldCount: number;
}

/** A health note drawn on a wireframe card, from QuickSight's CloudWatch metrics. */
export interface WireframeBadge {
  /** timing is neutral (a load time that is fine); slow and error are warnings. */
  kind: 'timing' | 'slow' | 'error';
  /** The tooltip. */
  label: string;
  /** The short text on the card, e.g. "2.1s". */
  value?: string;
}

/** Badges keyed by element id. */
export type WireframeBadges = Map<string, WireframeBadge>;
