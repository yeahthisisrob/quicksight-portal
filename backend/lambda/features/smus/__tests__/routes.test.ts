import { describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/SmusHandler', () => ({
  getSmusStatus: vi.fn(),
  getSmusDatasetLinks: vi.fn(),
  listSmusAssets: vi.fn(),
  startSmusExport: vi.fn(),
}));

import { smusRoutes } from '../index';

describe('smusRoutes', () => {
  it('exposes status, the export trigger, links and assets; datasets are created through authoring', () => {
    expect(smusRoutes.map((r) => `${r.method} ${String(r.path)}`)).toEqual([
      'GET /smus/status',
      'POST /smus/export',
      'POST /smus/dataset-links',
      'GET /smus/assets',
    ]);
  });
});
