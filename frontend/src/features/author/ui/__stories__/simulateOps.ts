/**
 * A story-side stand-in for the server's preview: applies rebinds and ops to
 * a raw QuickSight definition the way the authoring slice does, and returns
 * the plain-language change list and the outline the UI expects.
 *
 * Only what the stories need: grid layouts, the seven ops, column renames.
 */
import { buildWireframeModel } from '@/entities/definition';

import type {
  DefinitionChange,
  DefinitionOp,
  RebindRequest,
  SheetOutline,
} from '@/shared/api/modules/authoring';

import { outlineFromModel, typeWords } from '../../lib/ops';

type Json = Record<string, any>;

const VISUAL_KEY = /Visual$/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function visualEntry(wrapper: Json): [string, Json] | null {
  const key = Object.keys(wrapper).find((k) => VISUAL_KEY.test(k));
  return key ? [key, wrapper[key]] : null;
}

function findVisual(
  sheet: Json,
  visualId: string
): { index: number; key: string; body: Json } | null {
  const visuals: Json[] = Array.isArray(sheet.Visuals) ? sheet.Visuals : [];
  for (let index = 0; index < visuals.length; index += 1) {
    const entry = visualEntry(visuals[index]!);
    if (entry && entry[1].VisualId === visualId) {
      return { index, key: entry[0], body: entry[1] };
    }
  }
  return null;
}

function layoutElements(sheet: Json): Json[] {
  const grid = sheet.Layouts?.[0]?.Configuration?.GridLayout;
  if (!grid) {
    return [];
  }
  grid.Elements = Array.isArray(grid.Elements) ? grid.Elements : [];
  return grid.Elements;
}

function visualTitle(body: Json): string {
  const format = body.Title?.FormatText;
  const raw: string = format?.PlainText ?? format?.RichText ?? body.VisualId;
  return String(raw)
    .replace(/<[^>]*>/g, '')
    .trim();
}

/** Field wells live under a `<Type>AggregatedFieldWells` key; move them across. */
function retypeBody(body: Json, from: string, to: string): Json {
  const next = clone(body);
  const wells = next.ChartConfiguration?.FieldWells;
  if (wells) {
    const oldKey = Object.keys(wells).find((k) => k.startsWith(from));
    if (oldKey) {
      const inner = wells[oldKey];
      delete wells[oldKey];
      wells[`${to}AggregatedFieldWells`] = inner;
    }
  }
  return next;
}

