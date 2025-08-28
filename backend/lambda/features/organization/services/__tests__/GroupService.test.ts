import { vi, type Mock } from 'vitest';

import { cacheService } from '../../../../shared/services/cache/CacheService';
import { GroupService } from '../GroupService';

vi.mock('../../../../shared/services/cache/CacheService');
vi.mock('../../../../shared/services/aws/QuickSightService');
vi.mock('../../../../shared/services/aws/S3Service');
vi.mock('../../../../shared/utils/logger');

// Helper functions to create test data
const createMockGroup = (name: string) => ({
  assetId: name,
  assetName: name,
  arn: `arn:aws:quicksight:us-east-1:123456789012:group/default/${name}`,
  status: 'active',
});

const createMockFolder = (
  id: string,
  name: string,
  groupPrincipal: string,
  members: Array<{ id: string; arn: string }> = []
) => ({
  assetId: id,
  assetName: name,
  arn: `arn:aws:quicksight:us-east-1:123456789012:folder/${id}`,
  status: 'active',
  permissions: [
    {
      principal: groupPrincipal,
      actions: ['VIEW', 'EDIT'],
    },
  ],
  metadata: {
    members: members.map((m) => ({
      MemberId: m.id,
      MemberArn: m.arn,
    })),
  },
});

const createMockDashboard = (id: string, name: string, permissions: any[] = []) => ({
  assetId: id,
  assetName: name,
  arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${id}`,
  status: 'active',
  permissions,
});

// Shared test setup
let groupService: GroupService;
let mockCache: any;

const setupTest = () => {
  vi.clearAllMocks();
  groupService = new GroupService();

  mockCache = {
    entries: {
      group: [],
      folder: [],
      dashboard: [],
      dataset: [],
      analysis: [],
      datasource: [],
    },
  };
};

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    const folder = {
      assetId: 'folder1',
      assetName: 'Shared Folder',
      arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder1',
      status: 'active',
      permissions: [
        {
          principal: 'TeamBeta', // Using just the name
          actions: ['VIEW'],
        },
      ],
      metadata: {
        members: [
          {
            MemberId: 'dashboard2',
            MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard2',
          },
        ],
      },
    };

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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
    mockCache.entries.group = [];
    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

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

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

    const dashboardAssets = await groupService.getGroupAssets('TeamGamma', 'dashboard');
    expect(dashboardAssets.assets).toHaveLength(1);
    expect(dashboardAssets.assets[0]?.assetType).toBe('dashboard');
  });

  it('should filter by dataset type when specified', async () => {
    const teamGroup = createMockGroup('TeamGamma');
    const dataset = {
      assetId: 'dataset1',
      assetName: 'Dataset 1',
      arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
      status: 'active',
      permissions: [
        {
          principal: 'TeamGamma',
          actions: ['VIEW'],
        },
      ],
    };

    mockCache.entries.group = [teamGroup];
    mockCache.entries.dataset = [dataset];
    mockCache.entries.folder = [];

    (cacheService.getMasterCache as Mock).mockResolvedValue(mockCache);

    const datasetAssets = await groupService.getGroupAssets('TeamGamma', 'dataset');
    expect(datasetAssets.assets).toHaveLength(1);
    expect(datasetAssets.assets[0]?.assetType).toBe('dataset');
  });
});
