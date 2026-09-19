/**
 * Layout extraction - where each element sits on a sheet.
 *
 * A sheet has `Layouts[0].Configuration` holding exactly one of:
 *   GridLayout          { Elements: [{ ElementId, ElementType, ColumnIndex, ColumnSpan, RowIndex, RowSpan }] }
 *   FreeFormLayout      { Elements: [{ ElementId, ElementType, XAxisLocation: '12px', YAxisLocation, Width, Height }] }
 *   SectionBasedLayout  { HeaderSections, BodySections, FooterSections: [{ SectionId, Layout: { FreeFormLayout } }] }
 *
 * Controls placed in the sheet's control strip use `SheetControlLayouts`
 * with the same GridLayout shape; those are reported separately so the
 * renderer can draw the strip QuickSight draws.
 */

import type { WireframeLayoutKind, WireframePosition, WireframeSectionRole } from '../model/types';

export interface PlacedElement {
  elementId: string;
  elementType?: string;
  position: WireframePosition;
  section?: { id: string; role: WireframeSectionRole };
}

export interface SheetLayout {
  kind: WireframeLayoutKind;
  canvasWidth?: number;
  placed: PlacedElement[];
  controlStrip: PlacedElement[];
}

/** `'123px'` -> 123. Anything unparseable is 0. */
export function px(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function gridElements(layout: any): PlacedElement[] {
  const elements: unknown[] = Array.isArray(layout?.Elements) ? layout.Elements : [];
  return elements
    .filter((e): e is Record<string, any> => typeof e === 'object' && e !== null)
    .map((e) => ({
      elementId: String(e.ElementId ?? ''),
      elementType: e.ElementType,
      position: {
        type: 'grid',
        // Absent indexes mean "flow after the previous tile", not (0, 0).
        ...(e.ColumnIndex !== undefined && e.ColumnIndex !== null
          ? { col: Number(e.ColumnIndex) }
          : {}),
        colSpan: Math.max(1, Number(e.ColumnSpan ?? 1)),
        ...(e.RowIndex !== undefined && e.RowIndex !== null ? { row: Number(e.RowIndex) } : {}),
        rowSpan: Math.max(1, Number(e.RowSpan ?? 1)),
      },
    }));
}

function freeFormElements(
  layout: any,
  section?: { id: string; role: WireframeSectionRole }
): PlacedElement[] {
  const elements: unknown[] = Array.isArray(layout?.Elements) ? layout.Elements : [];
  return elements
    .filter((e): e is Record<string, any> => typeof e === 'object' && e !== null)
    .map((e) => ({
      elementId: String(e.ElementId ?? ''),
      elementType: e.ElementType,
      position: {
        type: 'freeform',
        x: px(e.XAxisLocation),
        y: px(e.YAxisLocation),
        width: px(e.Width),
        height: px(e.Height),
      },
      ...(section ? { section } : {}),
    }));
}

function sectionElements(layout: any): PlacedElement[] {
  const bands: Array<[WireframeSectionRole, string]> = [
    ['header', 'HeaderSections'],
    ['body', 'BodySections'],
    ['footer', 'FooterSections'],
  ];
  const placed: PlacedElement[] = [];
  for (const [role, key] of bands) {
    const sections: unknown[] = Array.isArray(layout?.[key]) ? layout[key] : [];
    sections.forEach((section: any, index) => {
      const id = String(section?.SectionId ?? `${role}-${index}`);
      placed.push(...freeFormElements(section?.Layout?.FreeFormLayout, { id, role }));
    });
  }
  return placed;
}

function canvasWidth(layout: any): number | undefined {
  const width = layout?.CanvasSizeOptions?.ScreenCanvasSizeOptions?.OptimizedViewPortWidth;
  const parsed = px(width);
  return parsed > 0 ? parsed : undefined;
}

export function readSheetLayout(sheet: any): SheetLayout {
  const configuration = sheet?.Layouts?.[0]?.Configuration ?? {};
  const controlStrip = (Array.isArray(sheet?.SheetControlLayouts) ? sheet.SheetControlLayouts : [])
    .flatMap((l: any) => gridElements(l?.Configuration?.GridLayout));

  if (configuration.GridLayout) {
    return {
      kind: 'grid',
      canvasWidth: canvasWidth(configuration.GridLayout),
      placed: gridElements(configuration.GridLayout),
      controlStrip,
    };
  }
  if (configuration.FreeFormLayout) {
    return {
      kind: 'freeform',
      canvasWidth: canvasWidth(configuration.FreeFormLayout),
      placed: freeFormElements(configuration.FreeFormLayout),
      controlStrip,
    };
  }
  if (configuration.SectionBasedLayout) {
    return {
      kind: 'section',
      canvasWidth: canvasWidth(configuration.SectionBasedLayout),
      placed: sectionElements(configuration.SectionBasedLayout),
      controlStrip,
    };
  }
  return { kind: 'flow', placed: [], controlStrip };
}
