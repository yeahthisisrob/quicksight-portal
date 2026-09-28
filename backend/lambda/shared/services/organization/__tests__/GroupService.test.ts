import { vi } from 'vitest';

import type { CatalogEntry, CatalogSnapshot } from '../../../models/asset.model';
import { catalogEntry, useTestCatalog } from '../../../utils/testUtils/testCatalog';
import { GroupService } from '../GroupService';

vi.mock('../../aws/QuickSightService');
vi.mock('../../aws/S3Service');
vi.mock('../../../utils/logger');

const { seed } = useTestCatalog();

const folderMembers = (members: Array<{ MemberId: string; MemberArn: string }>) => ({ members });

// Helper functions to create test data
const createMockGroup = (name: string, members?: any[]) =>
  catalogEntry('group', name, {
    arn: `arn:aws:quicksight:us-east-1:123456789012:group/default/${name}`,
    ...(members ? { metadata: { members } } : {}),
  });

const createMockFolder = (
  id: string,
  name: string,
  groupPrincipal: string,
  members: Array<{ id: string; arn: string }> = []
) =>
  catalogEntry('folder', id, {
    assetName: name,
    arn: `arn:aws:quicksight:us-east-1:123456789012:folder/${id}`,
    permissions: [{ principal: groupPrincipal, principalType: 'GROUP', actions: ['VIEW', 'EDIT'] }],
    metadata: folderMembers(members.map((m) => ({ MemberId: m.id, MemberArn: m.arn }))),
  });

