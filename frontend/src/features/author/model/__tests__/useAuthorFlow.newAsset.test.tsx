/**
 * The from-nothing flow end to end through the hook: ?new=1 opens it, a
 * dataset and a visual reach the preview body, an ask goes to the planner
 * and its visuals come back editable, and the create body carries the
 * audience and the folder. Server calls are stubbed at the API barrel.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assetsApi, authoringApi } from '@/shared/api';

import { useAuthorFlow } from '../useAuthorFlow';

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api')>();
  return {
    ...actual,
    assetsApi: { getCachedAsset: vi.fn(), getDashboardsPaginated: vi.fn() },
    authoringApi: {
      getDatasets: vi.fn(),
      getInsights: vi.fn(),
      planRepair: vi.fn(),
      propose: vi.fn(),
      previewRebind: vi.fn(),
      applyRebind: vi.fn(),
      previewNew: vi.fn(),
      proposeNew: vi.fn(),
      createNew: vi.fn(),
      getDatasetColumns: vi.fn(),
    },
    tagsApi: { updateResourceTags: vi.fn(), removeResourceTags: vi.fn() },
  };
});

const DATASET_COLUMNS = {
  dataSetId: 'sales-gold',
  name: 'sales gold',
  columns: [
    { name: 'region', type: 'STRING' },
    { name: 'revenue', type: 'DECIMAL' },
  ],
};

const PROPOSED = [
  {
    type: 'BarChart' as const,
    title: 'Revenue by region',
    identifier: 'sales_gold',
    category: 'region',
    values: [{ column: 'revenue', aggregation: 'SUM' as const }],
  },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/author?new=1']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function lastBody(fn: ReturnType<typeof vi.fn>): Record<string, any> {
  const calls = fn.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, any>;
}

/** A dataset with one complete visual on it: the mockup can open. */
async function withVisual(result: { current: ReturnType<typeof useAuthorFlow> }) {
  act(() => result.current.fresh.addDataset({ id: 'sales-gold', name: 'sales gold' }));
  await waitFor(() => expect(authoringApi.getDatasetColumns).toHaveBeenCalledWith('sales-gold'));
  act(() => result.current.fresh.addVisual());
  const id = result.current.fresh.visuals[0]!.id;
  act(() => {
    result.current.fresh.updateVisual(id, { title: 'Revenue by region', category: 'region' });
  });
  act(() => result.current.fresh.updateValue(id, 0, { column: 'revenue', aggregation: 'SUM' }));
  return id;
}

