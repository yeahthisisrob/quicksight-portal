import { describe, expect, it, vi } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { type PlaybookContext, PortalCallError } from '../../types';
import { movesOf } from '../datasetCalcNames';
import { specPlaybook } from '../specPlaybook';

const playbook = specPlaybook(
  EXAMPLE_SPECS.find((s) => s.id === 'dataset-calcs-to-standard-names')!
);
const dataset = { assetType: 'dataset' as const, assetId: 'ds1', name: 'orders' };
const reader = {
  assetType: 'dashboard' as const,
  assetId: 'd1',
  name: 'Pipeline',
  identifier: 'orders',
};

interface Field {
  name: string;
  expression: string;
  readers: (typeof reader)[];
}

/**
 * The portal as the step sees it, with state: a copy adds the field, a
 * rebind moves the reader, a retire removes the old name.
 */
function portal(options: { importMode?: string; optOut?: boolean; refuseRebind?: boolean } = {}) {
  const state = {
    importMode: options.importMode ?? 'DIRECT_QUERY',
    latestRefresh: 'completed' as string,
    fields: [
      { name: 'Margin', expression: '{revenue} - {cost}', readers: [reader] },
      { name: 'c_ds_units', expression: '{qty}', readers: [] },
    ] as Field[],
  };
  const writes: Array<{ path: string; body: any }> = [];
  const call = vi.fn(async (method: string, path: string, body?: any) => {
    const p = decodeURIComponent(new URL(path, 'http://x').pathname);
    if (method === 'GET' && p === '/api/authoring/datasets/ds1/calculated-fields') {
      return {
        dataSetId: 'ds1',
        importMode: state.importMode,
        ...(state.importMode === 'SPICE' ? { latestRefresh: state.latestRefresh } : {}),
        fields: structuredClone(state.fields),
      };
    }
    if (method === 'GET' && p === '/api/tags/dashboard/d1') {
      return options.optOut ? [{ key: 'portal:playbook-skip', value: '' }] : [];
    }
    if (p === '/api/authoring/dashboard/d1/rebind/preview') {
      if (options.refuseRebind) throw new PortalCallError(400, 'Column c_ds_margin not found');
      return { plan: { canApply: true } };
    }
    if (method === 'POST' && p === '/api/authoring/datasets/ds1/calculated-fields') {
      if (body.dryRun) return { changes: [], written: false };
      writes.push({ path: p, body });
      for (const op of body.ops) {
        if (op.op === 'copyCalculatedField') {
          const from = state.fields.find((f) => f.name === op.name)!;
          state.fields.push({ name: op.to, expression: from.expression, readers: [] });
          if (state.importMode === 'SPICE') state.latestRefresh = 'running';
        } else {
          state.fields = state.fields.filter((f) => f.name !== op.name);
        }
      }
      return { written: true };
    }
    if (method === 'POST' && p === '/api/authoring/dashboard/d1/rebind') {
      writes.push({ path: p, body });
      const map = body.rebinds[0].columnMap as Record<string, string>;
      for (const [from, to] of Object.entries(map)) {
        const old = state.fields.find((f) => f.name === from)!;
        state.fields.find((f) => f.name === to)!.readers.push(...old.readers);
        old.readers = [];
      }
      return { versionNumber: 4 };
    }
    throw new PortalCallError(404, `${method} ${p}`);
  });
  return { call, writes, state };
}

const ctx = (call: unknown) =>
  ({ call, params: { prefix: 'c_ds_' } }) as unknown as PlaybookContext;

