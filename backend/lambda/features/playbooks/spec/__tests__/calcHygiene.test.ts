import { describe, expect, it, vi } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { type PlaybookContext, PortalCallError } from '../../types';
import { droppable, standardName } from '../calcHygiene';
import { specPlaybook } from '../specPlaybook';

const use = (
  name: string,
  over: Partial<{ visual: number; calculatedField: number }> = {},
  readBy: string[] = []
) => ({
  identifier: 'orders',
  name,
  usage: { visual: 0, filter: 0, calculatedField: 0, parameter: 0, control: 0, other: 0, ...over },
  readBy,
  unused: !over.visual && !over.calculatedField,
});

describe('which calculated fields can go', () => {
  it('takes leftovers and what only leftovers read, readers first; never a field anything else reads', () => {
    const fields = [
      use('shown', { visual: 1 }),
      use('base', { calculatedField: 1 }, ['leftover']),
      use('leftover'),
      use('helper', { calculatedField: 1 }, ['shown']),
    ];
    expect(droppable(fields).map((f) => f.name)).toEqual(['leftover', 'base']);
  });
});

describe('the naming standard', () => {
  it.each([
    ['Order Margin %', 'c_order_margin_pct'],
    ['orderMargin', 'c_order_margin'],
    ['calc_order-margin', 'c_order_margin'],
    ['c_ds_revenue', 'c_revenue'],
    ['c_revenue', 'c_revenue'],
  ])('%s -> %s', (name, expected) => {
    expect(standardName(name, 'c_')).toBe(expected);
  });
});

function portal(fields: unknown[], options: { refuse?: boolean } = {}) {
  const posted: unknown[] = [];
  const call = vi.fn(async (method: string, path: string, body?: unknown) => {
    const p = new URL(path, 'http://x').pathname;
    if (p === '/api/authoring/dashboard/d1/calculated-fields') return { fields };
    if (p === '/api/authoring/dashboard/d1/rebind/preview') {
      if (options.refuse) throw new PortalCallError(400, 'Op 1: nope');
      return { plan: { canApply: true } };
    }
    if (method === 'POST' && p === '/api/authoring/dashboard/d1/rebind') {
      posted.push(body);
      return { versionNumber: 4 };
    }
    throw new PortalCallError(404, p);
  });
  return { call, posted };
}
const board = { assetType: 'dashboard' as const, assetId: 'd1', name: 'Sales' };

describe('drop unused calculated fields', () => {
  const playbook = specPlaybook(EXAMPLE_SPECS.find((s) => s.id === 'drop-unused-calcs')!);

  it('drops what nothing reads, after a dry run', async () => {
    const { call, posted } = portal([use('shown', { visual: 2 }), use('old_margin')]);
    const ctx = { call, params: {} } as unknown as PlaybookContext;
    const plan = await playbook.plan(ctx, board);
    expect(plan).toMatchObject({ verdict: 'change', changes: ['Drop old_margin'] });
    await playbook.apply(ctx, board, plan);
    expect(posted[0]).toEqual({
      mode: 'update',
      rebinds: [],
      ops: [{ op: 'dropCalculatedField', identifier: 'orders', name: 'old_margin' }],
    });
  });

  it('skips a tidy asset, and reviews a refused rewrite', async () => {
    expect(
      (
        await playbook.plan(
          { call: portal([use('shown', { visual: 1 })]).call, params: {} } as never,
          board
        )
      ).verdict
    ).toBe('skip');
    const refused = await playbook.plan(
      { call: portal([use('old')], { refuse: true }).call, params: {} } as never,
      board
    );
    expect(refused.verdict).toBe('review');
  });
});

describe('name calculated fields to the standard', () => {
  const playbook = specPlaybook(EXAMPLE_SPECS.find((s) => s.id === 'calcs-to-standard-names')!);

  it('renames to the prefix and snake_case, and leaves a clash for review', async () => {
    const { call } = portal([
      use('Order Margin', { visual: 1 }),
      use('c_revenue', { visual: 1 }),
      use('Revenue'),
    ]);
    const plan = await playbook.plan(
      { call, params: { prefix: 'c_' } } as unknown as PlaybookContext,
      board
    );
    expect(plan.verdict).toBe('change');
    expect(plan.changes).toEqual(['Rename Order Margin to c_order_margin']);
    expect(plan.summary).toContain('Revenue → c_revenue, a name already in use');
  });
});
