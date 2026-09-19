import { describe, expect, it, vi } from 'vitest';

vi.mock('../../handlers/AuthoringHandler', () => ({
  AuthoringHandler: vi.fn().mockImplementation(function () {
    return {
      getDatasets: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      planRebind: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      applyRebind: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      propose: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      previewRebind: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      getDatasetColumns: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    };
  }),
}));

import { extractPathParams } from '../../../../api/utils/routeUtils';
import { authoringRoutes } from '../index';

const matches = (route: (typeof authoringRoutes)[number], path: string) =>
  typeof route.path === 'string' ? route.path === path : route.path.test(path);
const find = (method: string, path: string) =>
  authoringRoutes.find((r) => r.method === method && matches(r, path));

describe('authoringRoutes', () => {
  it('routes datasets, plan and apply for analyses and dashboards', () => {
    expect(find('GET', '/authoring/analysis/a1/datasets')).toBeDefined();
    expect(find('GET', '/authoring/dashboard/d1/datasets')).toBeDefined();
    expect(find('POST', '/authoring/analysis/a1/rebind/plan')).toBeDefined();
    expect(find('POST', '/authoring/dashboard/d1/rebind')).toBeDefined();
    expect(find('POST', '/authoring/analysis/a1/propose')).toBeDefined();
    expect(find('POST', '/authoring/analysis/a1/rebind/preview')).toBeDefined();
  });

  it('does not match other asset types', () => {
    expect(find('GET', '/authoring/dataset/x/datasets')).toBeUndefined();
    expect(find('POST', '/authoring/datasets/x/rebind')).toBeUndefined();
  });

  it('keeps plan and apply distinct', () => {
    const plan = find('POST', '/authoring/analysis/a1/rebind/plan');
    const apply = find('POST', '/authoring/analysis/a1/rebind');
    expect(plan).not.toBe(apply);
    expect((apply?.path as RegExp).test('/authoring/analysis/a1/rebind/plan')).toBe(false);
  });

  it('serves the from-nothing paths literally, ahead of the asset routes', () => {
    expect(find('POST', '/authoring/new/preview')).toBeDefined();
    expect(find('POST', '/authoring/new')).toBeDefined();
    expect(find('POST', '/authoring/new/rebind')).toBeUndefined();
  });

  it("serves a dataset's columns without an asset, and only for that path", () => {
    const route = find('GET', '/authoring/datasets/ds-1/columns');
    expect(route).toBeDefined();
    expect(find('GET', '/authoring/datasets/ds-1/datasets')).toBeUndefined();
    // No names passed, exactly as the router calls it: the path patterns must
    // read this as a dataset id, not as an assetType/assetId pair.
    expect(extractPathParams('/authoring/datasets/ds-1/columns', route?.path as RegExp)).toEqual({
      dataSetId: 'ds-1',
    });
  });

  it('exposes assetType and assetId as path parameters', () => {
    const route = find('POST', '/authoring/dashboard/d-42/rebind/plan');
    expect(
      extractPathParams('/authoring/dashboard/d-42/rebind/plan', route?.path as RegExp)
    ).toEqual({
      assetType: 'dashboard',
      assetId: 'd-42',
    });
  });
});
