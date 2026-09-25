import { describe, expect, it, vi } from 'vitest';

import {
  buildBrief,
  compactCalculatedFields,
  compactGovernedDatasets,
  findGovernedDatasets,
} from '../lib/portalBrief';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ok = (data: unknown) => ({ status: 200, body: JSON.stringify({ success: true, data }) });

const CATALOG = {
  configured: true,
  exportedAt: '2026-09-25T08:00:00Z',
  projects: [
    { id: 'prj-sales', name: 'sales_prod', count: 2 },
    { id: 'prj-fin', name: 'finance_prod', count: 1 },
  ],
  assets: [
    {
      listingId: 'l-orders',
      name: 'orders_gold',
      projectId: 'prj-sales',
      projectName: 'sales_prod',
      table: { database: 'published', name: 'orders_gold' },
      datasets: [{ id: 'ds-orders', name: 'Orders (gold)', matchType: 'source-table' }],
    },
    {
      listingId: 'l-cust',
      name: 'customers',
      projectId: 'prj-sales',
      projectName: 'sales_prod',
      datasets: [],
    },
  ],
};

describe('the portal brief', () => {
  it('says SMUS is configured, lists projects, governed coverage, fields and templates', async () => {
    const dispatch = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/smus/status')
        return ok({ configured: true, domainId: 'dzd_1', region: 'us-east-1' });
      if (path === '/api/data-catalog/smus') return ok(CATALOG);
      if (path === '/api/data-catalog/calculated-fields')
        return ok({
          counts: {
            fields: 40,
            names: 35,
            conflicts: 3,
            templated: 5,
            unused: 2,
            datasets: 12,
            outsideSmus: 1,
          },
          items: [],
        });
      if (path === '/api/data-catalog/templates/calculated-fields')
        return ok({
          templates: [{ id: 't1', name: 'margin_pct', expression: '{margin} / {revenue}' }],
        });
      if (path.startsWith('/api/assets/dashboards/paginated'))
        return ok({ dashboards: [{ id: 'std-1', name: 'Exec standard' }] });
      return { status: 404, body: '' };
    });
    const brief = await buildBrief(dispatch);
    expect(brief).toContain(
      'SMUS is configured: domain dzd_1 in us-east-1, last exported 2026-09-25T08:00:00Z'
    );
    expect(brief).toContain('sales_prod (prj-sales, 2); finance_prod (prj-fin, 1)');
    expect(brief).toContain(
      '2 published listings in scope; 1 already have a linked QuickSight dataset'
    );
    expect(brief).toContain('40 distinct across 12 datasets; 3 conflicts');
    expect(brief).toContain('- margin_pct = {margin} / {revenue} [template t1]');
    expect(brief).toContain('- Exec standard [dashboard std-1]');
    // Layout standards are found by the template tag, as the Studio finds them.
    const standards = dispatch.mock.calls.find((c) => c[0].path.includes('paginated'))![0].path;
    expect(decodeURIComponent(standards)).toContain('quicksight-portal:template');
  });

  it('never claims SMUS is off when its status could not be read', async () => {
    const brief = await buildBrief(async () => ({ status: 500, body: 'boom' }));
    expect(brief).toContain('SMUS status could not be read');
    expect(brief).not.toContain('not configured');
  });
});

describe('governed datasets', () => {
  it('names each listing, its project and table, and the datasets linked to it', () => {
    const text = compactGovernedDatasets(CATALOG);
    expect(text).toContain(
      '- orders_gold [listing l-orders; project sales_prod table published.orders_gold] -> Orders (gold) (id ds-orders, by source-table)'
    );
    expect(text).toContain(
      '- customers [listing l-cust; project sales_prod] -> no linked QuickSight dataset yet'
    );
    expect(compactGovernedDatasets({ configured: false })).toBe(
      'SMUS is not configured for this portal.'
    );
  });

  it('asks the catalog the way the Data Catalog page does, by search and project', async () => {
    const dispatch = vi.fn(async (_request: { method: string; path: string }) => ok(CATALOG));
    await findGovernedDatasets(dispatch, 'orders gold', 'prj-sales');
    expect(dispatch.mock.calls[0]?.[0].path).toBe(
      '/api/data-catalog/smus?search=orders%20gold&projectId=prj-sales&scope=smus'
    );
  });

  it('summarises calculated fields with their conflicts and templates', () => {
    const text = compactCalculatedFields({
      counts: { fields: 2, names: 1, conflicts: 1, templated: 1 },
      items: [
        {
          key: 'k1',
          name: 'margin',
          expression: '{revenue} - {cost}',
          datasets: [{ name: 'Orders (gold)' }],
          conflict: true,
          template: { name: 'margin' },
        },
      ],
    });
    expect(text).toContain('2 fields (1 names, 1 conflicts, 1 match a template)');
    expect(text).toContain(
      '- margin = {revenue} - {cost} [key k1; on Orders (gold); CONFLICT, template margin]'
    );
  });
});
