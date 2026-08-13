import { vi } from 'vitest';

import { type CacheEntry, type MasterCache } from '../../../../shared/models/asset.model';
import {
  principalMatchesGroup,
  principalMatchesUser,
} from '../../../../shared/utils/quicksightUtils';
import { PermissionsService } from '../PermissionsService';

vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: {
    getQuickSightService: vi.fn().mockReturnValue({}),
  },
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: {
    getMasterCache: vi.fn(),
  },
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ACCOUNT = '123456789012';
const ARN_PREFIX = `arn:aws:quicksight:us-east-1:${ACCOUNT}`;
// alice/bob/carol each have access to exactly 4 assets in the fixture
const EXPECTED_ASSETS_PER_USER = 4;
// TeamA: f-a, f-shared, dash-direct-a, dash-in-folder, dash-shared, analysis-both
const TEAM_A_EXPECTED_ASSETS = 6;
// TeamB: f-shared, ds-b, dash-shared
const TEAM_B_EXPECTED_ASSETS = 3;

function entry(
  assetType: string,
  assetId: string,
  assetName: string,
  overrides: Partial<CacheEntry> = {}
): CacheEntry {
  const arnType = assetType === 'user' ? 'user/default' : assetType;
  return {
    assetId,
    assetType,
    assetName,
    arn: `${ARN_PREFIX}:${arnType}/${assetId}`,
    status: 'active',
    enrichmentStatus: 'enriched',
    createdTime: new Date('2024-01-01T00:00:00Z'),
    lastUpdatedTime: new Date('2024-01-01T00:00:00Z'),
    exportedAt: new Date('2024-01-01T00:00:00Z'),
    exportFilePath: `assets/${assetType}s/${assetId}.json`,
    storageType: 'individual',
    tags: [],
    permissions: [],
    metadata: {},
    ...overrides,
  } as CacheEntry;
}

function masterCache(entries: Partial<Record<string, CacheEntry[]>>): MasterCache {
  return {
    version: '2.0',
    lastUpdated: new Date('2024-01-01T00:00:00Z'),
    assetCounts: {} as any,
    entries: {
      dashboard: [],
      analysis: [],
      dataset: [],
      datasource: [],
      folder: [],
      user: [],
      group: [],
      ...entries,
    } as any,
  };
}

/**
 * Reference implementation: the pre-refactor per-(asset × user) algorithm,
 * copied verbatim from the old getBulkUserAssetCounts/collectUserAccessSources.
 * The rewritten inverted-index version must produce identical output.
 */
function referenceOldAlgorithm(userNames: string[], cache: MasterCache): Map<string, number> {
  const users = cache.entries.user || [];
  const groups = cache.entries.group || [];
  const folders = cache.entries.folder || [];

  const findUserGroups = (userName: string): CacheEntry[] =>
    groups.filter((g) => {
      const members = ((g.metadata as any)?.members as any[]) || [];
      return members.some((m: any) => m.memberName === userName || m.userName === userName);
    });

  const userContexts = new Map<
    string,
    { userArn: string; userName: string; userGroups: CacheEntry[]; folders: CacheEntry[] }
  >();
  for (const name of userNames) {
    const userEntry = users.find((u) => u.assetName === name);
    if (userEntry) {
      userContexts.set(name, {
        userArn: userEntry.arn,
        userName: name,
        userGroups: findUserGroups(name),
        folders,
      });
    }
  }

  const collectSources = (
    e: CacheEntry,
    ctx: { userArn: string; userName: string; userGroups: CacheEntry[]; folders: CacheEntry[] }
  ): number => {
    let sources = 0;
    const permissions = (e.permissions as any[]) || [];
    for (const perm of permissions) {
      if (
        perm.principalType === 'USER' &&
        principalMatchesUser(perm.principal, ctx.userArn, ctx.userName)
      ) {
        sources++;
      }
    }
    for (const group of ctx.userGroups) {
      for (const perm of permissions) {
        if (
          perm.principalType === 'GROUP' &&
          principalMatchesGroup(perm.principal, group.arn, group.assetName)
        ) {
          sources++;
        }
      }
    }
    for (const folder of ctx.folders) {
      const isMember = ((folder.metadata as any)?.members as any[])?.some(
        (m: any) => m.MemberId === e.assetId || m.MemberArn === e.arn
      );
      if (!isMember) {
        continue;
      }
      for (const fp of (folder.permissions as any[]) || []) {
        if (
          fp.principalType === 'USER' &&
          principalMatchesUser(fp.principal, ctx.userArn, ctx.userName)
        ) {
          sources++;
        }
        if (fp.principalType === 'GROUP') {
          const matchingGroup = ctx.userGroups.find((g) =>
            principalMatchesGroup(fp.principal, g.arn, g.assetName)
          );
          if (matchingGroup) {
            sources++;
          }
        }
      }
    }
    return sources;
  };

  const counts = new Map<string, number>();
  for (const type of ['dashboard', 'analysis', 'dataset', 'datasource', 'folder']) {
    for (const e of cache.entries[type as keyof typeof cache.entries] || []) {
      for (const [name, ctx] of userContexts) {
        if (collectSources(e, ctx) > 0) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
      }
    }
  }
  for (const name of userNames) {
    if (!counts.has(name)) {
      counts.set(name, 0);
    }
  }
  return counts;
}