describe('useAuthorFlow from nothing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authoringApi.getDatasetColumns).mockResolvedValue(DATASET_COLUMNS as never);
    vi.mocked(assetsApi.getDashboardsPaginated).mockResolvedValue({ dashboards: [] } as never);
    vi.mocked(authoringApi.getInsights).mockRejectedValue(new Error('no insights'));
    vi.mocked(authoringApi.planRepair).mockRejectedValue(new Error('no plan'));
    vi.mocked(authoringApi.getDatasets).mockResolvedValue({ datasets: [] } as never);
    // The planner runs as a job; the client waits for it and hands back a preview.
    vi.mocked(authoringApi.proposeNew).mockImplementation((request) =>
      vi.mocked(authoringApi.previewNew)(request)
    );
    vi.mocked(authoringApi.previewNew).mockResolvedValue({
      definition: { DataSetIdentifierDeclarations: [], Sheets: [] },
      outline: [],
      changes: [],
      warnings: ['Orders: order_id is not in sales_gold; skipped.'],
      visuals: PROPOSED,
      proposal: {
        reason: 'Region is the only category',
        model: { provider: 'bedrock', model: 'm' },
      },
    } as never);
    vi.mocked(authoringApi.createNew).mockResolvedValue({
      assetType: 'dashboard',
      assetId: 'regional-sales-new',
      name: 'Regional sales',
      arn: 'arn:x',
      versionNumber: 1,
      changes: [],
      warnings: [],
      folderId: 'fld-sales',
    } as never);
  });

  afterEach(() => cleanup());

  it('?new=1 opens the from-nothing steps with nothing chosen', () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    expect(result.current.state.mode).toBe('new');
    expect(result.current.state.step).toBe('targets');
    expect(result.current.steps.map((s) => s.id)).toEqual([
      'targets',
      'visuals',
      'standard',
      'mockup',
      'publish',
    ]);
    expect(result.current.fresh.ready).toBe(false);
    expect(result.current.status.mockup).toBe('locked');
  });

  it('reads the chosen dataset’s columns from its cached export', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    act(() => result.current.fresh.addDataset({ id: 'sales-gold', name: 'sales gold' }));
    expect(result.current.fresh.datasets).toEqual([
      { identifier: 'sales_gold', dataSetId: 'sales-gold', name: 'sales gold' },
    ]);
    await waitFor(() =>
      expect(result.current.fresh.columns.sales_gold?.columns).toEqual([
        { name: 'region', type: 'STRING' },
        { name: 'revenue', type: 'DECIMAL' },
      ])
    );
  });

  it('a complete visual opens the mockup and rides the preview body', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await withVisual(result);
    expect(result.current.fresh.ready).toBe(true);
    expect(result.current.status.mockup).toBe('available');

    act(() => result.current.goTo('mockup'));
    await waitFor(() =>
      expect(lastBody(vi.mocked(authoringApi.previewNew))).toMatchObject({
        assetType: 'dashboard',
        datasets: [{ identifier: 'sales_gold', dataSetId: 'sales-gold' }],
        visuals: [
          {
            type: 'BarChart',
            title: 'Revenue by region',
            identifier: 'sales_gold',
            category: 'region',
            values: [{ column: 'revenue', aggregation: 'SUM' }],
          },
        ],
      })
    );
    await waitFor(() =>
      expect(result.current.preview.warnings).toEqual([
        'Orders: order_id is not in sales_gold; skipped.',
      ])
    );
    // Nothing to compare a new asset with.
    expect(result.current.preview.diff).toBeNull();
    expect(authoringApi.previewRebind).not.toHaveBeenCalled();
  });

  it('an ask goes to the planner and its visuals come back editable', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    act(() => result.current.fresh.addDataset({ id: 'sales-gold', name: 'sales gold' }));
    act(() => result.current.setAsk('revenue by region'));
    await act(async () => {
      await result.current.propose();
    });

    const body = lastBody(vi.mocked(authoringApi.proposeNew));
    expect(body.ask).toBe('revenue by region');
    expect(body.visuals).toBeUndefined();
    expect(authoringApi.propose).not.toHaveBeenCalled();
    expect(result.current.fresh.visuals).toHaveLength(1);
    expect(result.current.fresh.visuals[0]).toMatchObject({
      type: 'BarChart',
      title: 'Revenue by region',
      category: 'region',
    });
    expect(result.current.fresh.proposal?.reason).toBe('Region is the only category');
  });

  it('creating sends the name, the audience and the folder, and reports the result', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await withVisual(result);
    act(() => {
      result.current.fresh.setName('  Regional sales  ');
      result.current.fresh.setSheetName('Overview');
      result.current.fresh.setAudience({
        type: 'dashboard',
        id: 'exec-summary',
        name: 'Executive summary',
      });
      result.current.setFolder({ id: 'fld-sales', name: 'Sales' });
    });

    await act(async () => {
      await result.current.publish();
    });
    expect(authoringApi.createNew).toHaveBeenCalledTimes(1);
    expect(lastBody(vi.mocked(authoringApi.createNew))).toMatchObject({
      name: 'Regional sales',
      sheetName: 'Overview',
      permissionsFrom: { assetType: 'dashboard', assetId: 'exec-summary' },
      folderId: 'fld-sales',
    });
    expect(authoringApi.applyRebind).not.toHaveBeenCalled();
    expect(result.current.state.result).toMatchObject({
      assetId: 'regional-sales-new',
      mode: 'create',
      versionNumber: 1,
    });
    expect(result.current.state.step).toBe('publish');
  });

  it('refuses to create without a name', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await withVisual(result);
    await act(async () => {
      await result.current.publish();
    });
    expect(authoringApi.createNew).not.toHaveBeenCalled();
  });
});
