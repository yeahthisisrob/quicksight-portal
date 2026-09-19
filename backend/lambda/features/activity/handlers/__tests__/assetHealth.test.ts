import type { APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ batch: vi.fn() }));

vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ email: 'rob' }),
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../adapters/aws/CloudWatchAdapter', () => ({
  CloudWatchAdapter: vi.fn().mockImplementation(function () {
    return { getAssetHealthBatch: mocks.batch };
  }),
}));

import { getAssetHealth } from '../ActivityHandler';

const event = (query: Record<string, string>): APIGatewayProxyEvent =>
  ({ queryStringParameters: query, headers: {}, requestContext: {} }) as any;

describe('getAssetHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batch.mockImplementation(async (_k: string, ids: string[]) =>
      ids.map((id) => ({ id, viewLoads: 5, viewLoadTimeP90Ms: 1200, visualErrors: 0 }))
    );
  });

  it('reads one batch for a page and serves repeats from the container cache', async () => {
    const first = JSON.parse(
      (await getAssetHealth(event({ assetType: 'dashboard', ids: 'a,b,b' }))).body
    );
    expect(first.data).toMatchObject({ assetType: 'dashboard', windowDays: 30, available: true });
    expect(first.data.items.map((i: any) => i.id)).toEqual(['a', 'b']);
    expect(mocks.batch).toHaveBeenCalledWith('dashboard', ['a', 'b'], 30);

    const second = JSON.parse(
      (await getAssetHealth(event({ assetType: 'dashboard', ids: 'b,c' }))).body
    );
    expect(mocks.batch).toHaveBeenLastCalledWith('dashboard', ['c'], 30);
    expect(second.data.items.map((i: any) => i.id).sort()).toEqual(['b', 'c']);
  });

  it('rejects bad input and reports unavailable metrics instead of failing', async () => {
    expect((await getAssetHealth(event({ assetType: 'analysis', ids: 'a' }))).statusCode).toBe(400);
    expect((await getAssetHealth(event({ assetType: 'dataset', ids: '' }))).statusCode).toBe(400);
    mocks.batch.mockRejectedValue(new Error('AccessDenied'));
    const result = JSON.parse(
      (await getAssetHealth(event({ assetType: 'dataset', ids: 'zz' }))).body
    );
    expect(result.success).toBe(true);
    expect(result.data.available).toBe(false);
    expect(result.data.items).toEqual([]);
  });
});