function buildFixture(): MasterCache {
  const alice = entry('user', 'u-alice', 'alice');
  const bob = entry('user', 'u-bob', 'bob');
  const carol = entry('user', 'u-carol', 'carol');
  const dave = entry('user', 'u-dave', 'dave'); // no access anywhere

  const admins = entry('group', 'g-admins', 'Admins', {
    metadata: { members: [{ memberName: 'alice' }] } as any,
  });
  const analysts = entry('group', 'g-analysts', 'Analysts', {
    metadata: { members: [{ userName: 'bob' }, { memberName: 'carol' }] } as any,
  });
  const empty = entry('group', 'g-empty', 'EmptyGroup', {
    metadata: { members: [] } as any,
  });

  // Direct access via full ARN principal
  const dash1 = entry('dashboard', 'dash1', 'Dashboard One', {
    permissions: [
      { principal: alice.arn, principalType: 'USER', actions: ['quicksight:DescribeDashboard'] },
    ] as any,
  });
  // Direct access via ARN-suffix principal (endsWith '/bob')
  const dash2 = entry('dashboard', 'dash2', 'Dashboard Two', {
    permissions: [
      {
        principal: `${ARN_PREFIX}:user/other-namespace/bob`,
        principalType: 'USER',
        actions: ['quicksight:DescribeDashboard'],
      },
    ] as any,
  });
  // Group access via bare group name; alice also direct → still counts once
  const dash3 = entry('dashboard', 'dash3', 'Dashboard Three', {
    permissions: [
      { principal: 'Analysts', principalType: 'GROUP', actions: ['quicksight:DescribeDashboard'] },
      { principal: alice.arn, principalType: 'USER', actions: ['quicksight:DescribeDashboard'] },
      { principal: admins.arn, principalType: 'GROUP', actions: ['quicksight:DescribeDashboard'] },
    ] as any,
  });
  // Direct access via bare user name principal
  const ds1 = entry('dataset', 'ds1', 'Dataset One', {
    permissions: [
      { principal: 'carol', principalType: 'USER', actions: ['quicksight:DescribeDataSet'] },
    ] as any,
  });
  // No permissions of its own; reachable only through folders
  const dash5 = entry('dashboard', 'dash5', 'Dashboard Five');
  const dash6 = entry('dashboard', 'dash6', 'Dashboard Six');

  // Folder granting alice access to dash5 (member by MemberId)
  const folder1 = entry('folder', 'f1', 'Folder One', {
    permissions: [
      { principal: alice.arn, principalType: 'USER', actions: ['quicksight:DescribeFolder'] },
    ] as any,
    metadata: { members: [{ MemberId: 'dash5' }], fullPath: '/Folder One' } as any,
  });
  // Folder granting Analysts access to dash6 (member by MemberArn)
  const folder2 = entry('folder', 'f2', 'Folder Two', {
    permissions: [
      {
        principal: `${ARN_PREFIX}:group/default/Analysts`,
        principalType: 'GROUP',
        actions: ['quicksight:DescribeFolder'],
      },
    ] as any,
    metadata: { members: [{ MemberArn: dash6.arn }], fullPath: '/Folder Two' } as any,
  });

  return masterCache({
    user: [alice, bob, carol, dave],
    group: [admins, analysts, empty],
    dashboard: [dash1, dash2, dash3, dash5, dash6],
    dataset: [ds1],
    folder: [folder1, folder2],
  });
}