const createMockDashboard = (id: string, name: string, permissions: any[] = []) =>
  catalogEntry('dashboard', id, {
    assetName: name,
    arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${id}`,
    permissions,
  });

// Shared test setup
let groupService: GroupService;
let mockCache: { entries: Partial<Record<string, CatalogEntry[]>> };

const setupTest = () => {
  vi.clearAllMocks();
  groupService = new GroupService();

  mockCache = { entries: {} };
};

/** Put the test's entries in the catalog. */
const seedCache = () => seed(Object.values(mockCache.entries).flat() as CatalogEntry[]);

/** The test's entries as a snapshot, for the methods that take one. */
const snapshot = () => ({ entries: mockCache.entries, version: '1' }) as CatalogSnapshot;

describe('GroupService - getGroupAssets - folder access', () => {
  beforeEach(setupTest);

  it('should correctly identify assets for TeamAlpha via folder access', async () => {
    const teamAlphaGroup = createMockGroup('TeamAlpha');
    const folderWithTeamAlphaAccess = createMockFolder(
      'folder1',
      'Folder 1',
      'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha',
      [
        {
          id: 'dashboard1',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard1',
        },
      ]
    );
    const dashboard1 = createMockDashboard('dashboard1', 'Dashboard 1');

    mockCache.entries.group = [teamAlphaGroup];
    mockCache.entries.folder = [folderWithTeamAlphaAccess];
    mockCache.entries.dashboard = [dashboard1];

    await seedCache();

    const teamAlphaAssets = await groupService.getGroupAssets('TeamAlpha');

    expect(teamAlphaAssets.groupName).toBe('TeamAlpha');
    expect(teamAlphaAssets.totalAssets).toBe(2); // folder1 and dashboard1
    expect(teamAlphaAssets.assets).toHaveLength(2);

    const assetIds = teamAlphaAssets.assets.map((a) => a.assetId);
    expect(assetIds).toContain('folder1');
    expect(assetIds).toContain('dashboard1');
  });

  it('should correctly identify assets for TeamAlpha1 via folder access', async () => {
    const teamAlpha1Group = createMockGroup('TeamAlpha1');
    const folderWithTeamAlpha1Access = createMockFolder(
      'folder2',
      'Folder 2',
      'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha1',
      [
        {
          id: 'dashboard2',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard2',
        },
      ]
    );
    const dashboard2 = createMockDashboard('dashboard2', 'Dashboard 2');

    mockCache.entries.group = [teamAlpha1Group];
    mockCache.entries.folder = [folderWithTeamAlpha1Access];
    mockCache.entries.dashboard = [dashboard2];

    await seedCache();

    const teamAlpha1Assets = await groupService.getGroupAssets('TeamAlpha1');

    expect(teamAlpha1Assets.groupName).toBe('TeamAlpha1');
    expect(teamAlpha1Assets.totalAssets).toBe(2); // folder2 and dashboard2
    expect(teamAlpha1Assets.assets).toHaveLength(2);

    const asset1Ids = teamAlpha1Assets.assets.map((a) => a.assetId);
    expect(asset1Ids).toContain('folder2');
    expect(asset1Ids).toContain('dashboard2');
  });

  it('should not mix up assets between similar group names', async () => {
    const teamAlphaGroup = createMockGroup('TeamAlpha');
    const teamAlpha1Group = createMockGroup('TeamAlpha1');

    const folderWithTeamAlphaAccess = createMockFolder(
      'folder1',
      'Folder 1',
      'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha',
      [{ id: 'dashboard1', arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard1' }]
    );

    const folderWithTeamAlpha1Access = createMockFolder(
      'folder2',
      'Folder 2',
      'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamAlpha1',
      [{ id: 'dashboard2', arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard2' }]
    );

    const dashboard1 = createMockDashboard('dashboard1', 'Dashboard 1');
    const dashboard2 = createMockDashboard('dashboard2', 'Dashboard 2');

    mockCache.entries.group = [teamAlphaGroup, teamAlpha1Group];
    mockCache.entries.folder = [folderWithTeamAlphaAccess, folderWithTeamAlpha1Access];
    mockCache.entries.dashboard = [dashboard1, dashboard2];

    await seedCache();

    // TeamAlpha should NOT see TeamAlpha1's assets
    const teamAlphaAssets = await groupService.getGroupAssets('TeamAlpha');
    const alphaAssetIds = teamAlphaAssets.assets.map((a) => a.assetId);
    expect(alphaAssetIds).not.toContain('folder2');
    expect(alphaAssetIds).not.toContain('dashboard2');

    // TeamAlpha1 should NOT see TeamAlpha's assets
    const teamAlpha1Assets = await groupService.getGroupAssets('TeamAlpha1');
    const alpha1AssetIds = teamAlpha1Assets.assets.map((a) => a.assetId);
    expect(alpha1AssetIds).not.toContain('folder1');
    expect(alpha1AssetIds).not.toContain('dashboard1');
  });
});

describe('GroupService - getGroupAssets - direct permissions', () => {
  beforeEach(setupTest);

  it('should handle direct permissions for Team1', async () => {
    const team1Group = createMockGroup('Team1');
    const dashboardWithTeam1Access = createMockDashboard('dashboard1', 'Dashboard for Team1', [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team1',
        actions: ['VIEW'],
      },
    ]);

    mockCache.entries.group = [team1Group];
    mockCache.entries.dashboard = [dashboardWithTeam1Access];
    mockCache.entries.folder = [];

    await seedCache();

    const team1Assets = await groupService.getGroupAssets('Team1');
    expect(team1Assets.assets).toHaveLength(1);
    expect(team1Assets.assets[0]?.assetId).toBe('dashboard1');
    expect(team1Assets.assets[0]?.accessType).toBe('direct');
  });

  it('should handle direct permissions for Team10', async () => {
    const team10Group = createMockGroup('Team10');
    const dashboardWithTeam10Access = createMockDashboard('dashboard10', 'Dashboard for Team10', [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team10',
        actions: ['VIEW', 'EDIT'],
      },
    ]);

    mockCache.entries.group = [team10Group];
    mockCache.entries.dashboard = [dashboardWithTeam10Access];
    mockCache.entries.folder = [];

    await seedCache();

    const team10Assets = await groupService.getGroupAssets('Team10');
    expect(team10Assets.assets).toHaveLength(1);
    expect(team10Assets.assets[0]?.assetId).toBe('dashboard10');
    expect(team10Assets.assets[0]?.accessType).toBe('direct');
  });

  it('should not mix up direct permissions between Team1 and Team10', async () => {
    const team1Group = createMockGroup('Team1');
    const team10Group = createMockGroup('Team10');

    const dashboardWithTeam1Access = createMockDashboard('dashboard1', 'Dashboard for Team1', [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team1',
        actions: ['VIEW'],
      },
    ]);

    const dashboardWithTeam10Access = createMockDashboard('dashboard10', 'Dashboard for Team10', [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Team10',
        actions: ['VIEW', 'EDIT'],
      },
    ]);

    mockCache.entries.group = [team1Group, team10Group];
    mockCache.entries.dashboard = [dashboardWithTeam1Access, dashboardWithTeam10Access];
    mockCache.entries.folder = [];

    await seedCache();

    // Team1 should only see dashboard1
    const team1Assets = await groupService.getGroupAssets('Team1');
    expect(team1Assets.assets).toHaveLength(1);
    expect(team1Assets.assets[0]?.assetId).toBe('dashboard1');

    // Team10 should only see dashboard10
    const team10Assets = await groupService.getGroupAssets('Team10');
    expect(team10Assets.assets).toHaveLength(1);
    expect(team10Assets.assets[0]?.assetId).toBe('dashboard10');
  });
});

describe('GroupService - getGroupAssets - mixed and special cases', () => {
  beforeEach(setupTest);

  it('should handle mixed direct and folder-inherited permissions', async () => {
    const teamGroup = createMockGroup('TeamBeta');

    const folder = catalogEntry('folder', 'folder1', {
      assetName: 'Shared Folder',
      arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder1',
      permissions: [
        {
          principal: 'TeamBeta', // Using just the name
          principalType: 'GROUP',
          actions: ['VIEW'],
        },
      ],
      metadata: folderMembers([
        {
          MemberId: 'dashboard2',
          MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard2',
        },
      ]),
    });

    const dashboardDirect = createMockDashboard('dashboard1', 'Direct Dashboard', [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/TeamBeta',
        actions: ['VIEW', 'EDIT'],
      },
    ]);

    const dashboardInherited = createMockDashboard('dashboard2', 'Inherited Dashboard');

    mockCache.entries.group = [teamGroup];
    mockCache.entries.folder = [folder];
    mockCache.entries.dashboard = [dashboardDirect, dashboardInherited];

    await seedCache();

    const assets = await groupService.getGroupAssets('TeamBeta');

    const EXPECTED_TOTAL_ASSETS = 3; // folder, dashboard1 (direct), dashboard2 (inherited)
    expect(assets.totalAssets).toBe(EXPECTED_TOTAL_ASSETS);

    const directDashboard = assets.assets.find((a) => a.assetId === 'dashboard1');
    expect(directDashboard).toBeDefined();
    expect(directDashboard?.accessType).toBe('direct');
    expect(directDashboard?.permissions).toEqual(['VIEW', 'EDIT']);

    const inheritedDashboard = assets.assets.find((a) => a.assetId === 'dashboard2');
    expect(inheritedDashboard).toBeDefined();
    expect(inheritedDashboard?.accessType).toBe('folder_inherited');
    expect(inheritedDashboard?.folderPath).toBe('Shared Folder');
  });

  it('should throw error for non-existent group', async () => {
    await expect(groupService.getGroupAssets('NonExistentGroup')).rejects.toThrow(
      'Group NonExistentGroup not found'
    );
  });

  it('should filter by dashboard type when specified', async () => {
    const teamGroup = createMockGroup('TeamGamma');
    const dashboard = createMockDashboard('dashboard1', 'Dashboard 1', [
      {
        principal: 'TeamGamma',
        actions: ['VIEW'],
      },
    ]);

    mockCache.entries.group = [teamGroup];
    mockCache.entries.dashboard = [dashboard];
    mockCache.entries.folder = [];

    await seedCache();

    const dashboardAssets = await groupService.getGroupAssets('TeamGamma', 'dashboard');
    expect(dashboardAssets.assets).toHaveLength(1);
    expect(dashboardAssets.assets[0]?.assetType).toBe('dashboard');
  });

  it('should filter by dataset type when specified', async () => {
    const teamGroup = createMockGroup('TeamGamma');
    const dataset = catalogEntry('dataset', 'dataset1', {
      assetName: 'Dataset 1',
      arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
      permissions: [
        {
          principal: 'TeamGamma',
          principalType: 'GROUP',
          actions: ['VIEW'],
        },
      ],
    });

    mockCache.entries.group = [teamGroup];
    mockCache.entries.dataset = [dataset];
    mockCache.entries.folder = [];

    await seedCache();

    const datasetAssets = await groupService.getGroupAssets('TeamGamma', 'dataset');
    expect(datasetAssets.assets).toHaveLength(1);
    expect(datasetAssets.assets[0]?.assetType).toBe('dataset');
  });
});

describe('GroupService - getUserGroupsBulk', () => {
  beforeEach(setupTest);

  it('matches members via memberName, userName, and principalId keys', () => {
    mockCache.entries.group = [
      createMockGroup('ByMemberName', [{ memberName: 'alice' }]),
      createMockGroup('ByUserName', [{ userName: 'bob' }]),
      createMockGroup('ByPrincipalId', [{ principalId: 'carol' }]),
    ];

    const result = groupService.getUserGroupsBulk(['alice', 'bob', 'carol'], snapshot());

    expect(result.get('alice')?.map((g) => g.groupName)).toEqual(['ByMemberName']);
    expect(result.get('bob')?.map((g) => g.groupName)).toEqual(['ByUserName']);
    expect(result.get('carol')?.map((g) => g.groupName)).toEqual(['ByPrincipalId']);
  });

  it('returns all groups for a user in multiple groups', () => {
    mockCache.entries.group = [
      createMockGroup('Admins', [{ memberName: 'alice' }]),
      createMockGroup('Analysts', [{ memberName: 'alice' }, { memberName: 'bob' }]),
    ];

    const result = groupService.getUserGroupsBulk(['alice', 'bob'], snapshot());

    expect(result.get('alice')?.map((g) => g.groupName)).toEqual(['Admins', 'Analysts']);
    expect(result.get('bob')?.map((g) => g.groupName)).toEqual(['Analysts']);
  });

  it('dedupes a group matched under multiple member keys for the same user', () => {
    mockCache.entries.group = [
      createMockGroup('Admins', [{ memberName: 'alice', userName: 'alice', principalId: 'alice' }]),
    ];

    const result = groupService.getUserGroupsBulk(['alice'], snapshot());

    expect(result.get('alice')).toHaveLength(1);
  });

  it('returns an empty array for users in no groups', () => {
    mockCache.entries.group = [createMockGroup('Admins', [{ memberName: 'alice' }])];

    const result = groupService.getUserGroupsBulk(['nobody'], snapshot());

    expect(result.get('nobody')).toEqual([]);
  });

  it('agrees with the per-user getUserGroups results', async () => {
    mockCache.entries.group = [
      createMockGroup('A', [{ memberName: 'u1' }]),
      createMockGroup('B', [{ userName: 'u1' }, { principalId: 'u2' }]),
      createMockGroup('C', [{ memberName: 'other' }]),
    ];
    await seedCache();

    const bulk = groupService.getUserGroupsBulk(['u1', 'u2'], snapshot());
    const perUser1 = await groupService.getUserGroups('u1');
    const perUser2 = await groupService.getUserGroups('u2');

    expect(bulk.get('u1')).toEqual(perUser1);
    expect(bulk.get('u2')).toEqual(perUser2);
  });
});
