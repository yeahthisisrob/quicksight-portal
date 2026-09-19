import { describe, expect, it } from 'vitest';

import type { DefinitionOp } from '@/shared/api/modules/authoring';

import {
  type AuthorFlowState,
  authorFlowReducer,
  hasChanges,
  initialAuthorFlowState,
  nextStep,
  previousStep,
  stepStatus,
} from '../authorFlow';
import { displayTags, isTemplate, normalizeTags, templateIncludeTagsParam } from '../templateTag';

const SOURCE = { type: 'dashboard' as const, id: 'd1', name: 'Sales' };
const MOVE: DefinitionOp = { op: 'move', sheetId: 's', elementId: 'a', col: 0, row: 4 };
const RETYPE: DefinitionOp = {
  op: 'retype',
  sheetId: 's',
  elementId: 'a',
  visualType: 'LineChart',
};
const REMOVE: DefinitionOp = { op: 'remove', sheetId: 's', elementId: 'b' };

function withSource(): AuthorFlowState {
  return authorFlowReducer(initialAuthorFlowState, { type: 'selectSource', source: SOURCE });
}

describe('authorFlowReducer', () => {
  it('selecting a source resets everything downstream', () => {
    let state = withSource();
    state = authorFlowReducer(state, { type: 'goTo', step: 'review' });
    state = authorFlowReducer(state, { type: 'addOps', ops: [MOVE] });
    state = authorFlowReducer(state, { type: 'setFolder', folder: { id: 'f', name: 'Finance' } });
    state = authorFlowReducer(state, {
      type: 'published',
      result: { assetType: 'dashboard', assetId: 'new', name: 'Copy', mode: 'clone' },
    });

    const other = authorFlowReducer(state, {
      type: 'selectSource',
      source: { ...SOURCE, id: 'd2' },
    });
    expect(other).toEqual({ ...initialAuthorFlowState, source: { ...SOURCE, id: 'd2' } });
  });

  it('re-selecting the same source keeps progress (a name refresh, say)', () => {
    let state = withSource();
    state = authorFlowReducer(state, { type: 'goTo', step: 'targets' });
    state = authorFlowReducer(state, { type: 'addOps', ops: [MOVE] });
    const again = authorFlowReducer(state, {
      type: 'selectSource',
      source: { ...SOURCE, name: 'Sales (renamed)' },
    });
    expect(again.step).toBe('targets');
    expect(again.source?.name).toBe('Sales (renamed)');
    expect(again.ops).toEqual([MOVE]);
  });

  it('records visited steps and lands on publish after publishing', () => {
    let state = authorFlowReducer(initialAuthorFlowState, { type: 'goTo', step: 'mockup' });
    expect(state.visited).toEqual(['source', 'mockup']);
    state = authorFlowReducer(state, {
      type: 'published',
      result: { assetType: 'analysis', assetId: 'a', name: 'n', mode: 'update' },
    });
    expect(state.step).toBe('publish');
    expect(state.result?.assetId).toBe('a');
  });

  it('appends ops in order, removes one, undoes the last, clears all', () => {
    let state = authorFlowReducer(withSource(), { type: 'addOps', ops: [MOVE] });
    state = authorFlowReducer(state, { type: 'addOps', ops: [RETYPE, REMOVE] });
    expect(state.ops).toEqual([MOVE, RETYPE, REMOVE]);

    state = authorFlowReducer(state, { type: 'removeOp', index: 1 });
    expect(state.ops).toEqual([MOVE, REMOVE]);
    expect(authorFlowReducer(state, { type: 'removeOp', index: 9 })).toBe(state);

    state = authorFlowReducer(state, { type: 'undoOp' });
    expect(state.ops).toEqual([MOVE]);

    expect(authorFlowReducer(state, { type: 'addOps', ops: [] })).toBe(state);

    state = authorFlowReducer(state, { type: 'clearOps' });
    expect(state.ops).toEqual([]);
    expect(authorFlowReducer(state, { type: 'undoOp' })).toBe(state);
    expect(authorFlowReducer(state, { type: 'clearOps' })).toBe(state);
  });

  it('drops the selection when the selected element is removed', () => {
    let state = authorFlowReducer(withSource(), {
      type: 'selectElement',
      element: { sheetId: 's', elementId: 'b' },
    });
    expect(state.selectedElement).toEqual({ sheetId: 's', elementId: 'b' });
    state = authorFlowReducer(state, { type: 'addOps', ops: [MOVE] });
    expect(state.selectedElement).toEqual({ sheetId: 's', elementId: 'b' });
    state = authorFlowReducer(state, { type: 'addOps', ops: [REMOVE] });
    expect(state.selectedElement).toBeNull();
  });

  it('keeps the folder until it is cleared', () => {
    let state = authorFlowReducer(withSource(), {
      type: 'setFolder',
      folder: { id: 'f', name: 'Finance', path: '/Finance' },
    });
    expect(state.folder?.name).toBe('Finance');
    state = authorFlowReducer(state, { type: 'setFolder', folder: null });
    expect(state.folder).toBeNull();
  });
});

