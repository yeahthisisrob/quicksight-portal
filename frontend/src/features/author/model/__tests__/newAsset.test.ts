import { describe, expect, it } from 'vitest';

import {
  type AuthorFlowState,
  authorFlowReducer,
  authorSteps,
  initialAuthorFlowState,
  initialNewFlowState,
  stepStatus,
} from '../authorFlow';
import {
  addValue,
  type DraftVisual,
  defaultAggregation,
  describeVisual,
  draftsFromSpecs,
  isComplete,
  isDateColumn,
  newAssetRequest,
  newVisual,
  removeValue,
  removeVisual,
  slugIdentifier,
  specsFromDrafts,
  uniqueIdentifier,
  updateValue,
  updateVisual,
} from '../newAsset';

const KPI: DraftVisual = {
  id: 'v1',
  type: 'KPI',
  title: 'Revenue',
  identifier: 'sales',
  values: [{ column: 'revenue', aggregation: 'SUM' }],
};

const BAR: DraftVisual = {
  id: 'v2',
  type: 'BarChart',
  title: 'Revenue by region',
  identifier: 'sales',
  category: 'region',
  values: [{ column: 'revenue', aggregation: 'SUM' }],
  color: 'channel',
};

describe('identifiers', () => {
  it('slugs a dataset name and never returns an empty identifier', () => {
    expect(slugIdentifier('Sales gold (v2)')).toBe('sales_gold_v2');
    expect(slugIdentifier('  ---  ')).toBe('dataset');
  });

  it('counts up when the slug is taken', () => {
    expect(uniqueIdentifier('sales gold', [])).toBe('sales_gold');
    expect(uniqueIdentifier('sales gold', ['sales_gold'])).toBe('sales_gold_2');
    expect(uniqueIdentifier('sales gold', ['sales_gold', 'sales_gold_2'])).toBe('sales_gold_3');
  });
});

describe('visual specs', () => {
  it('sends only complete visuals, with blank wells dropped', () => {
    const incomplete = { ...newVisual('sales'), title: 'Nothing here' };
    const withBlank: DraftVisual = {
      ...BAR,
      values: [...BAR.values, { column: '  ' }],
    };
    expect(specsFromDrafts([KPI, incomplete, withBlank])).toEqual([
      {
        type: 'KPI',
        title: 'Revenue',
        identifier: 'sales',
        values: [{ column: 'revenue', aggregation: 'SUM' }],
      },
      {
        type: 'BarChart',
        title: 'Revenue by region',
        identifier: 'sales',
        category: 'region',
        values: [{ column: 'revenue', aggregation: 'SUM' }],
        color: 'channel',
      },
    ]);
  });

  it('a KPI carries no category, granularity or colour', () => {
    const spec = specsFromDrafts([
      { ...KPI, category: 'region', color: 'channel', granularity: 'MONTH' },
    ])[0]!;
    expect(spec).not.toHaveProperty('category');
    expect(spec).not.toHaveProperty('color');
    expect(spec).not.toHaveProperty('granularity');
  });

  it('granularity only rides along with a category', () => {
    const withDate = specsFromDrafts([{ ...BAR, category: 'order_date', granularity: 'MONTH' }])[0];
    expect(withDate?.granularity).toBe('MONTH');
    const withoutCategory = specsFromDrafts([{ ...BAR, category: '', granularity: 'MONTH' }])[0];
    expect(withoutCategory).not.toHaveProperty('granularity');
  });

  it('round-trips the server specs into editable cards', () => {
    const specs = specsFromDrafts([KPI, BAR]);
    const drafts = draftsFromSpecs(specs);
    expect(drafts.map((d) => d.id)).toHaveLength(2);
    expect(specsFromDrafts(drafts)).toEqual(specs);
  });

  it('needs a title, a dataset and one value column', () => {
    expect(isComplete(KPI)).toBe(true);
    expect(isComplete({ ...KPI, title: '  ' })).toBe(false);
    expect(isComplete({ ...KPI, values: [{ column: '' }] })).toBe(false);
    expect(isComplete({ ...KPI, identifier: '' })).toBe(false);
  });
});

