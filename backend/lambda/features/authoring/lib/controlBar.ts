/**
 * A sheet's control bar: the collapsible strip at the top of a sheet where
 * QuickSight puts filter and parameter controls by default
 * (SheetControlLayouts). A control there is not on the canvas grid
 * (Layouts); both kinds are declared in FilterControls/ParameterControls,
 * so where a control sits is only known from these two layouts.
 */

/** Width of one control in the bar, in the bar's grid units, as QuickSight exports it. */
const CONTROL_BAR_SPAN = 2;

export interface ControlBarElement {
  ElementId: string;
  ElementType: 'FILTER_CONTROL' | 'PARAMETER_CONTROL';
  ColumnSpan: number;
  RowSpan: number;
}

/** The elements in a sheet's control bar, in order. */
export function controlBarElements(sheet: any): ControlBarElement[] {
  const layouts = Array.isArray(sheet?.SheetControlLayouts) ? sheet.SheetControlLayouts : [];
  return layouts.flatMap((l: any) =>
    Array.isArray(l?.Configuration?.GridLayout?.Elements) ? l.Configuration.GridLayout.Elements : []
  );
}

export function controlBarIds(sheet: any): Set<string> {
  return new Set(controlBarElements(sheet).map((e) => e.ElementId));
}

/** Controls, in order, as a control bar. */
export function controlBar(
  controls: Array<{ id: string; type: ControlBarElement['ElementType']; span?: number }>
): any[] {
  if (controls.length === 0) {
    return [];
  }
  return [
    {
      Configuration: {
        GridLayout: {
          Elements: controls.map((c) => ({
            ElementId: c.id,
            ElementType: c.type,
            ColumnSpan: c.span ?? CONTROL_BAR_SPAN,
            RowSpan: 1,
          })),
        },
      },
    },
  ];
}
