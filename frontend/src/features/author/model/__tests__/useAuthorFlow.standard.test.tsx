/**
 * The Standard step end to end through the hook: a template and type rules
 * reach the preview and apply bodies, and a rule alone is enough to open the
 * mockup. Server calls are stubbed at the API barrel.
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
    },
    tagsApi: { updateResourceTags: vi.fn(), removeResourceTags: vi.fn() },
  };
});

const EMPTY_DEFINITION = { DataSetIdentifierDeclarations: [], Sheets: [] };
const PLAN = { canApply: true, rebinds: [], summary: { ok: 0, missing: 0, typeChanged: 0 } };
// In-place, same name: nothing to write until the standard says so.
const TEMPLATE_CANDIDATE = { id: 'exec-summary', name: 'Executive summary', views: 12 };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/author?type=dashboard&id=sales-overview&name=Sales']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function lastBody(fn: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = fn.mock.calls;
  return calls[calls.length - 1]?.[2] as Record<string, unknown>;
}

/**
 * The draft reloads after mount (clone mode, "<name> (copy)"), which already
 * counts as a change. Wait for that, then switch to an in-place update with
 * the source's own name so nothing is pending until the standard says so.
 */
async function inPlace(result: { current: ReturnType<typeof useAuthorFlow> }) {
  await waitFor(() => expect(assetsApi.getCachedAsset).toHaveBeenCalled());
  await waitFor(() => expect(result.current.draft.name).toBe('Sales (copy)'));
  await waitFor(() => expect(result.current.draft.loading).toBe(false));
  act(() => {
    result.current.draft.setMode('update');
    result.current.draft.setName('Sales');
  });
  expect(result.current.status.mockup).toBe('locked');
}

describe('useAuthorFlow with a standard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assetsApi.getCachedAsset).mockResolvedValue({
      Name: 'Sales',
      Definition: EMPTY_DEFINITION,
    } as never);
    vi.mocked(assetsApi.getDashboardsPaginated).mockResolvedValue({
      dashboards: [{ id: 'exec-summary', name: 'Executive summary', activity: { totalViews: 12 } }],
    } as never);
    vi.mocked(authoringApi.getDatasets).mockResolvedValue({ datasets: [] } as never);
    vi.mocked(authoringApi.getInsights).mockRejectedValue(new Error('no insights'));
    vi.mocked(authoringApi.planRepair).mockRejectedValue(new Error('no plan'));
    vi.mocked(authoringApi.previewRebind).mockResolvedValue({
      plan: PLAN,
      definition: EMPTY_DEFINITION,
      changes: [],
      warnings: ['Monthly trend stayed a table'],
      themeArn: 'arn:aws:quicksight:us-east-1:1:theme/standard',
    } as never);
    vi.mocked(authoringApi.applyRebind).mockResolvedValue({
      assetType: 'dashboard',
      assetId: 'sales-overview',
      name: 'Sales',
      arn: 'arn:x',
      mode: 'update',
      versionNumber: 2,
      plan: PLAN,
      changes: [],
    } as never);
  });

  afterEach(() => cleanup());

  it('lists the tagged dashboards as candidates', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await waitFor(() => expect(result.current.standard.candidates.loading).toBe(false));
    expect(result.current.standard.candidates.items).toEqual([TEMPLATE_CANDIDATE]);
    expect(vi.mocked(assetsApi.getDashboardsPaginated).mock.calls[0]?.[0]).toMatchObject({
      includeTags: expect.stringContaining('quicksight-portal:template'),
    });
  });

  it('a rule alone opens the mockup and rides the preview body', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await inPlace(result);

    act(() => result.current.standard.addChartRule({ from: 'Table', to: 'PivotTable' }));
    expect(result.current.standard.active).toBe(true);
    expect(result.current.status.standard).toBe('done');
    expect(result.current.status.mockup).toBe('available');

    act(() => result.current.goTo('mockup'));
    expect(result.current.state.step).toBe('mockup');
    await waitFor(() =>
      expect(lastBody(vi.mocked(authoringApi.previewRebind))).toMatchObject({
        typeRules: { chartFamily: [{ from: 'Table', to: 'PivotTable' }] },
      })
    );
    expect(lastBody(vi.mocked(authoringApi.previewRebind)).template).toBeUndefined();

    await waitFor(() =>
      expect(result.current.preview.warnings).toEqual(['Monthly trend stayed a table'])
    );
    expect(result.current.preview.themeArn).toBe('arn:aws:quicksight:us-east-1:1:theme/standard');
  });

  it('sends the template with every part, and both again on apply', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await waitFor(() => expect(result.current.standard.candidates.loading).toBe(false));
    await inPlace(result);

    act(() => {
      result.current.standard.chooseTemplate(TEMPLATE_CANDIDATE);
      result.current.standard.setTypeRules({ kpi: true });
    });
    act(() => result.current.standard.setTemplatePart('theme', false));
    expect(result.current.standard.template).toMatchObject({
      assetId: 'exec-summary',
      name: 'Executive summary',
      parts: { theme: false, controls: true },
    });

    act(() => result.current.goTo('mockup'));
    const expected = {
      template: {
        assetType: 'dashboard',
        assetId: 'exec-summary',
        textBoxes: true,
        controls: true,
        sheetNames: true,
        kpisFirst: true,
        theme: false,
      },
      typeRules: { kpi: true },
    };
    // The preview key is debounced, so the body with the standard lands after a beat.
    await waitFor(() =>
      expect(lastBody(vi.mocked(authoringApi.previewRebind))).toMatchObject(expected)
    );

    await act(async () => {
      await result.current.publish();
    });
    expect(authoringApi.applyRebind).toHaveBeenCalledTimes(1);
    expect(lastBody(vi.mocked(authoringApi.applyRebind))).toMatchObject({
      mode: 'update',
      ...expected,
    });
    expect(result.current.state.result?.versionNumber).toBe(2);
  });

  it('drops the standard with "None" and with a new source', async () => {
    const { result } = renderHook(() => useAuthorFlow(), { wrapper });
    await inPlace(result);
    act(() => result.current.standard.chooseTemplate(TEMPLATE_CANDIDATE));
    expect(result.current.standard.active).toBe(true);
    expect(result.current.status.mockup).toBe('available');
    act(() => result.current.standard.chooseTemplate(null));
    expect(result.current.standard.active).toBe(false);
    expect(result.current.status.mockup).toBe('locked');

    act(() => result.current.standard.setTypeRules({ casts: true }));
    act(() =>
      result.current.selectSource({ type: 'analysis', id: 'draft-1', name: 'Draft analysis' })
    );
    expect(result.current.state.typeRules.casts).toBe(false);
    expect(result.current.standard.active).toBe(false);
  });
});