describe('PermissionsService.getBulkUserAssetCounts', () => {
  let service: PermissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PermissionsService(ACCOUNT);
  });

  it('produces output identical to the pre-refactor per-user algorithm', async () => {
    const cache = buildFixture();
    const userNames = ['alice', 'bob', 'carol', 'dave', 'ghost-not-in-cache'];

    const result = await service.getBulkUserAssetCounts(userNames, cache);
    const reference = referenceOldAlgorithm(userNames, cache);

    expect(Object.fromEntries(result)).toEqual(Object.fromEntries(reference));
  });

  it('counts direct, group, and folder-inherited access exactly once per asset', async () => {
    const cache = buildFixture();
    const result = await service.getBulkUserAssetCounts(['alice', 'bob', 'carol', 'dave'], cache);

    // alice: dash1 (direct ARN), dash3 (direct + Admins group → once),
    //        f1 (folder's own USER perm), dash5 (via f1 membership)
    expect(result.get('alice')).toBe(EXPECTED_ASSETS_PER_USER);
    // bob: dash2 (ARN-suffix), dash3 (Analysts by name),
    //      f2 (folder's own GROUP perm), dash6 (via f2 membership)
    expect(result.get('bob')).toBe(EXPECTED_ASSETS_PER_USER);
    // carol: dash3 (Analysts), ds1 (bare name), f2, dash6
    expect(result.get('carol')).toBe(EXPECTED_ASSETS_PER_USER);
    // dave: no access anywhere
    expect(result.get('dave')).toBe(0);
  });

  it('returns 0 for requested users missing from the cache', async () => {
    const result = await service.getBulkUserAssetCounts(['ghost'], buildFixture());
    expect(result.get('ghost')).toBe(0);
  });

  it('handles empty caches', async () => {
    const result = await service.getBulkUserAssetCounts(['alice'], masterCache({}));
    expect(result.get('alice')).toBe(0);
  });
});

/**
 * Reference implementation: the pre-refactor per-group loop, copied verbatim
 * from the removed AssetService methods (addGroupAssetsCount /
 * findAccessibleFolders / countDirectGroupAssets / checkFolderMembership).
 * The rewritten single-scan version must produce identical output.
 */
function referenceOldGroupAlgorithm(cache: MasterCache): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of cache.entries.group || []) {
    const groupArn = group.arn;
    const groupName = group.assetName;
    const countedAssets = new Set<string>();

    // findAccessibleFolders
    const accessibleFolders: CacheEntry[] = [];
    for (const folder of cache.entries.folder || []) {
      const hasAccess = ((folder.permissions as any[]) || []).some((p: any) =>
        principalMatchesGroup(p.principal, groupArn, groupName)
      );
      if (hasAccess) {
        accessibleFolders.push(folder);
        countedAssets.add(folder.assetId);
      }
    }

    // countDirectGroupAssets
    for (const type of ['dashboard', 'dataset', 'analysis', 'datasource']) {
      for (const assetEntry of cache.entries[type as keyof typeof cache.entries] || []) {
        if (assetEntry.status !== 'active' || countedAssets.has(assetEntry.assetId)) {
          continue;
        }
        const hasDirectAccess = ((assetEntry.permissions as any[]) || []).some((p: any) =>
          principalMatchesGroup(p.principal, groupArn, groupName)
        );
        if (hasDirectAccess) {
          countedAssets.add(assetEntry.assetId);
          continue;
        }
        // checkFolderMembership
        for (const folder of accessibleFolders) {
          const isMember = ((folder.metadata as any)?.members as any[])?.some(
            (m: any) => m.MemberId === assetEntry.assetId || m.MemberArn === assetEntry.arn
          );
          if (isMember) {
            countedAssets.add(assetEntry.assetId);
            break;
          }
        }
      }
    }

    counts.set(groupName, countedAssets.size);
  }
  return counts;
}

