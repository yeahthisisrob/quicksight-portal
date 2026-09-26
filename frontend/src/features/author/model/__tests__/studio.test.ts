import { describe, expect, it } from 'vitest';

import type { DefinitionOp } from '@/shared/api/modules/authoring';

import { initialStudioState, type StudioState, studioReducer } from '../studio';

const SALES = { type: 'dashboard' as const, id: 'sales', name: 'Sales' };
const OPS = {
  retitle: {
    op: 'retitle',
    sheetId: 's1',
    elementId: 'bar',
    title: 'Revenue',
  } as DefinitionOp,
  remove: { op: 'remove', sheetId: 's1', elementId: 'bar' } as DefinitionOp,
  move: { op: 'move', sheetId: 's1', elementId: 'kpi', col: 0, row: 4 } as DefinitionOp,
};

function opened(patch: Partial<StudioState> = {}): StudioState {
  return { ...studioReducer(initialStudioState, { type: 'open', source: SALES }), ...patch };
}

describe('the studio reducer', () => {
  it('opens on the issues panel with nothing edited', () => {
    const state = opened();
    expect(state.source).toEqual(SALES);
    expect(state.panel).toBe('issues');
    expect(state.ops).toEqual([]);
  });

  it('keeps the edits when the same asset comes back with a better name', () => {
    const state = studioReducer(opened({ ops: [OPS.move] }), {
      type: 'open',
      source: { ...SALES, name: 'Sales overview' },
    });
    expect(state.ops).toEqual([OPS.move]);
    expect(state.source?.name).toBe('Sales overview');
  });

  it('starts clean on another asset', () => {
    const state = studioReducer(opened({ ops: [OPS.move], panel: 'changes' }), {
      type: 'open',
      source: { type: 'analysis', id: 'other', name: 'Other' },
    });
    expect(state.ops).toEqual([]);
    expect(state.panel).toBe('issues');
  });

  it('brings the inspector forward when a card is selected, and leaves the panel on clear', () => {
    const selected = studioReducer(opened(), {
      type: 'selectElement',
      element: { sheetId: 's1', elementId: 'bar' },
    });
    expect(selected.panel).toBe('inspect');
    const moved = studioReducer(selected, { type: 'setPanel', panel: 'changes' });
    expect(studioReducer(moved, { type: 'selectElement', element: null }).panel).toBe('changes');
  });

  it('drops the selection when the selected card is removed', () => {
    const selected = studioReducer(opened(), {
      type: 'selectElement',
      element: { sheetId: 's1', elementId: 'bar' },
    });
    expect(studioReducer(selected, { type: 'addOps', ops: [OPS.retitle] }).selectedElement).toEqual(
      { sheetId: 's1', elementId: 'bar' }
    );
    expect(
      studioReducer(selected, { type: 'addOps', ops: [OPS.remove] }).selectedElement
    ).toBeNull();
  });

  it('undoes, removes and clears edits', () => {
    const state = opened({ ops: [OPS.retitle, OPS.move, OPS.remove] });
    expect(studioReducer(state, { type: 'undoOp' }).ops).toEqual([OPS.retitle, OPS.move]);
    expect(studioReducer(state, { type: 'removeOp', index: 1 }).ops).toEqual([
      OPS.retitle,
      OPS.remove,
    ]);
    expect(studioReducer(state, { type: 'removeOp', index: 9 })).toBe(state);
    expect(studioReducer(state, { type: 'clearOps' }).ops).toEqual([]);
  });

  it('starts the edits over from what a save wrote', () => {
    const saved = studioReducer(opened({ ops: [OPS.move] }), {
      type: 'saved',
      result: {
        assetType: 'dashboard',
        assetId: 'sales',
        name: 'Sales',
        mode: 'update',
        folderIds: [],
      },
    });
    expect(saved.ops).toEqual([]);
    expect(saved.result?.mode).toBe('update');
    expect(studioReducer(saved, { type: 'dismissResult' }).result).toBeNull();
  });
});
