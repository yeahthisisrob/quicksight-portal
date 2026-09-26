import { describe, expect, it, vi } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { type PlaybookContext, PortalCallError } from '../../types';
import { specPlaybook } from '../specPlaybook';

const playbook = specPlaybook(EXAMPLE_SPECS.find((s) => s.id === 'use-governed-columns')!);
const board = { assetType: 'dashboard' as const, assetId: 'd1', name: 'Pipeline' };

/** A dashboard with two calculated fields over a governed dataset that has since gained is_closed. */
function portal(options: { previewRefuses?: boolean } = {}) {
  const posts: Array<{ path: string; body: unknown }> = [];
  const call = vi.fn(async (method: string, path: string, body?: unknown) => {
    const url = new URL(path, 'http://x');
    const p = decodeURIComponent(url.pathname);
    const relations = url.searchParams.get('relations') ?? '';
    if (p === '/api/authoring/dashboard/d1/datasets') {
      return {
        datasets: [
          {
            identifier: 'orders',
            dataSetId: 'gold',
            calculatedFields: ['c_is_closed', 'c_margin'],
          },
        ],
      };
    }
    if (p === '/api/context/entities/dashboard:d1/related') {
      return {
        hits: [
          { name: 'c_is_closed', attributes: { expression: "ifelse({status} = 'C', 1, 0)" } },
          { name: 'c_margin', attributes: { expression: '{revenue} - {cost}' } },
        ],
      };
    }
    if (p === '/api/context/entities/dataset:gold/related') {
      return relations === 'reads-listing'
        ? {
            hits: [
              { entityId: 'listing:l1', type: 'listing', name: 'Orders gold', attributes: {} },
            ],
          }
        : {
            hits: [
              { name: 'is_closed', description: 'Whether the order is closed: 1 closed, 0 open' },
            ],
          };
    }
    if (p === '/api/authoring/datasets/gold/columns') {
      return {
        dataSetId: 'gold',
        name: 'orders_gold',
        columns: [
          { name: 'status' },
          { name: 'is_closed', type: 'INTEGER' },
          { name: 'revenue' },
          { name: 'cost' },
        ],
      };
    }
    if (p === '/api/authoring/dashboard/d1/rebind/preview') {
      if (options.previewRefuses) throw new PortalCallError(400, 'Column is_closed not found');
      return { plan: { canApply: true } };
    }
    if (method === 'POST' && p === '/api/authoring/dashboard/d1/rebind') {
      posts.push({ path: p, body });
      return { versionNumber: 9 };
    }
    throw new PortalCallError(404, p);
  });
  return { call, posts };
}

const answer = (fields: unknown[]) => vi.fn(async () => ({ fields }));
const params = { minConfidence: 0.85 };

describe('use governed columns instead of calculated fields', () => {
  it('replaces what the model is sure the column holds, after a dry run, and leaves the rest', async () => {
    const { call, posts } = portal();
    const infer = answer([
      {
        identifier: 'orders',
        name: 'c_is_closed',
        column: 'is_closed',
        confidence: 0.95,
        why: 'same flag',
      },
      { identifier: 'orders', name: 'c_margin', column: null, confidence: 0.1 },
    ]);
    const ctx = { call, params, infer } as unknown as PlaybookContext;
    const plan = await playbook.plan(ctx, board);

    expect(plan.verdict).toBe('change');
    expect(plan.changes).toEqual([
      'Replace c_is_closed with is_closed (confidence 0.95: same flag)',
    ]);
    const prompt = (infer.mock.calls[0] as unknown as [{ user: string }])[0].user;
    expect(prompt).toContain("c_is_closed = ifelse({status} = 'C', 1, 0)");
    expect(prompt).toContain('is_closed (INTEGER): Whether the order is closed');

    await playbook.apply(ctx, board, plan);
    expect(posts[0]!.body).toEqual({
      mode: 'update',
      rebinds: [],
      repairs: [
        {
          op: 'replaceCalculatedField',
          identifier: 'orders',
          name: 'c_is_closed',
          column: 'is_closed',
        },
      ],
    });
  });

  it('sends an unsure answer, an invented column or a refused dry run to review', async () => {
    const unsure = await playbook.plan(
      {
        ...portal(),
        params,
        infer: answer([
          { identifier: 'orders', name: 'c_is_closed', column: 'is_closed', confidence: 0.6 },
        ]),
      } as unknown as PlaybookContext,
      board
    );
    expect(unsure.verdict).toBe('review');
    expect(unsure.summary).toContain('might be is_closed');

    const invented = await playbook.plan(
      {
        ...portal(),
        params,
        infer: answer([
          { identifier: 'orders', name: 'c_is_closed', column: 'closed_flag', confidence: 0.99 },
        ]),
      } as unknown as PlaybookContext,
      board
    );
    expect(invented.verdict).toBe('review');
    expect(invented.summary).toContain('does not have');

    const refused = await playbook.plan(
      {
        call: portal({ previewRefuses: true }).call,
        params,
        infer: answer([
          { identifier: 'orders', name: 'c_is_closed', column: 'is_closed', confidence: 0.99 },
        ]),
      } as unknown as PlaybookContext,
      board
    );
    expect(refused.verdict).toBe('review');
    expect(refused.summary).toContain('refused');
  });

  it('without a model, a name match is only a suggestion', async () => {
    const plan = await playbook.plan(
      { call: portal().call, params } as unknown as PlaybookContext,
      board
    );
    expect(plan.verdict).toBe('review');
    expect(plan.summary).toContain('c_is_closed may be is_closed');
  });
});
