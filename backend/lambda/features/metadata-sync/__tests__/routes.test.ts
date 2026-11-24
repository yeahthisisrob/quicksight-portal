import { describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/MetadataSyncHandler', () => ({
  getMetadataSyncStatus: vi.fn(),
  startMetadataSync: vi.fn(),
  resolveMetadataConflict: vi.fn(),
}));

import { metadataSyncRoutes } from '../index';

describe('metadataSyncRoutes', () => {
  it('exposes the status, a preview or run, and settling a conflict', () => {
    expect(metadataSyncRoutes.map((r) => `${r.method} ${String(r.path)}`)).toEqual([
      'GET /metadata-sync/status',
      'POST /metadata-sync/sync',
      'POST /metadata-sync/resolve',
    ]);
  });
});
