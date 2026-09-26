/**
 * What changed between two wireframes of the same definition.
 *
 * Fields are compared by position (same sheet, element, well role, index):
 * a rebind only renames columns, so a field whose label differs is a
 * rename. Elements are compared by id: one that moved, changed size or
 * type, appeared, or disappeared is an element change. The result is keyed
 * so a renderer can look a chip or a card up while drawing.
 */
import type { WireframeElement, WireframeModel, WireframePosition } from '../model/types';

export interface FieldRename {
  from: string;
  to: string;
}

type ElementChangeKind = 'moved' | 'resized' | 'retyped' | 'added' | 'removed';

export interface ElementChange {
  kind: ElementChangeKind;
  /** Human-readable before/after (a position, a size, a visual type). */
  from?: string;
  to?: string;
}

/** `sheetId/elementId/role/index` */
export type WireframeFieldKey = string;
/** `sheetId/elementId` */
export type WireframeElementKey = string;

export interface WireframeDiff {
  renames: Map<WireframeFieldKey, FieldRename>;
  elements: Map<WireframeElementKey, ElementChange[]>;
  /** Renames plus element changes, for a quick "anything changed?" */
  size: number;
}

export function fieldKey(
  sheetId: string,
  elementId: string,
  role: string,
  index: number
): WireframeFieldKey {
  return `${sheetId}/${elementId}/${role}/${index}`;
}

export function elementKey(sheetId: string, elementId: string): WireframeElementKey {
  return `${sheetId}/${elementId}`;
}

function elementsOf(model: WireframeModel): Array<{ sheetId: string; element: WireframeElement }> {
  return model.sheets.flatMap((sheet) =>
    [...sheet.elements, ...sheet.controlBar].map((element) => ({ sheetId: sheet.id, element }))
  );
}

function place(position: WireframePosition): string | undefined {
  if (position.type === 'grid') {
    return position.col !== undefined && position.row !== undefined
      ? `${position.col},${position.row}`
      : undefined;
  }
  if (position.type === 'freeform') {
    return `${Math.round(position.x)},${Math.round(position.y)}`;
  }
  return undefined;
}

function size(position: WireframePosition): string | undefined {
  if (position.type === 'grid') {
    return `${position.colSpan}×${position.rowSpan}`;
  }
  if (position.type === 'freeform') {
    return `${Math.round(position.width)}×${Math.round(position.height)}`;
  }
  return undefined;
}

export function emptyDiff(): WireframeDiff {
  return { renames: new Map(), elements: new Map(), size: 0 };
}

export function diffWireframeModels(before: WireframeModel, after: WireframeModel): WireframeDiff {
  const renames: WireframeDiff['renames'] = new Map();
  const elements: WireframeDiff['elements'] = new Map();
  const previous = new Map(
    elementsOf(before).map(({ sheetId, element }) => [elementKey(sheetId, element.id), element])
  );
  const seen = new Set<WireframeElementKey>();

  for (const { sheetId, element } of elementsOf(after)) {
    const key = elementKey(sheetId, element.id);
    seen.add(key);
    const old = previous.get(key);
    if (!old) {
      elements.set(key, [{ kind: 'added' }]);
      continue;
    }

    const changes: ElementChange[] = [];
    if (old.kind === 'visual' && old.visualType !== element.visualType) {
      changes.push({ kind: 'retyped', from: old.visualType, to: element.visualType });
    }
    const oldPlace = place(old.position);
    const newPlace = place(element.position);
    if (oldPlace !== newPlace && newPlace !== undefined) {
      changes.push({ kind: 'moved', from: oldPlace, to: newPlace });
    }
    const oldSize = size(old.position);
    const newSize = size(element.position);
    if (oldSize !== newSize && newSize !== undefined) {
      changes.push({ kind: 'resized', from: oldSize, to: newSize });
    }
    if (changes.length > 0) {
      elements.set(key, changes);
    }

    // Field renames, by position within each well.
    for (const well of element.fieldWells) {
      const oldWell = old.fieldWells.find((w) => w.role === well.role);
      if (!oldWell) {
        continue;
      }
      well.fields.forEach((field, index) => {
        const oldField = oldWell.fields[index];
        if (oldField && oldField.label !== field.label) {
          renames.set(fieldKey(sheetId, element.id, well.role, index), {
            from: oldField.label,
            to: field.label,
          });
        }
      });
    }
  }

  for (const key of previous.keys()) {
    if (!seen.has(key)) {
      elements.set(key, [{ kind: 'removed' }]);
    }
  }

  return { renames, elements, size: renames.size + elements.size };
}

/** The renames that belong to one element, keyed `role/index` for the card. */
export function elementRenames(
  diff: WireframeDiff | undefined,
  sheetId: string,
  elementId: string
): Map<string, FieldRename> | undefined {
  if (!diff || diff.renames.size === 0) {
    return undefined;
  }
  const prefix = `${sheetId}/${elementId}/`;
  const own = new Map<string, FieldRename>();
  for (const [key, rename] of diff.renames) {
    if (key.startsWith(prefix)) {
      own.set(key.slice(prefix.length), rename);
    }
  }
  return own.size > 0 ? own : undefined;
}

/** The element-level changes of one card, if any. */
export function elementChanges(
  diff: WireframeDiff | undefined,
  sheetId: string,
  elementId: string
): ElementChange[] | undefined {
  return diff?.elements.get(elementKey(sheetId, elementId));
}

/** Only the elements that disappeared, for drawing ghosts on the "before" view. */
export function removedOnly(diff: WireframeDiff | undefined): WireframeDiff | undefined {
  if (!diff) {
    return undefined;
  }
  const elements = new Map(
    [...diff.elements].filter(([, changes]) => changes.some((c) => c.kind === 'removed'))
  );
  return { renames: new Map(), elements, size: elements.size };
}

type DiffSummary = Record<ElementChangeKind | 'renamed', number>;

/** Counts by kind, for summary chips. */
export function summarizeDiff(diff: WireframeDiff | undefined): DiffSummary {
  const out: DiffSummary = {
    renamed: diff?.renames.size ?? 0,
    moved: 0,
    resized: 0,
    retyped: 0,
    added: 0,
    removed: 0,
  };
  for (const changes of diff?.elements.values() ?? []) {
    for (const change of changes) {
      out[change.kind] += 1;
    }
  }
  return out;
}
