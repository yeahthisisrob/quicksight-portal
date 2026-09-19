import { describe, expect, it } from 'vitest';

import type { WireframeModel } from '../../model/types';
import { gridDashboardDefinition } from '../__fixtures__/definitions';
import { diffWireframeModels, elementRenames, fieldKey } from '../wireframeDiff';
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

describe('diffWireframeModels', () => {
  const before = buildWireframeModel(gridDashboardDefinition);

  it('finds nothing when nothing changed', () => {
    expect(diffWireframeModels(before, buildWireframeModel(gridDashboardDefinition)).size).toBe(0);
  });

  it('keys every renamed field by sheet, element, well and position', () => {
    const after = buildWireframeModel(renamed(gridDashboardDefinition, 'revenue', 'net_revenue'));
    const diff = diffWireframeModels(before, after);

    expect(diff.size).toBeGreaterThan(0);
    for (const [key, rename] of diff) {
      expect(key.split('/')).toHaveLength(4);
      expect(rename).toEqual({ from: 'revenue', to: 'net_revenue' });
    }
    // Every renamed chip is on an element that exists in the before model too.
    const sheet = before.sheets[0]!;
    const elementIds = new Set([...sheet.elements, ...sheet.controlBar].map((e) => e.id));
    for (const key of diff.keys()) {
      expect(elementIds.has(key.split('/')[1]!)).toBe(true);
    }
  });

  it('ignores elements that only exist on one side', () => {
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
    expect([...diff.keys()].some((k) => k.includes(`/${dropped}/`))).toBe(false);
    expect(diff.size).toBeGreaterThan(0);
  });

  it('elementRenames narrows the diff to one card, keyed role/index', () => {
    const after = buildWireframeModel(renamed(gridDashboardDefinition, 'revenue', 'net_revenue'));
    const diff = diffWireframeModels(before, after);
    const [firstKey] = diff.keys();
    const [sheetId, elementId, role, index] = firstKey!.split('/');

    const own = elementRenames(diff, sheetId!, elementId!);
    expect(own?.get(`${role}/${index}`)).toEqual({ from: 'revenue', to: 'net_revenue' });
    expect(elementRenames(diff, sheetId!, 'nope')).toBeUndefined();
    expect(elementRenames(undefined, sheetId!, elementId!)).toBeUndefined();
    expect(fieldKey('s', 'e', 'Values', 2)).toBe('s/e/Values/2');
  });
});
