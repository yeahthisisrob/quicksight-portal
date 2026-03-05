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
