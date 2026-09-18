/**
 * Build a WireframeModel from a QuickSight dashboard/analysis Definition.
 *
 * Pure and total: any input shape yields a model. Unknown visuals, missing
 * layouts and half-formed elements degrade to `other` / `flow` rather than
 * throwing, because a wireframe of a slightly odd definition is still worth
 * more than an error.
 */

import type {
  WireframeElement,
  WireframeElementKind,
  WireframeModel,
  WireframeSheet,
} from '../model/types';
import { collectFieldWells } from './fieldWells';
import { type PlacedElement, readSheetLayout } from './layout';
import { readLabel, snippet } from './text';

type Draft = Omit<WireframeElement, 'id' | 'position'>;

const VISUAL_KEY = /Visual$/;

const KIND_BY_ELEMENT_TYPE: Record<string, WireframeElementKind> = {
  VISUAL: 'visual',
  FILTER_CONTROL: 'filterControl',
  PARAMETER_CONTROL: 'parameterControl',
  TEXT_BOX: 'textBox',
  IMAGE: 'image',
};

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

/** `{ BarChartVisual: {...} }` -> ['BarChartVisual', {...}]; null when malformed. */
function singleEntry(wrapper: unknown, keyPattern?: RegExp): [string, any] | null {
  if (typeof wrapper !== 'object' || wrapper === null) return null;
  const keys = Object.keys(wrapper);
  const key = keyPattern ? keys.find((k) => keyPattern.test(k)) : keys[0];
  if (!key) return null;
  const body = (wrapper as Record<string, any>)[key];
  return typeof body === 'object' && body !== null ? [key, body] : null;
}

function visualDraft(wrapper: unknown): [string, Draft] | null {
  const entry = singleEntry(wrapper, VISUAL_KEY);
  if (!entry) return null;
  const [key, body] = entry;
  const title = readLabel(body.Title);
  const subtitle = readLabel(body.Subtitle);
  return [
    String(body.VisualId ?? ''),
    {
      kind: 'visual',
      visualType: key.replace(VISUAL_KEY, ''),
      title: title.text,
      titleHidden: title.hidden || undefined,
      subtitle: subtitle.hidden ? undefined : subtitle.text,
      fieldWells: collectFieldWells(body.ChartConfiguration?.FieldWells),
    },
  ];
}

function controlDraft(
  wrapper: unknown,
  kind: 'filterControl' | 'parameterControl',
  idKey: string
): [string, Draft] | null {
  const entry = singleEntry(wrapper);
  if (!entry) return null;
  const [key, body] = entry;
  const title = typeof body.Title === 'string' ? body.Title.trim() : undefined;
  return [
    String(body[idKey] ?? ''),
    { kind, visualType: key, title: title || undefined, fieldWells: [] },
  ];
}

/** Everything a sheet defines, keyed by element id, before layout is applied. */
function catalogSheet(sheet: any): Map<string, Draft> {
  const catalog = new Map<string, Draft>();
  const add = (entry: [string, Draft] | null) => {
    if (entry?.[0]) catalog.set(entry[0], entry[1]);
  };

  for (const v of asArray(sheet?.Visuals)) add(visualDraft(v));
  for (const c of asArray(sheet?.FilterControls)) {
    add(controlDraft(c, 'filterControl', 'FilterControlId'));
  }
  for (const c of asArray(sheet?.ParameterControls)) {
    add(controlDraft(c, 'parameterControl', 'ParameterControlId'));
  }
  for (const t of asArray(sheet?.TextBoxes)) {
    if (t?.SheetTextBoxId) {
      catalog.set(String(t.SheetTextBoxId), {
        kind: 'textBox',
        title: snippet(t.Content),
        fieldWells: [],
      });
    }
  }
  for (const img of asArray(sheet?.Images)) {
    if (img?.SheetImageId) {
      catalog.set(String(img.SheetImageId), {
        kind: 'image',
        title: typeof img.ImageContentAltText === 'string' ? img.ImageContentAltText : undefined,
        fieldWells: [],
      });
    }
  }
  return catalog;
}

function place(placed: PlacedElement, catalog: Map<string, Draft>): WireframeElement {
  const draft = catalog.get(placed.elementId) ?? {
    kind: KIND_BY_ELEMENT_TYPE[placed.elementType ?? ''] ?? 'other',
    fieldWells: [],
  };
  return {
    ...draft,
    id: placed.elementId,
    position: placed.position,
    ...(placed.section ? { section: placed.section } : {}),
  };
}

const isControl = (draft: Draft) =>
  draft.kind === 'filterControl' || draft.kind === 'parameterControl';

function buildSheet(sheet: any, index: number): WireframeSheet {
  const catalog = catalogSheet(sheet);
  const layout = readSheetLayout(sheet);

  const elements = layout.placed.map((p) => place(p, catalog));
  const controlBar = layout.controlStrip.map((p) => place(p, catalog));
  const seen = new Set([...elements, ...controlBar].map((e) => e.id));

  // Defined but never placed: controls go to the strip (QuickSight's default
  // home for them), anything else is appended in definition order.
  for (const [id, draft] of catalog) {
    if (seen.has(id)) continue;
    const target = isControl(draft) ? controlBar : elements;
    target.push({ ...draft, id, position: { type: 'flow', index: target.length } });
  }

  return {
    id: String(sheet?.SheetId ?? `sheet-${index}`),
    name: String(sheet?.Name ?? sheet?.Title ?? `Sheet ${index + 1}`),
    layout: layout.kind,
    canvasWidth: layout.canvasWidth,
    elements,
    controlBar,
  };
}

export function buildWireframeModel(definition: any): WireframeModel {
  const sheets = asArray(definition?.Sheets).map(buildSheet);

  const datasets = asArray(definition?.DataSetIdentifierDeclarations)
    .filter((d) => d && typeof d.Identifier === 'string')
    .map((d) => ({
      identifier: d.Identifier as string,
      dataSetId: typeof d.DataSetArn === 'string' ? (d.DataSetArn.split('/').pop() ?? '') : '',
    }));

  return {
    sheets,
    datasets,
    visualCount: sheets.reduce(
      (n, s) => n + s.elements.filter((e) => e.kind === 'visual').length,
      0
    ),
    parameterCount: asArray(definition?.ParameterDeclarations).length,
    filterGroupCount: asArray(definition?.FilterGroups).length,
    calculatedFieldCount: asArray(definition?.CalculatedFields).length,
  };
}
