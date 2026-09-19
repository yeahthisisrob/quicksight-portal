/**
 * What changed between two wireframes of the same definition.
 *
 * A rebind keeps every visual, well and field position and only renames
 * columns, so fields are compared by position: same sheet, same element,
 * same well role, same index. A field whose label differs is a rename. The
 * result is keyed so a renderer can look a chip up while drawing.
 */
import type { WireframeElement, WireframeModel } from '../model/types';

export interface FieldRename {
  from: string;
  to: string;
}

/** `sheetId/elementId/role/index` */
export type WireframeFieldKey = string;

export type WireframeDiff = Map<WireframeFieldKey, FieldRename>;

export function fieldKey(
  sheetId: string,
  elementId: string,
  role: string,
  index: number
): WireframeFieldKey {
  return `${sheetId}/${elementId}/${role}/${index}`;
}

function elementsOf(model: WireframeModel): Array<{ sheetId: string; element: WireframeElement }> {
  return model.sheets.flatMap((sheet) =>
    [...sheet.elements, ...sheet.controlBar].map((element) => ({ sheetId: sheet.id, element }))
  );
}

export function diffWireframeModels(before: WireframeModel, after: WireframeModel): WireframeDiff {
  const diff: WireframeDiff = new Map();
  const previous = new Map(
    elementsOf(before).map(({ sheetId, element }) => [`${sheetId}/${element.id}`, element])
  );

  for (const { sheetId, element } of elementsOf(after)) {
    const old = previous.get(`${sheetId}/${element.id}`);
    if (!old) {
      continue;
    }
    for (const well of element.fieldWells) {
      const oldWell = old.fieldWells.find((w) => w.role === well.role);
      if (!oldWell) {
        continue;
      }
      well.fields.forEach((field, index) => {
        const oldField = oldWell.fields[index];
        if (oldField && oldField.label !== field.label) {
          diff.set(fieldKey(sheetId, element.id, well.role, index), {
            from: oldField.label,
            to: field.label,
          });
        }
      });
    }
  }
  return diff;
}

/** The renames that belong to one element, keyed `role/index` for the card. */
export function elementRenames(
  diff: WireframeDiff | undefined,
  sheetId: string,
  elementId: string
): Map<string, FieldRename> | undefined {
  if (!diff || diff.size === 0) {
    return undefined;
  }
  const prefix = `${sheetId}/${elementId}/`;
  const own = new Map<string, FieldRename>();
  for (const [key, rename] of diff) {
    if (key.startsWith(prefix)) {
      own.set(key.slice(prefix.length), rename);
    }
  }
  return own.size > 0 ? own : undefined;
}