describe('editing', () => {
  it('patches one visual and leaves the others alone', () => {
    const next = updateVisual([KPI, BAR], 'v2', { type: 'ColumnChart' });
    expect(next[0]).toBe(KPI);
    expect(next[1]?.type).toBe('ColumnChart');
  });

  it('adds, patches and removes value rows, always keeping one', () => {
    let visuals = addValue([KPI], 'v1');
    expect(visuals[0]?.values).toHaveLength(2);
    visuals = updateValue(visuals, 'v1', 1, { column: 'margin', aggregation: 'AVERAGE' });
    expect(visuals[0]?.values[1]).toEqual({ column: 'margin', aggregation: 'AVERAGE' });
    visuals = removeValue(visuals, 'v1', 1);
    expect(visuals[0]?.values).toHaveLength(1);
    expect(removeValue(visuals, 'v1', 0)[0]?.values).toHaveLength(1);
  });

  it('removes a visual by id', () => {
    expect(removeVisual([KPI, BAR], 'v1').map((v) => v.id)).toEqual(['v2']);
  });

  it('defaults numbers to a sum and everything else to a count', () => {
    expect(defaultAggregation('DECIMAL')).toBe('SUM');
    expect(defaultAggregation('INTEGER')).toBe('SUM');
    expect(defaultAggregation('STRING')).toBe('COUNT');
    expect(defaultAggregation(undefined)).toBe('COUNT');
  });

  it('knows a date column', () => {
    expect(isDateColumn('DATETIME')).toBe(true);
    expect(isDateColumn('STRING')).toBe(false);
    expect(isDateColumn(undefined)).toBe(false);
  });
});

describe('newAssetRequest', () => {
  const base = {
    assetType: 'dashboard' as const,
    name: '  Regional sales  ',
    datasets: [{ identifier: 'sales', dataSetId: 'sales-gold', name: 'sales_gold' }],
    visuals: [KPI],
  };

  it('sends the visuals, trimmed, and drops the ask when there are any', () => {
    const request = newAssetRequest({ ...base, ask: 'revenue please' });
    expect(request.name).toBe('Regional sales');
    expect(request.datasets).toEqual([{ identifier: 'sales', dataSetId: 'sales-gold' }]);
    expect(request.visuals).toHaveLength(1);
    expect(request.ask).toBeUndefined();
  });

  it('sends the ask when no visual is complete, so the planner proposes', () => {
    const request = newAssetRequest({ ...base, visuals: [], ask: '  revenue please  ' });
    expect(request.visuals).toBeUndefined();
    expect(request.ask).toBe('revenue please');
  });

  it('leaves out every optional field that is not set', () => {
    const request = newAssetRequest({ ...base, sheetName: '  ' });
    expect(request).not.toHaveProperty('sheetName');
    expect(request).not.toHaveProperty('template');
    expect(request).not.toHaveProperty('folderId');
    expect(request).not.toHaveProperty('permissionsFrom');
  });

  it('carries the audience, the folder and the standard through', () => {
    const request = newAssetRequest({
      ...base,
      sheetName: 'Overview',
      permissionsFrom: { assetType: 'dashboard', assetId: 'exec-summary' },
      folderId: 'fld-sales',
      template: {
        assetType: 'dashboard',
        assetId: 'tpl',
        textBoxes: true,
        controls: true,
        sheetNames: true,
        kpisFirst: true,
        theme: true,
      },
      typeRules: { kpi: true },
    });
    expect(request).toMatchObject({
      sheetName: 'Overview',
      permissionsFrom: { assetType: 'dashboard', assetId: 'exec-summary' },
      folderId: 'fld-sales',
      template: { assetId: 'tpl' },
      typeRules: { kpi: true },
    });
  });
});

