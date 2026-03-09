import { type CacheEntry } from '../../../shared/models/asset.model';
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
   * Get asset access counts for all users in a single cache scan.
   * Much more efficient than calling getUserAssetAccess per user.
   */
  public async getBulkUserAssetCounts(userNames: string[]): Promise<Map<string, number>> {
    const cache = await cacheService.getMasterCache();
    const users = cache.entries.user || [];
    const groups = cache.entries.group || [];
    const folders = cache.entries.folder || [];

    // Pre-compute each user's context
    const userContexts = new Map<
      string,
      { userArn: string; userName: string; userGroups: CacheEntry[]; folders: CacheEntry[] }
    >();
    for (const name of userNames) {
      const userEntry = users.find((u: CacheEntry) => u.assetName === name);
      if (userEntry) {
        userContexts.set(name, {
          userArn: userEntry.arn,
          userName: name,
          userGroups: this.findUserGroups(name, groups),
          folders,
        });
      }
    }

    const counts = new Map<string, number>();
    const assetTypesToCheck: AssetType[] = [
      'dashboard',
      'analysis',
      'dataset',
      'datasource',
      'folder',
    ];

    // Single scan: for each asset, check which users have access
    for (const type of assetTypesToCheck) {
      const entries = cache.entries[type] || [];
      for (const entry of entries) {
        for (const [name, ctx] of userContexts) {
          const sources = this.collectUserAccessSources(entry, ctx);
          if (sources.length > 0) {
            counts.set(name, (counts.get(name) || 0) + 1);
          }
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
