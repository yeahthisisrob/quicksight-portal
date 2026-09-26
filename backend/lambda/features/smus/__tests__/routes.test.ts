import { describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/SmusHandler', () => ({
  getSmusDataSource: vi.fn(),
  getSmusStatus: vi.fn(),
  getSmusDatasetLinks: vi.fn(),
  listSmusAssets: vi.fn(),
  createSmusDataset: vi.fn(),
  startSmusExport: vi.fn(),
}));

import { smusRoutes } from '../index';

describe('smusRoutes', () => {
  it('exposes the data source choice, status, the export trigger, links, assets and dataset creation', () => {
    expect(smusRoutes.map((r) => `${r.method} ${String(r.path)}`)).toEqual([
      'GET /smus/data-source',
      'GET /smus/status',
      'POST /smus/export',
      'POST /smus/dataset-links',
      'GET /smus/assets',
      'POST /^\\/smus\\/assets\\/([^/]+)\\/dataset$/',
    ]);
  });
});
