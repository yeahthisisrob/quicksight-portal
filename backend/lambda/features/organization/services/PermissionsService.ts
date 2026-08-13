import { type CacheEntry, type MasterCache } from '../../../shared/models/asset.model';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { ASSET_TYPES, type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { principalMatchesGroup, principalMatchesUser } from '../../../shared/utils/quicksightUtils';
import { type AssetPermission } from '../types';

/**
 * Describes how a user has access to an asset
 */
export interface AccessSource {
  type: 'direct' | 'group' | 'folder';
  actions: string[];
  groupName?: string;
  folderName?: string;
  folderPath?: string;
}

/**
 * A user with all the ways they can access an asset
 */
export interface UserAccessInfo {
  userName: string;
  userArn: string;
  sources: AccessSource[];
}

/**
 * A group with all the ways it can access an asset
 */
export interface GroupAccessInfo {
  groupName: string;
  groupArn: string;
  sources: AccessSource[];
}

/**
 * Tracks user access info during resolution
 */
type UserAccessMap = Map<string, UserAccessInfo>;

/**
 * Tracks group access info during resolution
 */
type GroupAccessMap = Map<string, GroupAccessInfo>;

/**
 * Per-call lookup structures for the bulk user asset-count scan
 */
interface BulkAccessResolvers {
  collectPermissionUsers: (permissions: any[], into: Set<string>) => void;
  foldersByMemberKey: Map<string, CacheEntry[]>;
  resolveFolderUsers: (folder: CacheEntry) => Set<string>;
}

export class PermissionsService {
  private readonly quickSightService: QuickSightService;

  constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  /**
   * Get permissions for an analysis
   */
  public async getAnalysisPermissions(analysisId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeAnalysisPermissions(analysisId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching analysis permissions for ${analysisId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for any asset type
   */
  public async getAssetPermissions(
    assetType: AssetType,
    assetId: string
  ): Promise<AssetPermission[]> {
    // Map asset types to their corresponding permission methods
    const permissionMethods: Record<AssetType, () => Promise<AssetPermission[]>> = {
      [ASSET_TYPES.dashboard]: () => this.getDashboardPermissions(assetId),
      [ASSET_TYPES.analysis]: () => this.getAnalysisPermissions(assetId),
      [ASSET_TYPES.dataset]: () => this.getDataSetPermissions(assetId),
      [ASSET_TYPES.datasource]: () => this.getDataSourcePermissions(assetId),
      [ASSET_TYPES.folder]: () => this.getFolderPermissions(assetId),
      // Users and groups don't have permissions in QuickSight
      [ASSET_TYPES.user]: () => Promise.resolve([]),
      [ASSET_TYPES.group]: () => Promise.resolve([]),
    };

    const method = permissionMethods[assetType];
    if (!method) {
      logger.error(`Unknown asset type: ${assetType}`);
      return Promise.resolve([]);
    }

    return await method();
  }

  /**
   * Get asset access counts for groups in a single cache scan.
   *
   * Semantics (must match the legacy per-group loop exactly): a group's count
   * is the number of DISTINCT assetIds among (a) every folder whose
   * permissions match the group principal — no status check on folders —
   * and (b) every ACTIVE dashboard/dataset/analysis/datasource matched by a
   * direct permission or contained in an accessible folder. Note the legacy
   * code matches principals WITHOUT filtering principalType; preserved here.
   *
   * @param groupNames restrict to these groups (default: all groups in cache)
   */
  public async getBulkGroupAssetCounts(
    groupNames?: string[],
    prefetchedCache?: MasterCache
  ): Promise<Map<string, number>> {
    const cache = prefetchedCache ?? (await cacheService.getMasterCache());
    const allGroups = cache.entries.group || [];
    const folders = cache.entries.folder || [];

    const requestedNames = groupNames ? new Set(groupNames) : undefined;
    const requestedGroups = requestedNames
      ? allGroups.filter((g) => requestedNames.has(g.assetName))
      : allGroups;

    const resolveGroupPrincipal = this.buildGroupPrincipalResolver(requestedGroups);

    // groupName → distinct assetIds with access
    const countedByGroup = new Map<string, Set<string>>();
    for (const group of requestedGroups) {
      countedByGroup.set(group.assetName, new Set<string>());
    }

    // Accessible folders: counted themselves, and grant access to their members
    const groupsByFolderArn = this.collectFolderAccessForGroups(
      folders,
      resolveGroupPrincipal,
      countedByGroup
    );

    this.scanAssetsForGroupCounts(cache, resolveGroupPrincipal, groupsByFolderArn, countedByGroup);

    const counts = new Map<string, number>();
    for (const [name, assetIds] of countedByGroup) {
      counts.set(name, assetIds.size);
    }
    for (const name of groupNames || []) {
      if (!counts.has(name)) {
        counts.set(name, 0);
      }
    }
    return counts;
  }

  /**
   * Get asset access counts for all users in a single cache scan.
   * Much more efficient than calling getUserAssetAccess per user.
   */
  public async getBulkUserAssetCounts(
    userNames: string[],
    prefetchedCache?: MasterCache
  ): Promise<Map<string, number>> {
    const cache = prefetchedCache ?? (await cacheService.getMasterCache());
    const resolvers = this.buildBulkAccessResolvers(cache, userNames);

    const counts = new Map<string, number>();
    const assetTypesToCheck: AssetType[] = [
      'dashboard',
      'analysis',
      'dataset',
      'datasource',
      'folder',
    ];

    // Single scan: for each asset, resolve the set of users with any access
    for (const type of assetTypesToCheck) {
      for (const entry of cache.entries[type] || []) {
        for (const name of this.resolveEntryAccessUsers(entry, resolvers)) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
      }
    }

    // Ensure all requested users have an entry
    for (const name of userNames) {
      if (!counts.has(name)) {
        counts.set(name, 0);
      }
    }

    return counts;
  }

  /**
   * Get permissions for a dashboard
   */
  public async getDashboardPermissions(dashboardId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeDashboardPermissions(dashboardId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching dashboard permissions for ${dashboardId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for a dataset
   */
  public async getDataSetPermissions(dataSetId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeDatasetPermissions(dataSetId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching dataset permissions for ${dataSetId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for a data source
   */
  public async getDataSourcePermissions(dataSourceId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeDatasourcePermissions(dataSourceId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching datasource permissions for ${dataSourceId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for a folder
   */
  public async getFolderPermissions(folderId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeFolderPermissions(folderId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching folder permissions for ${folderId}:`, error);
      return [];
    }
  }

  /**
   * Get enriched permission sources for an asset.
   * Resolves how each user has access: direct, via group, or via folder.
   */
  public async getPermissionSources(
    assetType: AssetType,
    assetId: string
  ): Promise<{
    permissions: AssetPermission[];
    userAccessSources: UserAccessInfo[];
    groupAccessSources: GroupAccessInfo[];
  }> {
    const cache = await cacheService.getMasterCache();
    const asset = (cache.entries[assetType] || []).find((e: CacheEntry) => e.assetId === assetId);

    if (!asset) {
      throw new Error(`Asset ${assetType}/${assetId} not found`);
    }

    const permissions = asset.permissions || [];
    const userAccessMap: UserAccessMap = new Map();
    const groupAccessMap: GroupAccessMap = new Map();
    const groups = cache.entries.group || [];
    const users = cache.entries.user || [];
    const folders = cache.entries.folder || [];

    this.resolveDirectAccess(permissions, users, userAccessMap);
    this.resolveDirectGroupAccess(permissions, groupAccessMap);
    this.resolveGroupAccess(permissions, groups, users, userAccessMap);
    this.resolveFolderAccess(folders, assetId, asset.arn, groups, users, userAccessMap);
    this.resolveFolderGroupAccess(folders, assetId, asset.arn, groups, groupAccessMap);

    return {
      permissions: this.transformPermissions(permissions as any[]),
      userAccessSources: Array.from(userAccessMap.values()),
      groupAccessSources: Array.from(groupAccessMap.values()),
    };
  }

  /**
   * Get all assets a user has access to (inverse of getPermissionSources).
   * Scans cached assets and resolves how the user has access: direct, via group, or via folder.
   */
  public async getUserAssetAccess(
    userName: string,
    filterAssetType?: string
  ): Promise<{
    userName: string;
    totalAssets: number;
    assetsByType: Record<string, number>;
    assets: Array<{
      assetId: string;
      assetType: string;
      assetName: string;
      arn: string;
      sources: AccessSource[];
    }>;
  }> {
    const cache = await cacheService.getMasterCache();
    const users = cache.entries.user || [];
    const groups = cache.entries.group || [];
    const folders = cache.entries.folder || [];

    const userEntry = users.find((u: CacheEntry) => u.assetName === userName);
    if (!userEntry) {
      throw new Error(`User ${userName} not found`);
    }

    const userGroups = this.findUserGroups(userName, groups);
    const assetTypesToCheck = filterAssetType
      ? [filterAssetType]
      : ['dashboard', 'analysis', 'dataset', 'datasource', 'folder'];

    const ctx = { userArn: userEntry.arn, userName, userGroups, folders };
    const assetsByType: Record<string, number> = {};
    const assets: Array<{
      assetId: string;
      assetType: string;
      assetName: string;
      arn: string;
      sources: AccessSource[];
    }> = [];

    for (const type of assetTypesToCheck) {
      const entries = cache.entries[type as AssetType] || [];
      for (const entry of entries) {
        const sources = this.collectUserAccessSources(entry, ctx);
        if (sources.length > 0) {
          assets.push({
            assetId: entry.assetId,
            assetType: type,
            assetName: entry.assetName,
            arn: entry.arn,
            sources,
          });
          const pluralType = type === 'analysis' ? 'analyses' : `${type}s`;
          assetsByType[pluralType] = (assetsByType[pluralType] || 0) + 1;
        }
      }
    }

    return { userName, totalAssets: assets.length, assetsByType, assets };
  }

  /**
   * Build the per-call lookup structures for the bulk asset-count scan.
   *
   * Principal matching is fuzzy (exact ARN, exact name, or "/name" suffix) and
   * one principal string can match several users, so resolution stays a linear
   * scan — but memoized per distinct principal instead of run per (asset × user).
   */
  private buildBulkAccessResolvers(cache: MasterCache, userNames: string[]): BulkAccessResolvers {
    const groups = cache.entries.group || [];
    const requestedUsers = this.buildRequestedUsers(userNames, cache.entries.user || []);
    const requestedMembersByGroupArn = this.buildRequestedMembersByGroupArn(
      groups,
      new Set(requestedUsers.map((u) => u.userName))
    );

    const userPrincipalMemo = new Map<string, Set<string>>();
    const resolveUserPrincipal = (principal: string | undefined): Set<string> | undefined => {
      if (!principal) {
        return undefined;
      }
      let matched = userPrincipalMemo.get(principal);
      if (!matched) {
        matched = new Set<string>();
        for (const u of requestedUsers) {
          if (principalMatchesUser(principal, u.userArn, u.userName)) {
            matched.add(u.userName);
          }
        }
        userPrincipalMemo.set(principal, matched);
      }
      return matched;
    };

    const groupPrincipalMemo = new Map<string, Set<string>>();
    const resolveGroupPrincipalMembers = (
      principal: string | undefined
    ): Set<string> | undefined => {
      if (!principal) {
        return undefined;
      }
      let matched = groupPrincipalMemo.get(principal);
      if (!matched) {
        matched = new Set<string>();
        for (const group of groups) {
          const memberSet = requestedMembersByGroupArn.get(group.arn);
          if (memberSet && principalMatchesGroup(principal, group.arn, group.assetName)) {
            for (const name of memberSet) {
              matched.add(name);
            }
          }
        }
        groupPrincipalMemo.set(principal, matched);
      }
      return matched;
    };

    // Users with access through an asset's own permission list
    const collectPermissionUsers = (permissions: any[], into: Set<string>): void => {
      for (const perm of permissions) {
        let matched: Set<string> | undefined;
        if (perm.principalType === 'USER') {
          matched = resolveUserPrincipal(perm.principal);
        } else if (perm.principalType === 'GROUP') {
          matched = resolveGroupPrincipalMembers(perm.principal);
        }
        if (matched) {
          for (const name of matched) {
            into.add(name);
          }
        }
      }
    };

    // Folder permissions are asset-independent: resolve each folder's users once
    const folderUsersMemo = new Map<string, Set<string>>();
    const resolveFolderUsers = (folder: CacheEntry): Set<string> => {
      let matched = folderUsersMemo.get(folder.arn);
      if (!matched) {
        matched = new Set<string>();
        collectPermissionUsers(folder.permissions || [], matched);
        folderUsersMemo.set(folder.arn, matched);
      }
      return matched;
    };

    return {
      collectPermissionUsers,
      foldersByMemberKey: this.buildFoldersByMemberKey(cache.entries.folder || []),
      resolveFolderUsers,
    };
  }

  /**
   * Index folders by member id/arn so the asset scan avoids rescanning all folders
   */
  private buildFoldersByMemberKey(folders: CacheEntry[]): Map<string, CacheEntry[]> {
    const foldersByMemberKey = new Map<string, CacheEntry[]>();
    for (const folder of folders) {
      const members = (folder.metadata?.members as any[]) || [];
      for (const m of members) {
        for (const key of [m.MemberId, m.MemberArn]) {
          if (!key) {
            continue;
          }
          const existing = foldersByMemberKey.get(key);
          if (existing) {
            existing.push(folder);
          } else {
            foldersByMemberKey.set(key, [folder]);
          }
        }
      }
    }
    return foldersByMemberKey;
  }

  /**
   * Memoized fuzzy principal → matching group names (exact ARN, exact name,
   * or "/name" suffix). Linear scan per DISTINCT principal string only.
   */
  private buildGroupPrincipalResolver(
    requestedGroups: CacheEntry[]
  ): (principal: string | undefined) => Set<string> {
    const memo = new Map<string, Set<string>>();
    const empty = new Set<string>();
    return (principal: string | undefined): Set<string> => {
      if (!principal) {
        return empty;
      }
      let matched = memo.get(principal);
      if (!matched) {
        matched = new Set<string>();
        for (const group of requestedGroups) {
          if (principalMatchesGroup(principal, group.arn, group.assetName)) {
            matched.add(group.assetName);
          }
        }
        memo.set(principal, matched);
      }
      return matched;
    };
  }

  /**
   * Map group arn → requested member names (same member keys findUserGroups matches on)
   */
  private buildRequestedMembersByGroupArn(
    groups: CacheEntry[],
    requestedNames: Set<string>
  ): Map<string, Set<string>> {
    const requestedMembersByGroupArn = new Map<string, Set<string>>();
    for (const group of groups) {
      const members = (group.metadata?.members as any[]) || [];
      let memberSet: Set<string> | undefined;
      for (const m of members) {
        for (const key of [m.memberName, m.userName]) {
          if (key && requestedNames.has(key)) {
            memberSet ??= new Set<string>();
            memberSet.add(key);
          }
        }
      }
      if (memberSet) {
        requestedMembersByGroupArn.set(group.arn, memberSet);
      }
    }
    return requestedMembersByGroupArn;
  }

  /**
   * Requested users that exist in the user cache, with their ARNs
   */
  private buildRequestedUsers(
    userNames: string[],
    users: CacheEntry[]
  ): Array<{ userName: string; userArn: string }> {
    const userByName = new Map<string, CacheEntry>();
    for (const u of users) {
      userByName.set(u.assetName, u);
    }
    const requestedUsers: Array<{ userName: string; userArn: string }> = [];
    for (const name of new Set(userNames)) {
      const entry = userByName.get(name);
      if (entry) {
        requestedUsers.push({ userName: name, userArn: entry.arn });
      }
    }
    return requestedUsers;
  }

  /**
   * Resolve which groups each folder grants access to. Accessible folders are
   * themselves counted for those groups (legacy semantics: no folder status
   * check). Returns folder.arn → group names for the member scan.
   */
  private collectFolderAccessForGroups(
    folders: CacheEntry[],
    resolveGroupPrincipal: (principal: string | undefined) => Set<string>,
    countedByGroup: Map<string, Set<string>>
  ): Map<string, Set<string>> {
    const groupsByFolderArn = new Map<string, Set<string>>();
    for (const folder of folders) {
      const matched = new Set<string>();
      for (const perm of (folder.permissions as any[]) || []) {
        for (const name of resolveGroupPrincipal(perm.principal)) {
          matched.add(name);
        }
      }
      if (matched.size > 0) {
        groupsByFolderArn.set(folder.arn, matched);
        for (const name of matched) {
          countedByGroup.get(name)?.add(folder.assetId);
        }
      }
    }
    return groupsByFolderArn;
  }

  /**
   * Collect all access sources for a single asset entry for a given user
   */
  private collectUserAccessSources(
    entry: CacheEntry,
    ctx: { userArn: string; userName: string; userGroups: CacheEntry[]; folders: CacheEntry[] }
  ): AccessSource[] {
    const sources: AccessSource[] = [];
    const permissions = entry.permissions || [];

    // Direct user access
    for (const perm of permissions) {
      if (
        perm.principalType === 'USER' &&
        principalMatchesUser(perm.principal, ctx.userArn, ctx.userName)
      ) {
        sources.push({ type: 'direct', actions: perm.actions || [] });
      }
    }

    // Group access
    for (const group of ctx.userGroups) {
      for (const perm of permissions) {
        if (
          perm.principalType === 'GROUP' &&
          principalMatchesGroup(perm.principal, group.arn, group.assetName)
        ) {
          sources.push({ type: 'group', actions: perm.actions || [], groupName: group.assetName });
        }
      }
    }

    // Folder access
    this.collectUserFolderAccess(entry, ctx, sources);

    return sources;
  }

  /**
   * Collect folder-based access sources for a user on a specific asset
   */
  private collectUserFolderAccess(
    entry: CacheEntry,
    ctx: { userArn: string; userName: string; userGroups: CacheEntry[]; folders: CacheEntry[] },
    sources: AccessSource[]
  ): void {
    for (const folder of ctx.folders) {
      const isMember = folder.metadata?.members?.some(
        (m: any) => m.MemberId === entry.assetId || m.MemberArn === entry.arn
      );
      if (!isMember) {
        continue;
      }

      const folderPerms = folder.permissions || [];
      const folderName = (folder.metadata?.fullPath as string) || folder.assetName;

      for (const fp of folderPerms) {
        if (
          fp.principalType === 'USER' &&
          principalMatchesUser(fp.principal, ctx.userArn, ctx.userName)
        ) {
          sources.push({
            type: 'folder',
            actions: fp.actions || [],
            folderName,
            folderPath: folderName,
          });
        }
        if (fp.principalType === 'GROUP') {
          const matchingGroup = ctx.userGroups.find((g: CacheEntry) =>
            principalMatchesGroup(fp.principal, g.arn, g.assetName)
          );
          if (matchingGroup) {
            sources.push({
              type: 'folder',
              actions: fp.actions || [],
              folderName,
              folderPath: folderName,
              groupName: matchingGroup.assetName,
            });
          }
        }
      }
    }
  }

  /**
   * Determine if a principal is a user or group
   */
  private determinePrincipalType(principal: string): 'USER' | 'GROUP' {
    if (principal.includes(':group/')) {
      return 'GROUP';
    }
    return 'USER';
  }

  /**
   * Get or create a user entry in the access map
   */
  private ensureUser(map: UserAccessMap, userName: string, userArn: string): UserAccessInfo {
    const existing = map.get(userName);
    if (existing) {
      return existing;
    }
    const info: UserAccessInfo = { userName, userArn, sources: [] };
    map.set(userName, info);
    return info;
  }

  /**
   * Find a user's ARN from the users cache
   */
  private findUserArn(users: CacheEntry[], name: string): string {
    const entry = users.find((u: CacheEntry) => u.assetName === name);
    return entry?.arn || name;
  }

  /**
   * Find all groups a user belongs to
   */
  private findUserGroups(userName: string, groups: CacheEntry[]): CacheEntry[] {
    return groups.filter((g: CacheEntry) => {
      const members = (g.metadata?.members as any[]) || [];
      return members.some((m: any) => m.memberName === userName || m.userName === userName);
    });
  }

  /**
   * Resolve direct user permissions on the asset
   */
  private resolveDirectAccess(permissions: any[], users: CacheEntry[], map: UserAccessMap): void {
    for (const perm of permissions) {
      if (perm.principalType === 'USER') {
        const userEntry = users.find((u: CacheEntry) =>
          principalMatchesUser(perm.principal, u.arn, u.assetName)
        );
        const userName = userEntry?.assetName || perm.principal.split('/').pop() || perm.principal;
        const info = this.ensureUser(map, userName, userEntry?.arn || perm.principal);
        info.sources.push({ type: 'direct', actions: perm.actions || [] });
      }
    }
  }

  /**
   * Resolve direct group permissions on the asset
   */
  private resolveDirectGroupAccess(permissions: any[], map: GroupAccessMap): void {
    for (const perm of permissions) {
      if (perm.principalType !== 'GROUP') {
        continue;
      }
      const groupName = perm.principal.split('/').pop() || perm.principal;
      const existing = map.get(groupName);
      if (existing) {
        existing.sources.push({ type: 'direct', actions: perm.actions || [] });
      } else {
        map.set(groupName, {
          groupName,
          groupArn: perm.principal,
          sources: [{ type: 'direct', actions: perm.actions || [] }],
        });
      }
    }
  }

  /**
   * All requested users with access to one asset entry: its own permissions
   * plus permissions inherited from every folder containing it
   */
  private resolveEntryAccessUsers(entry: CacheEntry, resolvers: BulkAccessResolvers): Set<string> {
    const usersWithAccess = new Set<string>();
    resolvers.collectPermissionUsers(entry.permissions || [], usersWithAccess);

    // Folder-inherited access (dedupe: a folder can index an asset by both id and arn)
    const containingFolders = new Set<CacheEntry>([
      ...(resolvers.foldersByMemberKey.get(entry.assetId) || []),
      ...(resolvers.foldersByMemberKey.get(entry.arn) || []),
    ]);
    for (const folder of containingFolders) {
      for (const name of resolvers.resolveFolderUsers(folder)) {
        usersWithAccess.add(name);
      }
    }
    return usersWithAccess;
  }

  /**
   * Resolve folder-based access for a single folder permission entry
   */
  private resolveFolderAccess(
    folders: CacheEntry[],
    assetId: string,
    assetArn: string,
    groups: CacheEntry[],
    users: CacheEntry[],
    map: UserAccessMap
  ): void {
    for (const folder of folders) {
      const isMember = folder.metadata?.members?.some(
        (m: any) => m.MemberId === assetId || m.MemberArn === assetArn
      );
      if (!isMember) {
        continue;
      }

      const folderPerms = folder.permissions || [];
      const folderName = (folder.metadata?.fullPath as string) || folder.assetName;

      for (const fp of folderPerms) {
        this.resolveFolderPermission(fp, folderName, groups, users, map);
      }
    }
  }

  /**
   * Resolve folder-based access for groups
   */
  private resolveFolderGroupAccess(
    folders: CacheEntry[],
    assetId: string,
    assetArn: string,
    groups: CacheEntry[],
    map: GroupAccessMap
  ): void {
    for (const folder of folders) {
      const isMember = folder.metadata?.members?.some(
        (m: any) => m.MemberId === assetId || m.MemberArn === assetArn
      );
      if (!isMember) {
        continue;
      }

      const folderPerms = folder.permissions || [];
      const folderName = (folder.metadata?.fullPath as string) || folder.assetName;

      for (const fp of folderPerms) {
        if (fp.principalType !== 'GROUP') {
          continue;
        }
        const group = groups.find((g: CacheEntry) =>
          principalMatchesGroup(fp.principal, g.arn, g.assetName)
        );
        const groupName = group?.assetName || fp.principal.split('/').pop() || fp.principal;
        const existing = map.get(groupName);
        if (existing) {
          existing.sources.push({
            type: 'folder',
            actions: fp.actions || [],
            folderName,
            folderPath: folderName,
          });
        } else {
          map.set(groupName, {
            groupName,
            groupArn: group?.arn || fp.principal,
            sources: [
              {
                type: 'folder',
                actions: fp.actions || [],
                folderName,
                folderPath: folderName,
              },
            ],
          });
        }
      }
    }
  }

  /**
   * Resolve a single folder permission entry (user or group) into user access sources
   */
  private resolveFolderPermission(
    fp: any,
    folderName: string,
    groups: CacheEntry[],
    users: CacheEntry[],
    map: UserAccessMap
  ): void {
    if (fp.principalType === 'USER') {
      const userEntry = users.find((u: CacheEntry) =>
        principalMatchesUser(fp.principal, u.arn, u.assetName)
      );
      const userName = userEntry?.assetName || fp.principal.split('/').pop() || fp.principal;
      const info = this.ensureUser(map, userName, userEntry?.arn || fp.principal);
      info.sources.push({
        type: 'folder',
        actions: fp.actions || [],
        folderName,
        folderPath: folderName,
      });
    } else if (fp.principalType === 'GROUP') {
      this.resolveGroupMembersForFolder(fp, folderName, groups, users, map);
    }
  }

  /**
   * Resolve group access - for each GROUP permission, expand to member users
   */
  private resolveGroupAccess(
    permissions: any[],
    groups: CacheEntry[],
    users: CacheEntry[],
    map: UserAccessMap
  ): void {
    for (const perm of permissions) {
      if (perm.principalType !== 'GROUP') {
        continue;
      }

      const group = groups.find((g: CacheEntry) =>
        principalMatchesGroup(perm.principal, g.arn, g.assetName)
      );
      if (!group?.metadata?.members) {
        continue;
      }

      for (const member of group.metadata.members as any[]) {
        const memberName = member.memberName || member.userName;
        if (!memberName) {
          continue;
        }
        const userArn = this.findUserArn(users, memberName);
        const info = this.ensureUser(map, memberName, userArn);
        info.sources.push({
          type: 'group',
          actions: perm.actions || [],
          groupName: group.assetName,
        });
      }
    }
  }

  /**
   * Resolve group members for a folder-level group permission
   */
  private resolveGroupMembersForFolder(
    fp: any,
    folderName: string,
    groups: CacheEntry[],
    users: CacheEntry[],
    map: UserAccessMap
  ): void {
    const folderGroup = groups.find((g: CacheEntry) =>
      principalMatchesGroup(fp.principal, g.arn, g.assetName)
    );
    if (!folderGroup?.metadata?.members) {
      return;
    }

    for (const member of folderGroup.metadata.members as any[]) {
      const memberName = member.memberName || member.userName;
      if (!memberName) {
        continue;
      }
      const userArn = this.findUserArn(users, memberName);
      const info = this.ensureUser(map, memberName, userArn);
      info.sources.push({
        type: 'folder',
        actions: fp.actions || [],
        folderName,
        folderPath: folderName,
        groupName: folderGroup.assetName,
      });
    }
  }

  /**
   * One pass over active dashboards/datasets/analyses/datasources: attribute
   * each asset to groups with direct permission or folder-inherited access.
   */
  private scanAssetsForGroupCounts(
    cache: MasterCache,
    resolveGroupPrincipal: (principal: string | undefined) => Set<string>,
    groupsByFolderArn: Map<string, Set<string>>,
    countedByGroup: Map<string, Set<string>>
  ): void {
    const foldersByMemberKey = this.buildFoldersByMemberKey(cache.entries.folder || []);
    const assetTypesToCheck: AssetType[] = ['dashboard', 'dataset', 'analysis', 'datasource'];

    for (const type of assetTypesToCheck) {
      for (const entry of cache.entries[type] || []) {
        if (entry.status !== 'active') {
          continue;
        }
        // Direct permissions (legacy: no principalType filter)
        for (const perm of (entry.permissions as any[]) || []) {
          for (const name of resolveGroupPrincipal(perm.principal)) {
            countedByGroup.get(name)?.add(entry.assetId);
          }
        }
        // Folder-inherited access via containing folders
        const containingFolders = new Set<CacheEntry>([
          ...(foldersByMemberKey.get(entry.assetId) || []),
          ...(foldersByMemberKey.get(entry.arn) || []),
        ]);
        for (const folder of containingFolders) {
          const groupNames = groupsByFolderArn.get(folder.arn);
          for (const name of groupNames || []) {
            countedByGroup.get(name)?.add(entry.assetId);
          }
        }
      }
    }
  }

  /**
   * Transform QuickSight permissions to our format
   */
  private transformPermissions(permissions: any[]): AssetPermission[] {
    return permissions.map((permission) => ({
      principal: permission.Principal || permission.principal || '',
      principalType: this.determinePrincipalType(
        permission.Principal || permission.principal || ''
      ),
      actions: permission.Actions || permission.actions || [],
    }));
  }
}
