import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCacheEntries, get } = vi.hoisted(() => ({ getCacheEntries: vi.fn(), get: vi.fn() }));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: { getCacheEntries },
}));
vi.mock('../../../../shared/services/settings/SettingsStore', () => ({ settingsStore: { get } }));

import { quickSightUserFor } from '../../../../shared/services/identity/IdentityResolver';
import { audienceFor, fileInFolders, OWNER_ACTIONS, withOwner } from '../audience';

const ROB = {
  assetId: 'rob',
  assetName: 'rob',
  arn: 'arn:aws:quicksight:us-east-1:1:user/default/rob',
  metadata: { email: 'Rob@Example.com' },
};

describe('who sees what the portal builds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCacheEntries.mockResolvedValue([
      ROB,
      { assetId: 'x', arn: 'arn:x', metadata: { email: 'x@example.com' } },
    ]);
    get.mockReturnValue(['f-shared']);
  });

  it('finds the builder by sign-in email, whatever the case', async () => {
    expect(await quickSightUserFor('rob@example.com')).toEqual({ userName: 'rob', arn: ROB.arn });
    expect(await quickSightUserFor('nobody@example.com')).toBeUndefined();
    expect(await quickSightUserFor(undefined)).toBeUndefined();
  });

  it('adds the builder as owner, merging with what the asset inherits', () => {
    const merged = withOwner(
      [
        { Principal: ROB.arn, Actions: ['quicksight:DescribeAnalysis'] },
        { Principal: 'arn:g', Actions: ['quicksight:DescribeAnalysis'] },
      ],
      ROB.arn,
      'analysis'
    );
    expect(merged[0]!.Actions.sort()).toEqual([...OWNER_ACTIONS.analysis].sort());
    expect(merged[1]).toEqual({ Principal: 'arn:g', Actions: ['quicksight:DescribeAnalysis'] });
    expect(withOwner(undefined, ROB.arn, 'dashboard')).toEqual([
      { Principal: ROB.arn, Actions: OWNER_ACTIONS.dashboard },
    ]);
  });

  it('files in the request folder and the default folders, and warns only when nothing gives an audience', async () => {
    const auth = { userId: 'u', accountId: '1', email: 'rob@example.com' };
    const audience = await audienceFor('analysis', undefined, auth, 'f-mine');
    expect(audience.folderIds).toEqual(['f-mine', 'f-shared']);
    expect(audience.owner?.userName).toBe('rob');
    expect(audience.permissions).toHaveLength(1);
    expect(audience.warnings).toEqual([]);

    get.mockReturnValue([]);
    const stranger = await audienceFor('analysis', undefined, {
      userId: 'u',
      accountId: '1',
      email: 'nobody@example.com',
    });
    expect(stranger.warnings).toEqual([
      expect.stringContaining('No QuickSight user has the email nobody@example.com'),
      expect.stringContaining('Only account admins will see this'),
    ]);
  });

  it('files in each folder, and a folder that refuses is a warning, not a failure', async () => {
    const createFolderMembership = vi.fn(async (folderId: string) => {
      if (folderId === 'gone') throw new Error('ResourceNotFound');
    });
    const result = await fileInFolders(
      { createFolderMembership },
      ['ok', 'gone'],
      'a1',
      'dashboard'
    );
    expect(result.filed).toEqual(['ok']);
    expect(result.warnings).toEqual(['It could not be filed in folder gone: ResourceNotFound.']);
    expect(createFolderMembership).toHaveBeenCalledWith('ok', 'a1', 'DASHBOARD');
  });
});
