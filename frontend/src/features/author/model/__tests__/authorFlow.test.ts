import { describe, expect, it } from 'vitest';

import {
  authorFlowReducer,
  initialAuthorFlowState,
  nextStep,
  previousStep,
  stepStatus,
} from '../authorFlow';
import { displayTags, isTemplate, normalizeTags, templateIncludeTagsParam } from '../templateTag';

const SOURCE = { type: 'dashboard' as const, id: 'd1', name: 'Sales' };

describe('authorFlowReducer', () => {
  it('selecting a source resets everything downstream', () => {
    let state = authorFlowReducer(initialAuthorFlowState, { type: 'selectSource', source: SOURCE });
    state = authorFlowReducer(state, { type: 'goTo', step: 'review' });
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
    let state = authorFlowReducer(initialAuthorFlowState, { type: 'selectSource', source: SOURCE });
    state = authorFlowReducer(state, { type: 'goTo', step: 'targets' });
    const again = authorFlowReducer(state, {
      type: 'selectSource',
      source: { ...SOURCE, name: 'Sales (renamed)' },
    });
    expect(again.step).toBe('targets');
    expect(again.source?.name).toBe('Sales (renamed)');
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
    const state = authorFlowReducer(initialAuthorFlowState, {
      type: 'selectSource',
      source: SOURCE,
    });
    const status = stepStatus(state, { hasTargets: false, canApply: false });
    expect(status).toMatchObject({ source: 'current', targets: 'available', review: 'available' });
    expect(status.mockup).toBe('locked');
    expect(status.publish).toBe('locked');
  });

  it('marks steps done as the server verdict comes in', () => {
    let state = authorFlowReducer(initialAuthorFlowState, { type: 'selectSource', source: SOURCE });
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
