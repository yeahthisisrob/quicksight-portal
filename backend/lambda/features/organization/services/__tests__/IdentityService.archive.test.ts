import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdentityService } from '../IdentityService';

const mocks = vi.hoisted(() => ({
  qs: {
    describeUser: vi.fn(),
    deleteUser: vi.fn(),
    listUserGroups: vi.fn(),
    createGroupMembership: vi.fn(),
    updatePermissions: vi.fn(),
  },
  archive: { save: vi.fn(), get: vi.fn() },
  access: vi.fn(),
}));

vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => mocks.qs },
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: { updateAsset: vi.fn() },
}));
vi.mock('../../../../shared/services/organization/PermissionsService', () => ({
  PermissionsService: vi.fn(function PermissionsService() {
    return { getUserAssetAccess: mocks.access };
  }),
}));
vi.mock('../UserArchive', () => ({
  UserArchive: vi.fn(function UserArchive() {
    return mocks.archive;
  }),
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ARN = 'arn:aws:quicksight:us-east-1:1:user/default/pat';
const reader = { UserName: 'pat', Role: 'READER', Arn: ARN, Email: 'pat@example.com' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.archive.save.mockResolvedValue(undefined);
  mocks.qs.describeUser.mockResolvedValue(reader);
  mocks.qs.listUserGroups.mockResolvedValue([{ GroupName: 'All Readers' }]);
  mocks.access.mockResolvedValue({
    assets: [
      {
        assetType: 'dashboard',
        assetId: 'd1',
        assetName: 'Sales',
        sources: [
          { type: 'direct', actions: ['quicksight:DescribeDashboard'] },
          { type: 'group', groupName: 'All Readers', actions: ['quicksight:QueryDashboard'] },
        ],
      },
      // Reached only through the group: comes back with the group, not archived.
      {
        assetType: 'dashboard',
        assetId: 'd2',
        assetName: 'Ops',
        sources: [{ type: 'group', groupName: 'All Readers', actions: ['x'] }],
      },
    ],
  });
});

describe('deleting a user archives what they had first', () => {
  it('keeps their groups and direct permissions, then deletes', async () => {
    await new IdentityService('1').deleteUser('pat', 'admin');
    expect(mocks.archive.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: 'pat',
        role: 'READER',
        arn: ARN,
        archivedBy: 'admin',
        groups: ['All Readers'],
        permissions: [
          {
            assetType: 'dashboard',
            assetId: 'd1',
            assetName: 'Sales',
            actions: ['quicksight:DescribeDashboard'],
          },
        ],
      })
    );
    expect(mocks.archive.save.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.qs.deleteUser.mock.invocationCallOrder[0]!
    );
  });

  it('deletes nothing when the archive cannot be kept', async () => {
    mocks.archive.save.mockRejectedValue(new Error('S3 down'));
    await expect(new IdentityService('1').deleteUser('pat')).rejects.toThrow('S3 down');
    expect(mocks.qs.deleteUser).not.toHaveBeenCalled();
  });
});

describe('restoring a user', () => {
  const archived = {
    userName: 'pat',
    role: 'READER',
    arn: ARN,
    archivedAt: '2026-09-01T00:00:00.000Z',
    groups: ['All Readers', 'Gone Team'],
    permissions: [
      { assetType: 'dashboard', assetId: 'd1', assetName: 'Sales', actions: ['a', 'b'] },
      { assetType: 'folder', assetId: 'f-gone', assetName: 'Old', actions: ['c'] },
    ],
  };

  it('rejoins groups and grants again, reporting what is no longer there', async () => {
    mocks.archive.get.mockResolvedValue(archived);
    mocks.qs.createGroupMembership.mockImplementation(async (group: string) => {
      if (group === 'Gone Team') throw new Error('ResourceNotFound');
    });
    mocks.qs.updatePermissions.mockImplementation(async (type: string) => {
      if (type === 'folder') throw new Error('ResourceNotFound');
    });

    const result = await new IdentityService('1').restoreUser('pat', 'admin');
    expect(result).toEqual({
      userName: 'pat',
      groups: { restored: ['All Readers'], missing: ['Gone Team'] },
      permissions: {
        restored: 1,
        failed: [{ asset: 'folder Old', error: 'ResourceNotFound' }],
      },
    });
    expect(mocks.qs.updatePermissions).toHaveBeenCalledWith('dashboard', 'd1', [
      { Principal: ARN, Actions: ['a', 'b'] },
    ]);
    expect(mocks.archive.save).toHaveBeenCalledWith(
      expect.objectContaining({ restoredBy: 'admin', restoredAt: expect.any(String) })
    );
  });

  it('says so when nothing was archived, or the user is not back yet', async () => {
    mocks.archive.get.mockResolvedValue(null);
    await expect(new IdentityService('1').restoreUser('pat')).rejects.toMatchObject({
      statusCode: 404,
    });

    mocks.archive.get.mockResolvedValue(archived);
    mocks.qs.describeUser.mockRejectedValue(new Error('ResourceNotFoundException'));
    await expect(new IdentityService('1').restoreUser('pat')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('comes back when they sign in'),
    });
  });
});
