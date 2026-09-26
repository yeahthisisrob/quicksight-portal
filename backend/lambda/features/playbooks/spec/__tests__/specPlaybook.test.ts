import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { type PlaybookContext, PortalCallError } from '../../types';
import { specPlaybook } from '../specPlaybook';

/**
 * A small account: two dashboards, one busy and on Redshift; a Redshift
 * dataset and a governed Athena one; the portal's routes answered from it.
 */
interface World {
  athenaColumns: Array<{ name: string; type?: string }>;
  canApply: boolean;
}

function portal(world: World) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const hit = (
    entityId: string,
    type: string,
    name: string,
    attributes = {},
    description?: string
  ) => ({
    entityId,
    type,
    name,
    summary: '',
    attributes,
    depth: 1,
    via: [],
    ...(description ? { description } : {}),
  });
  const call = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, ...(body === undefined ? {} : { body }) });
    const url = new URL(path, 'http://x');
    const p = decodeURIComponent(url.pathname);
    if (p === '/api/assets/dashboards/paginated') {
      return {
        dashboards: [
          { id: 'busy', name: 'Sales overview', activity: { totalViews: 400 }, tags: [] },
          { id: 'quiet', name: 'Old board', activity: { totalViews: 3 }, tags: [] },
        ],
        pagination: { totalPages: 1 },
      };
    }
    if (p === '/api/assets/datasets/paginated') {
      return {
        datasets: [
          { id: 'rs-sales', name: 'sales (redshift)' },
          { id: 'gold', name: 'sales_gold' },
        ],
        pagination: { totalPages: 1 },
      };
    }
    if (p.startsWith('/api/context/entities/')) {
      const entity = p.split('/')[4]!;
      const relations = url.searchParams.get('relations') ?? '';
      if (relations.includes('has-column')) {
        return {
          hits: [
            hit(
              'listing-column:net_revenue',
              'listing-column',
              'net_revenue',
              {},
              'Revenue after refunds, in USD'
            ),
          ],
        };
      }
      if (relations === 'through-datasource' && url.searchParams.get('direction') === 'in') {
        return {
          hits: [
            hit('dataset:rs-sales', 'dataset', 'sales (redshift)'),
            hit('dataset:rs-hr', 'dataset', 'hr (redshift)'),
          ],
        };
      }
      if (relations === 'reads-listing') {
        return {
          hits: entity === 'dataset:gold' ? [hit('listing:l1', 'listing', 'Sales gold')] : [],
        };
      }
      if (entity === 'dashboard:busy' || entity === 'dataset:rs-sales') {
        return {
          hits: [
            ...(entity === 'dashboard:busy'
              ? [hit('dataset:rs-sales', 'dataset', 'sales (redshift)')]
              : []),
            hit('datasource:rs', 'datasource', 'Warehouse', { sourceType: 'REDSHIFT' }),
          ],
        };
      }
      if (entity === 'dataset:gold') {
        return {
          hits: [hit('datasource:athena', 'datasource', 'Athena', { sourceType: 'ATHENA' })],
        };
      }
      return { hits: [] };
    }
    if (p === '/api/authoring/dashboard/busy/datasets') {
      return {
        datasets: [
          {
            identifier: 'sales',
            dataSetId: 'rs-sales',
            columns: [{ name: 'Revenue' }, { name: 'region' }],
          },
        ],
      };
    }
    if (p === '/api/authoring/datasets/gold/columns') {
      return { dataSetId: 'gold', name: 'sales_gold', columns: world.athenaColumns };
    }
    if (p === '/api/authoring/dashboard/busy/rebind/plan') {
      return { canApply: world.canApply, datasets: [{ identifier: 'sales', columns: [] }] };
    }
    if (p === '/api/authoring/dashboard/busy/rebind') return { versionNumber: 7 };
    if (p.startsWith('/api/tags/')) return {};
    throw new PortalCallError(404, `no route ${method} ${p}`);
  });
  return { call, calls };
}

const params = { minViews: 50, fromEngine: 'REDSHIFT', toEngine: 'ATHENA', infer: true };
const busy = { assetType: 'dashboard' as const, assetId: 'busy', name: 'Sales overview' };