describe('describeVisual', () => {
  it('says the type, the title and what it reads', () => {
    expect(describeVisual(KPI)).toBe('KPI "Revenue": sum of revenue');
    expect(describeVisual(BAR)).toBe(
      'Bar chart "Revenue by region": sum of revenue, by region, coloured by channel'
    );
    expect(describeVisual({ ...BAR, category: 'order_date', granularity: 'MONTH' })).toContain(
      'by order_date (month)'
    );
    expect(describeVisual({ ...KPI, title: '  ', values: [] })).toBe('KPI "untitled": no values');
  });
});

describe('the flow in new mode', () => {
  function withDatasets(): AuthorFlowState {
    let state = authorFlowReducer(initialAuthorFlowState, { type: 'startNew' });
    state = authorFlowReducer(state, {
      type: 'addFreshDataset',
      dataSetId: 'sales-gold',
      name: 'sales gold',
    });
    return state;
  }

  it('startNew switches modes and lands on Datasets', () => {
    const state = authorFlowReducer(initialAuthorFlowState, { type: 'startNew' });
    expect(state).toEqual(initialNewFlowState);
    expect(state.step).toBe('targets');
    expect(authorSteps(false, 'new').map((s) => s.id)).toEqual([
      'targets',
      'visuals',
      'standard',
      'mockup',
      'publish',
    ]);
  });

  it('a dataset gets a slugged identifier and cannot be added twice', () => {
    const state = withDatasets();
    expect(state.fresh.datasets).toEqual([
      { identifier: 'sales_gold', dataSetId: 'sales-gold', name: 'sales gold' },
    ]);
    const again = authorFlowReducer(state, {
      type: 'addFreshDataset',
      dataSetId: 'sales-gold',
      name: 'sales gold',
    });
    expect(again).toBe(state);
  });

  it('renaming an identifier follows into the visuals, and a clash is refused', () => {
    let state = withDatasets();
    state = authorFlowReducer(state, {
      type: 'addFreshDataset',
      dataSetId: 'targets',
      name: 'targets',
    });
    state = authorFlowReducer(state, { type: 'addVisual' });
    expect(state.fresh.visuals[0]?.identifier).toBe('sales_gold');

    state = authorFlowReducer(state, {
      type: 'setFreshIdentifier',
      identifier: 'sales_gold',
      next: 'gold',
    });
    expect(state.fresh.datasets[0]?.identifier).toBe('gold');
    expect(state.fresh.visuals[0]?.identifier).toBe('gold');

    const clash = authorFlowReducer(state, {
      type: 'setFreshIdentifier',
      identifier: 'gold',
      next: 'targets',
    });
    expect(clash).toBe(state);
  });

  it('removing a dataset takes its visuals with it', () => {
    let state = withDatasets();
    state = authorFlowReducer(state, { type: 'addVisual' });
    state = authorFlowReducer(state, {
      type: 'removeFreshDataset',
      identifier: 'sales_gold',
    });
    expect(state.fresh.datasets).toEqual([]);
    expect(state.fresh.visuals).toEqual([]);
  });

  it('the mockup and publish wait for a complete visual', () => {
    const state = withDatasets();
    const locked = stepStatus(state, { hasTargets: false, canApply: false, hasVisuals: false });
    expect(locked.targets).toBe('current');
    expect(locked.visuals).toBe('available');
    expect(locked.mockup).toBe('locked');
    expect(locked.publish).toBe('locked');

    const ready = stepStatus(state, { hasTargets: false, canApply: true, hasVisuals: true });
    expect(ready.visuals).toBe('done');
    expect(ready.mockup).toBe('available');
    expect(ready.publish).toBe('available');
  });

  it('a from-source flow never shows the visuals step', () => {
    const state = authorFlowReducer(initialAuthorFlowState, {
      type: 'selectSource',
      source: { type: 'dashboard', id: 'd1', name: 'Sales' },
    });
    const status = stepStatus(state, { hasTargets: false, canApply: false });
    expect(status).not.toHaveProperty('visuals');
    expect(authorSteps(false).some((s) => s.id === 'visuals')).toBe(false);
  });
});