describe('dataset calculated fields to the standard', () => {
  it('direct query: copies, moves the reader, then retires the old name in one run', async () => {
    const { call, writes, state } = portal();
    const plan = await playbook.plan(ctx(call), dataset);
    expect(plan.verdict).toBe('change');
    expect(plan.changes).toEqual(['Add c_ds_margin beside Margin']);

    const outcome = await playbook.apply(ctx(call), dataset, plan);
    expect(writes.map((w) => [w.path, w.body.ops?.[0]?.op ?? w.body.mode])).toEqual([
      ['/api/authoring/datasets/ds1/calculated-fields', 'copyCalculatedField'],
      ['/api/authoring/dashboard/d1/rebind', 'update'],
      ['/api/authoring/datasets/ds1/calculated-fields', 'retireCalculatedField'],
    ]);
    expect(writes[1]!.body.rebinds).toEqual([
      { identifier: 'orders', targetDataSetId: 'ds1', columnMap: { Margin: 'c_ds_margin' } },
    ]);
    expect(state.fields.map((f) => f.name)).toEqual(['c_ds_units', 'c_ds_margin']);
    expect(JSON.stringify(outcome)).toContain(
      'Added 1 under the standard name, moved 1 reader, removed 1 old name'
    );
  });

  it('SPICE: copies, then waits for the refresh before moving anyone; the next run finishes', async () => {
    const { call, writes, state } = portal({ importMode: 'SPICE' });
    const plan = await playbook.plan(ctx(call), dataset);
    const first = await playbook.apply(ctx(call), dataset, plan);
    expect(writes).toHaveLength(1);
    expect(JSON.stringify(first)).toContain('waiting for the refresh that loads c_ds_margin');

    // Mid-refresh, a preview has nothing to do yet.
    expect((await playbook.plan(ctx(call), dataset)).verdict).toBe('skip');

    state.latestRefresh = 'completed';
    const next = await playbook.plan(ctx(call), dataset);
    expect(next.changes).toEqual(['Move Pipeline from Margin to c_ds_margin']);
    await playbook.apply(ctx(call), dataset, next);
    expect(state.fields.map((f) => f.name)).toEqual(['c_ds_units', 'c_ds_margin']);
  });

  it('a reader that opted out holds its field back for review', async () => {
    const { call, state } = portal({ optOut: true });
    state.fields.push({ name: 'c_ds_margin', expression: '{revenue} - {cost}', readers: [] });
    const plan = await playbook.plan(ctx(call), dataset);
    expect(plan.verdict).toBe('review');
    expect(plan.summary).toContain('Pipeline opted out of playbooks');
  });

  it('a reader the rebind preview refuses sends the dataset to review', async () => {
    const { call, state } = portal({ refuseRebind: true });
    state.fields.push({ name: 'c_ds_margin', expression: '{revenue} - {cost}', readers: [] });
    const plan = await playbook.plan(ctx(call), dataset);
    expect(plan.verdict).toBe('review');
    expect(plan.summary).toContain('Pipeline was refused');
  });

  it('skips a dataset already on the standard and anything that is not a dataset', async () => {
    const { call, state } = portal();
    state.fields = [{ name: 'c_ds_units', expression: '{qty}', readers: [] }];
    expect((await playbook.plan(ctx(call), dataset)).verdict).toBe('skip');
    const board = { assetType: 'dashboard' as const, assetId: 'd1', name: 'Pipeline' };
    expect((await playbook.plan(ctx(call), board)).verdict).toBe('skip');
  });
});

describe('movesOf', () => {
  const base = { dataSetId: 'ds1', importMode: 'DIRECT_QUERY' };

  it('holds a name taken by a field that computes something else, and two fields becoming one name', () => {
    const moves = movesOf(
      {
        ...base,
        fields: [
          { name: 'Margin', expression: 'a' },
          { name: 'c_ds_margin', expression: 'b' },
          { name: 'Order Count', expression: 'c' },
          { name: 'order_count', expression: 'd' },
        ],
      },
      'c_ds_'
    );
    expect(moves).toEqual([
      expect.objectContaining({
        phase: 'hold',
        from: 'Margin',
        why: expect.stringContaining('computes something else'),
      }),
      expect.objectContaining({ phase: 'copy', from: 'Order Count', to: 'c_ds_order_count' }),
      expect.objectContaining({
        phase: 'hold',
        from: 'order_count',
        why: expect.stringContaining('also becoming'),
      }),
    ]);
  });

  it('holds everything past the copy when a reader could not be read', () => {
    const moves = movesOf(
      {
        ...base,
        unreadable: [{ assetType: 'analysis', name: 'Old draft' }],
        fields: [
          { name: 'Margin', expression: 'a' },
          { name: 'c_ds_margin', expression: 'a' },
        ],
      },
      'c_ds_'
    );
    expect(moves).toEqual([
      expect.objectContaining({ phase: 'hold', why: 'could not read analysis Old draft' }),
    ]);
  });
});
