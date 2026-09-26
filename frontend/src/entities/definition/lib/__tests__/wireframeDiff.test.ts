import { describe, expect, it } from 'vitest';

import type { WireframeElement, WireframeModel } from '../../model/types';
import { gridDashboardDefinition } from '../__fixtures__/definitions';
import {
  diffWireframeModels,
  elementChanges,
  elementKey,
  elementRenames,
  emptyDiff,
  fieldKey,
  removedOnly,
  summarizeDiff,
} from '../wireframeDiff';
import { buildWireframeModel } from '../wireframeModel';

/** Rename every `revenue` column the way a rebind would. */
function renamed(definition: unknown, from: string, to: string): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = k === 'ColumnName' && v === from ? to : walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(definition);
}

/** A copy of the model with one element on the first sheet rewritten. */
function edited(
  model: WireframeModel,
  elementId: string,
  patch: (element: WireframeElement) => WireframeElement
): WireframeModel {
  return {
    ...model,
    sheets: model.sheets.map((s, i) =>
      i === 0 ? { ...s, elements: s.elements.map((e) => (e.id === elementId ? patch(e) : e)) } : s
    ),
  };
}

describe('diffWireframeModels', () => {
  const before = buildWireframeModel(gridDashboardDefinition);
  const sheetId = before.sheets[0]!.id;
  const bar = before.sheets[0]!.elements.find((e) => e.id === 'bar-region')!;

  it('finds nothing when nothing changed', () => {
    const diff = diffWireframeModels(before, buildWireframeModel(gridDashboardDefinition));
    expect(diff.size).toBe(0);
    expect(diff.renames.size).toBe(0);
    expect(diff.elements.size).toBe(0);
    expect(emptyDiff().size).toBe(0);
  });

  it('keys every renamed field by sheet, element, well and position', () => {
    const after = buildWireframeModel(renamed(gridDashboardDefinition, 'revenue', 'net_revenue'));
    const diff = diffWireframeModels(before, after);

    expect(diff.renames.size).toBeGreaterThan(0);
    expect(diff.size).toBe(diff.renames.size);
    for (const [key, rename] of diff.renames) {
      expect(key.split('/')).toHaveLength(4);
      expect(rename).toEqual({ from: 'revenue', to: 'net_revenue' });
    }
    // Every renamed chip is on an element that exists in the before model too.
    const sheet = before.sheets[0]!;
    const elementIds = new Set([...sheet.elements, ...sheet.controlBar].map((e) => e.id));
    for (const key of diff.renames.keys()) {
      expect(elementIds.has(key.split('/')[1]!)).toBe(true);
    }
  });

  it('reports a dropped element as removed, never as renamed', () => {
    const after: WireframeModel = {
      ...before,
      sheets: before.sheets.map((s) => ({
        ...s,
        elements: s.elements.slice(1).map((e) => ({
          ...e,
          fieldWells: e.fieldWells.map((w) => ({
            ...w,
            fields: w.fields.map((f) => ({ ...f, label: `${f.label}_x` })),
          })),
        })),
      })),
    };
    const diff = diffWireframeModels(before, after);
    const dropped = before.sheets[0]!.elements[0]!.id;
    expect([...diff.renames.keys()].some((k) => k.includes(`/${dropped}/`))).toBe(false);
    expect(diff.renames.size).toBeGreaterThan(0);
    expect(elementChanges(diff, sheetId, dropped)).toEqual([{ kind: 'removed' }]);
  });

  it('elementRenames narrows the diff to one card, keyed role/index', () => {
    const after = buildWireframeModel(renamed(gridDashboardDefinition, 'revenue', 'net_revenue'));
    const diff = diffWireframeModels(before, after);
    const [firstKey] = diff.renames.keys();
    const [s, elementId, role, index] = firstKey!.split('/');

    const own = elementRenames(diff, s!, elementId!);
    expect(own?.get(`${role}/${index}`)).toEqual({ from: 'revenue', to: 'net_revenue' });
    expect(elementRenames(diff, s!, 'nope')).toBeUndefined();
    expect(elementRenames(undefined, s!, elementId!)).toBeUndefined();
    expect(fieldKey('s', 'e', 'Values', 2)).toBe('s/e/Values/2');
    expect(elementKey('s', 'e')).toBe('s/e');
  });

  it('sees a moved element', () => {
    expect(bar.position.type).toBe('grid');
    const after = edited(before, 'bar-region', (e) => ({
      ...e,
      position: { ...e.position, type: 'grid', col: 18, row: 20 } as WireframeElement['position'],
    }));
    const changes = elementChanges(diffWireframeModels(before, after), sheetId, 'bar-region');
    expect(changes).toHaveLength(1);
    expect(changes?.[0]).toMatchObject({ kind: 'moved', to: '18,20' });
    expect(changes?.[0]?.from).toBeDefined();
  });

  it('sees a resized element', () => {
    const after = edited(before, 'bar-region', (e) => ({
      ...e,
      position: { ...e.position, colSpan: 36, rowSpan: 4 } as WireframeElement['position'],
    }));
    const changes = elementChanges(diffWireframeModels(before, after), sheetId, 'bar-region');
    expect(changes).toEqual([{ kind: 'resized', from: expect.any(String), to: '36×4' }]);
  });

  it('sees a retyped visual, and a moved-and-retyped one carries both', () => {
    const retyped = edited(before, 'bar-region', (e) => ({ ...e, visualType: 'LineChart' }));
    expect(elementChanges(diffWireframeModels(before, retyped), sheetId, 'bar-region')).toEqual([
      { kind: 'retyped', from: bar.visualType, to: 'LineChart' },
    ]);

    const both = edited(retyped, 'bar-region', (e) => ({
      ...e,
      position: { ...e.position, type: 'grid', col: 0, row: 30 } as WireframeElement['position'],
    }));
    const kinds = elementChanges(diffWireframeModels(before, both), sheetId, 'bar-region')?.map(
      (c) => c.kind
    );
    expect(kinds).toEqual(['retyped', 'moved']);
  });

  it('sees added and removed elements, and removedOnly keeps just the ghosts', () => {
    const copy: WireframeElement = { ...bar, id: 'bar-region-copy' };
    const after: WireframeModel = {
      ...before,
      sheets: before.sheets.map((s, i) =>
        i === 0 ? { ...s, elements: [...s.elements.filter((e) => e.id !== 'line-trend'), copy] } : s
      ),
    };
    const diff = diffWireframeModels(before, after);
    expect(elementChanges(diff, sheetId, 'bar-region-copy')).toEqual([{ kind: 'added' }]);
    expect(elementChanges(diff, sheetId, 'line-trend')).toEqual([{ kind: 'removed' }]);
    expect(elementChanges(diff, sheetId, 'bar-region')).toBeUndefined();

    const ghosts = removedOnly(diff);
    expect(ghosts?.size).toBe(1);
    expect(elementChanges(ghosts, sheetId, 'line-trend')).toEqual([{ kind: 'removed' }]);
    expect(elementChanges(ghosts, sheetId, 'bar-region-copy')).toBeUndefined();
    expect(removedOnly(undefined)).toBeUndefined();

    expect(summarizeDiff(diff)).toEqual({
      renamed: 0,
      moved: 0,
      resized: 0,
      retyped: 0,
      added: 1,
      removed: 1,
    });
    expect(summarizeDiff(undefined).added).toBe(0);
  });
});