function buildGroupFixture(): MasterCache {
  const teamA = entry('group', 'g-teamA', 'TeamA');
  const teamB = entry('group', 'g-teamB', 'TeamB');
  const teamEmpty = entry('group', 'g-empty', 'TeamEmpty');

  // Direct permission via ARN-suffix principal; principalType deliberately
  // USER — the legacy algorithm matches WITHOUT filtering principalType
  const dashDirectA = entry('dashboard', 'dash-direct-a', 'Dash Direct A', {
    permissions: [
      {
        principal: `${ARN_PREFIX}:group/default/TeamA`,
        principalType: 'USER',
        actions: ['quicksight:DescribeDashboard'],
      },
    ] as any,
  });
  // Direct via bare group name
  const dsB = entry('dataset', 'ds-b', 'Dataset B', {
    permissions: [{ principal: 'TeamB', actions: ['quicksight:DescribeDataSet'] }] as any,
  });
  // Inactive asset with TeamA access — must NOT count
  const dashInactive = entry('dashboard', 'dash-inactive', 'Dash Inactive', {
    status: 'archived' as any,
    permissions: [{ principal: teamA.arn, actions: ['quicksight:DescribeDashboard'] }] as any,
  });
  // Reachable only through folders
  const dashInFolder = entry('dashboard', 'dash-in-folder', 'Dash In Folder');
  const dashShared = entry('dashboard', 'dash-shared', 'Dash Shared');
  // Both direct AND folder-member for TeamA — dedupe to one count
  const analysisBoth = entry('analysis', 'analysis-both', 'Analysis Both', {
    permissions: [{ principal: teamA.arn, actions: ['quicksight:DescribeAnalysis'] }] as any,
  });

  // Folder accessible to TeamA (exact ARN), members by MemberId
  const folderA = entry('folder', 'f-a', 'Folder A', {
    permissions: [{ principal: teamA.arn, actions: ['quicksight:DescribeFolder'] }] as any,
    metadata: {
      members: [{ MemberId: 'dash-in-folder' }, { MemberId: 'analysis-both' }],
    } as any,
  });
  // Folder shared by both teams (bare name + suffix), member by MemberArn
  const folderShared = entry('folder', 'f-shared', 'Folder Shared', {
    permissions: [
      { principal: 'TeamA', actions: ['quicksight:DescribeFolder'] },
      { principal: `${ARN_PREFIX}:group/default/TeamB`, actions: ['quicksight:DescribeFolder'] },
    ] as any,
    metadata: { members: [{ MemberArn: dashShared.arn }] } as any,
  });

  return masterCache({
    group: [teamA, teamB, teamEmpty],
    dashboard: [dashDirectA, dashInactive, dashInFolder, dashShared],
    dataset: [dsB],
    analysis: [analysisBoth],
    folder: [folderA, folderShared],
  });
}

describe('PermissionsService.getBulkGroupAssetCounts', () => {
  let service: PermissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PermissionsService(ACCOUNT);
  });

  it('produces output identical to the pre-refactor per-group algorithm', async () => {
    const cache = buildGroupFixture();

    const result = await service.getBulkGroupAssetCounts(undefined, cache);
    const reference = referenceOldGroupAlgorithm(cache);

    expect(Object.fromEntries(result)).toEqual(Object.fromEntries(reference));
  });

  it('counts folders, direct, and folder-inherited assets exactly once each', async () => {
    const result = await service.getBulkGroupAssetCounts(undefined, buildGroupFixture());

    // analysis-both is direct + folder member → counted once; inactive skipped
    expect(result.get('TeamA')).toBe(TEAM_A_EXPECTED_ASSETS);
    expect(result.get('TeamB')).toBe(TEAM_B_EXPECTED_ASSETS);
    expect(result.get('TeamEmpty')).toBe(0);
  });

  it('restricts to the requested groups and defaults missing ones to 0', async () => {
    const result = await service.getBulkGroupAssetCounts(
      ['TeamA', 'not-a-group'],
      buildGroupFixture()
    );

    expect(result.get('TeamA')).toBe(TEAM_A_EXPECTED_ASSETS);
    expect(result.get('not-a-group')).toBe(0);
    expect(result.has('TeamB')).toBe(false);
  });

  it('handles empty caches', async () => {
    const result = await service.getBulkGroupAssetCounts(['TeamA'], masterCache({}));
    expect(result.get('TeamA')).toBe(0);
  });
});