describe('specPlaybook: the shipped Redshift → governed Athena example', () => {
  const playbook = specPlaybook(EXAMPLE_SPECS[0]!);
  let world: World;

  beforeEach(() => {
    world = {
      athenaColumns: [{ name: 'revenue' }, { name: 'region' }, { name: 'status' }],
      canApply: true,
    };
  });

  it('selects only the busy dashboard that still reads Redshift', async () => {
    const { call } = portal(world);
    const scope = await playbook.scope({ call, params } as PlaybookContext);
    expect(scope.map((t) => t.assetId)).toEqual(['busy']);
  });

  it('matches by column name, rebinds, and tags the old dataset and its data source', async () => {
    const { call, calls } = portal(world);
    const ctx = { call, params } as PlaybookContext;
    const plan = await playbook.plan(ctx, busy);

    expect(plan.verdict).toBe('change');
    expect(plan.changes).toEqual([
      'sales (redshift) → sales_gold (all 2 columns)',
      'Rebind sales: sales (redshift) → sales_gold',
      'Tag dataset sales (redshift) portal:deprecated=moved to governed Athena',
      'Tag datasource Warehouse portal:deprecated=moved to governed Athena (still read by 1 other dataset)',
    ]);
    // Names that differ only in case are mapped, not missing.
    expect(calls.find((c) => c.path.endsWith('/rebind/plan'))?.body).toEqual({
      rebinds: [
        { identifier: 'sales', targetDataSetId: 'gold', columnMap: { Revenue: 'revenue' } },
      ],
    });

    const outcome = await playbook.apply(ctx, busy, plan);
    expect(outcome.summary).toBe('Rebound (version 7); Tagged 1; Tagged 1');
    expect(
      calls.filter((c) => c.method === 'POST' && c.path.startsWith('/api/tags/')).map((c) => c.path)
    ).toEqual(['/api/tags/dataset/rs-sales', '/api/tags/datasource/rs']);
  });

  it('asks a model when names differ, and takes its mapping when it checks out', async () => {
    world.athenaColumns = [{ name: 'net_revenue' }, { name: 'region' }];
    const { call } = portal(world);
    const infer = vi.fn(async () => ({
      candidateId: 'gold',
      mappings: [
        { from: 'Revenue', to: 'net_revenue', confidence: 0.92, why: 'revenue after refunds' },
        { from: 'region', to: 'region', confidence: 1 },
      ],
    }));
    const plan = await playbook.plan({ call, params, infer } as PlaybookContext, busy);

    expect(plan.verdict).toBe('change');
    expect(plan.changes?.[0]).toContain('inferred, confidence 0.92');
    const prompt = (infer.mock.calls[0] as unknown as [{ user: string }])[0].user;
    expect(prompt).toContain('Revenue after refunds, in USD');
  });

  it('sends a weak, impossible or model-less mapping to review', async () => {
    world.athenaColumns = [{ name: 'net_revenue' }, { name: 'region' }];
    const { call } = portal(world);
    const weak = vi.fn(async () => ({
      candidateId: 'gold',
      mappings: [
        { from: 'Revenue', to: 'net_revenue', confidence: 0.5 },
        { from: 'region', to: 'region', confidence: 1 },
      ],
    }));
    const low = await playbook.plan({ call, params, infer: weak } as PlaybookContext, busy);
    expect(low.verdict).toBe('review');
    expect(low.summary).toContain('below 0.8');

    const invented = vi.fn(async () => ({
      candidateId: 'gold',
      mappings: [
        { from: 'Revenue', to: 'gross', confidence: 0.99 },
        { from: 'region', to: 'region', confidence: 1 },
      ],
    }));
    const bad = await playbook.plan({ call, params, infer: invented } as PlaybookContext, busy);
    expect(bad.verdict).toBe('review');
    expect(bad.summary).toContain('does not have');

    const none = await playbook.plan({ call, params } as PlaybookContext, busy);
    expect(none.verdict).toBe('review');
    expect(none.summary).toContain('no model was chosen');
  });

  it('leaves it for review when the rebind dry run would not resolve', async () => {
    world.canApply = false;
    const { call } = portal(world);
    const plan = await playbook.plan({ call, params } as PlaybookContext, busy);
    expect(plan.verdict).toBe('review');
  });

  it('skips a dashboard that already reads governed Athena', async () => {
    const { call } = portal(world);
    const onGold = { ...busy };
    call.mockImplementationOnce(async () => ({
      datasets: [{ identifier: 'sales', dataSetId: 'gold', columns: [{ name: 'revenue' }] }],
    }));
    // The first call is the definition's datasets; the candidates come after.
    const plan = await playbook.plan({ call, params } as PlaybookContext, onGold);
    expect(plan.verdict).toBe('skip');
  });
});

describe('specPlaybook: a team into its shared folder', () => {
  const playbook = specPlaybook(EXAMPLE_SPECS[1]!);
  const rows = (type: string, items: Array<[string, string]>) =>
    items.map(([id, principal]) => ({
      id,
      name: `${type} ${id}`,
      permissions: [{ principal: `arn:aws:quicksight:us-east-1:1:group/default/${principal}` }],
    }));

  it('selects every type shared with the team, skips what is already in, adds the rest', async () => {
    const posted: Array<{ path: string; body: unknown }> = [];
    const call = vi.fn(async (method: string, path: string, body?: unknown) => {
      const p = new URL(path, 'http://x').pathname;
      const list = (plural: string, items: unknown[]) => ({
        [plural]: items,
        pagination: { totalPages: 1 },
      });
      if (p === '/api/assets/dashboards/paginated')
        return list(
          'dashboards',
          rows('dashboard', [
            ['d1', 'sales-team'],
            ['d2', 'finance'],
          ])
        );
      if (p === '/api/assets/analyses/paginated') return list('analyses', []);
      if (p === '/api/assets/datasets/paginated')
        return list('datasets', rows('dataset', [['s1', 'Sales-Team']]));
      if (p === '/api/assets/datasources/paginated') return list('datasources', []);
      if (method === 'POST') {
        posted.push({ path: p, body });
        return {};
      }
      if (p === '/api/folders/f1') return { name: 'Sales shared' };
      if (p === '/api/folders/f1/members') return [{ MemberId: 's1', MemberType: 'DATASET' }];
      throw new PortalCallError(404, p);
    });
    const ctx = {
      call,
      params: { team: 'sales-team', folder: 'f1' },
    } as unknown as PlaybookContext;

    const scope = await playbook.scope(ctx);
    expect(scope.map((t) => `${t.assetType}:${t.assetId}`)).toEqual(['dashboard:d1', 'dataset:s1']);

    const d1 = await playbook.plan(ctx, scope[0]!);
    const s1 = await playbook.plan(ctx, scope[1]!);
    expect(d1).toMatchObject({ verdict: 'change', changes: ['Add to folder Sales shared'] });
    expect(s1).toMatchObject({ verdict: 'skip', summary: 'Already in Sales shared' });

    await playbook.apply(ctx, scope[0]!, d1);
    expect(posted).toEqual([
      { path: '/api/folders/f1/members', body: { memberId: 'd1', memberType: 'DASHBOARD' } },
    ]);
  });
});