function applyOp(definition: Json, op: DefinitionOp, changes: DefinitionChange[]): void {
  const sheet: Json | undefined = (definition.Sheets ?? []).find(
    (s: Json) => s.SheetId === op.sheetId
  );
  if (!sheet) {
    return;
  }
  const sheetName = String(sheet.Name ?? op.sheetId);
  const elements = layoutElements(sheet);
  const element = elements.find((e) => e.ElementId === op.elementId);
  const visual = op.elementId ? findVisual(sheet, op.elementId) : null;
  const name = visual ? `"${visualTitle(visual.body)}"` : (op.elementId ?? '');

  switch (op.op) {
    case 'renameSheet':
      changes.push({
        kind: 'sheet',
        sheetId: op.sheetId,
        description: `Sheet "${sheetName}" renamed to "${op.name ?? ''}"`,
      });
      sheet.Name = op.name;
      return;
    case 'move':
      if (element) {
        element.ColumnIndex = op.col;
        element.RowIndex = op.row;
        changes.push({
          kind: 'layout',
          sheetId: op.sheetId,
          elementId: op.elementId,
          description: `${name} moved to column ${op.col}, row ${op.row} on "${sheetName}"`,
        });
      }
      return;
    case 'resize':
      if (element) {
        element.ColumnSpan = op.colSpan;
        element.RowSpan = op.rowSpan;
        changes.push({
          kind: 'layout',
          sheetId: op.sheetId,
          elementId: op.elementId,
          description: `${name} resized to ${op.colSpan} × ${op.rowSpan} on "${sheetName}"`,
        });
      }
      return;
    case 'remove':
      if (element) {
        elements.splice(elements.indexOf(element), 1);
      }
      if (visual) {
        sheet.Visuals.splice(visual.index, 1);
      }
      changes.push({
        kind: 'layout',
        sheetId: op.sheetId,
        elementId: op.elementId,
        description: `${name} removed from "${sheetName}"`,
      });
      return;
    case 'retitle':
      if (visual) {
        if (op.title !== undefined) {
          visual.body.Title = { Visibility: 'VISIBLE', FormatText: { PlainText: op.title } };
        }
        if (op.subtitle !== undefined) {
          visual.body.Subtitle = op.subtitle
            ? { Visibility: 'VISIBLE', FormatText: { PlainText: op.subtitle } }
            : undefined;
        }
        changes.push({
          kind: 'visual',
          sheetId: op.sheetId,
          elementId: op.elementId,
          description:
            op.title !== undefined
              ? `${name} retitled to "${op.title}"`
              : `${name} subtitle set to "${op.subtitle ?? ''}"`,
        });
      }
      return;
    case 'retype':
      if (visual && op.visualType) {
        const from = visual.key.replace(VISUAL_KEY, '');
        sheet.Visuals[visual.index] = {
          [`${op.visualType}Visual`]: retypeBody(visual.body, from, op.visualType),
        };
        changes.push({
          kind: 'visual',
          sheetId: op.sheetId,
          elementId: op.elementId,
          description: `${name} changed from ${typeWords(from)} to ${typeWords(op.visualType)}; axis, legend and sort settings reset`,
        });
      }
      return;
    case 'duplicate':
      if (visual) {
        const newId = `${op.elementId}-copy-${sheet.Visuals.length}`;
        const body = clone(visual.body);
        body.VisualId = newId;
        if (op.title) {
          body.Title = { Visibility: 'VISIBLE', FormatText: { PlainText: op.title } };
        }
        sheet.Visuals.push({ [visual.key]: body });
        if (element) {
          elements.push({
            ...element,
            ElementId: newId,
            ColumnIndex: op.col ?? element.ColumnIndex,
            RowIndex: op.row ?? Number(element.RowIndex ?? 0) + Number(element.RowSpan ?? 1),
          });
        }
        changes.push({
          kind: 'layout',
          sheetId: op.sheetId,
          elementId: newId,
          description: `${name} duplicated as "${op.title ?? visualTitle(visual.body)}" on "${sheetName}"`,
        });
      }
      return;
    default:
      return;
  }
}

interface SimulatedPreview {
  definition: Json;
  changes: DefinitionChange[];
  outline: SheetOutline[];
}

/** Rewrites column names the way the server's preview does. */
function rewriteColumns(definition: unknown, identifier: string, map: Record<string, string>) {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const record = node as Json;
      if (record.DataSetIdentifier === identifier && typeof record.ColumnName === 'string') {
        return { ...record, ColumnName: map[record.ColumnName] ?? record.ColumnName };
      }
      const out: Json = {};
      for (const [k, v] of Object.entries(record)) out[k] = walk(v);
      return out;
    }
    return node;
  };
  return walk(definition) as Json;
}

export function simulatePreview(
  source: unknown,
  rebinds: Array<RebindRequest & { targetName?: string }> = [],
  addCalculatedFields: Array<{ identifier: string; name: string; expression: string }> = [],
  ops: DefinitionOp[] = []
): SimulatedPreview {
  const changes: DefinitionChange[] = [];
  let definition = clone(source) as Json;

  for (const rebind of rebinds) {
    changes.push({
      kind: 'rebind',
      description: `Dataset "${rebind.identifier}" now reads ${rebind.targetName ?? rebind.targetDataSetId}`,
    });
    const map = rebind.columnMap ?? {};
    for (const [from, to] of Object.entries(map)) {
      changes.push({
        kind: 'rename',
        description: `Column ${from} renamed to ${to} in "${rebind.identifier}"`,
      });
    }
    definition = rewriteColumns(definition, rebind.identifier, map);
  }

  for (const field of addCalculatedFields) {
    definition.CalculatedFields = [
      ...(definition.CalculatedFields ?? []),
      { DataSetIdentifier: field.identifier, Name: field.name, Expression: field.expression },
    ];
    changes.push({
      kind: 'calculatedField',
      description: `Calculated field ${field.name} added to "${field.identifier}"`,
    });
  }

  for (const op of ops) {
    applyOp(definition, op, changes);
  }

  return { definition, changes, outline: outlineFromModel(buildWireframeModel(definition)) };
}