describe('stepStatus', () => {
  it('locks everything but source until a source is chosen', () => {
    expect(stepStatus(initialAuthorFlowState, { hasTargets: false, canApply: false })).toEqual({
      source: 'current',
      targets: 'locked',
      review: 'locked',
      mockup: 'locked',
      publish: 'locked',
    });
  });

  it('opens review before targets are chosen, so the planner can pick them', () => {
    const status = stepStatus(withSource(), { hasTargets: false, canApply: false });
    expect(status).toMatchObject({ source: 'current', targets: 'available', review: 'available' });
    expect(status.mockup).toBe('locked');
    expect(status.publish).toBe('locked');
  });

  it('opens the mockup with targets or with edits, publish only once applicable', () => {
    const state = withSource();
    expect(stepStatus(state, { hasTargets: true, canApply: false }).mockup).toBe('available');
    expect(stepStatus(state, { hasTargets: true, canApply: false }).publish).toBe('locked');

    const edits = stepStatus(state, { hasTargets: false, canApply: true, hasOps: true });
    expect(edits.mockup).toBe('available');
    expect(edits.publish).toBe('available');

    const fields = stepStatus(state, { hasTargets: false, canApply: true, hasAddedFields: true });
    expect(fields.publish).toBe('available');

    const copy = stepStatus(state, { hasTargets: false, canApply: true, renamed: true });
    expect(copy.mockup).toBe('available');
    expect(copy.publish).toBe('available');

    expect(hasChanges({ hasTargets: false, canApply: true })).toBe(false);
  });

  it('marks steps done as the server verdict comes in', () => {
    let state = withSource();
    state = authorFlowReducer(state, { type: 'goTo', step: 'mockup' });
    state = authorFlowReducer(state, { type: 'goTo', step: 'publish' });

    expect(stepStatus(state, { hasTargets: true, canApply: true })).toEqual({
      source: 'done',
      targets: 'done',
      review: 'done',
      mockup: 'done',
      publish: 'current',
    });
    expect(stepStatus(state, { hasTargets: true, canApply: false }).review).toBe('available');
  });

  it('walks steps in order', () => {
    expect(nextStep('source')).toBe('targets');
    expect(nextStep('publish')).toBeNull();
    expect(previousStep('source')).toBeNull();
    expect(previousStep('mockup')).toBe('review');
  });
});

describe('template tag', () => {
  it('recognises the marker in either tag casing', () => {
    expect(isTemplate([{ key: 'quicksight-portal:template', value: 'TRUE' }])).toBe(true);
    expect(isTemplate([{ Key: 'quicksight-portal:template', Value: 'true' }])).toBe(true);
    expect(isTemplate([{ key: 'team', value: 'finance' }])).toBe(false);
    expect(isTemplate(undefined)).toBe(false);
  });

  it('hides the marker from display tags and normalises casing', () => {
    const tags = [
      { Key: 'quicksight-portal:template', Value: 'true' },
      { key: 'team', value: 'finance' },
    ];
    expect(displayTags(tags)).toEqual([{ key: 'team', value: 'finance' }]);
    expect(normalizeTags([{ Key: '', Value: 'x' }])).toEqual([]);
  });

  it('builds the include-tags query parameter', () => {
    expect(JSON.parse(templateIncludeTagsParam())).toEqual([
      { key: 'quicksight-portal:template', value: 'true' },
    ]);
  });
});
