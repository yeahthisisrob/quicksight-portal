import { DEBUG_CONFIG } from '../../../shared/constants';
import {
  type ApiResponse,
  type AssetExportData,
  type GroupDescribeData,
  type GroupListData,
} from '../../../shared/models/asset-export.model';
import { type CacheEntry } from '../../../shared/models/asset.model';
import { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { S3Service } from '../../../shared/services/aws/S3Service';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { ASSET_TYPES, getPluralForm, type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { principalMatchesGroup } from '../../../shared/utils/quicksightUtils';

/**
 * Parameters for updating group in export file
 */
interface GroupUpdateParams {
  groupName: string;
  description?: string;
  arn?: string;
  principalId?: string;
  action: 'create' | 'update' | 'delete';
}

/**
 * Asset access information
 */
interface AssetAccessInfo {
  assetId: string;
  assetType: string;
  assetName: string;
  arn: string;
  accessType: 'direct' | 'folder_inherited';
  permissions?: string[];
  folderPath?: string;
}

export class GroupService {
  private readonly bucketName: string;
  private readonly quickSightService: QuickSightService;
  private readonly s3Service: S3Service;

  constructor() {
    const awsAccountId = process.env.AWS_ACCOUNT_ID || '';
    this.quickSightService = new QuickSightService(awsAccountId);
    this.s3Service = new S3Service(awsAccountId);
    this.bucketName = process.env.BUCKET_NAME || '';
  }

  public async createGroup(
    groupName: string,
    description?: string
  ): Promise<{ success: boolean; group?: any; error?: string }> {
    try {
      // Create group in QuickSight
      const result = await this.quickSightService.createGroup({
        groupName,
        description,
      });

      logger.info(`Created group ${groupName} in QuickSight`);

      // Update the export JSON file
      await this.updateGroupInExportFile({
        groupName,
        description,
        arn: result.arn,
        principalId: result.principalId,
        action: 'create',
      });

      // Update cache
      await this.updateGroupInCache({
        groupName,
        description,
        arn: result.arn,
        principalId: result.principalId,
        createdTime: new Date(),
        action: 'create',
      });

      return {
        success: true,
        group: {
          groupName,
          description,
          arn: result.arn,
          principalId: result.principalId,
        },
      };
    } catch (error: any) {
      logger.error(`Failed to create group ${groupName}:`, error);
      throw error;
    }
  }

  public async deleteGroup(
    groupName: string,
    reason?: string,
    deletedBy?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // First get the group details for archiving
      const groupDetails = await this.quickSightService.describeGroup(groupName);

      // Delete group in QuickSight
      await this.quickSightService.deleteGroup(groupName);

      logger.info(`Deleted group ${groupName} from QuickSight`);

      // Archive the group in export JSON
      await this.archiveGroupInExportFile({
        groupName,
        groupDetails: groupDetails.Group,
        reason,
        deletedBy,
      });

      // Update cache - mark as archived
      await this.updateGroupInCache({
        groupName,
        action: 'delete',
        status: 'archived',
        reason,
        deletedBy,
      });

      return {
        success: true,
        message: `Group ${groupName} deleted and archived successfully`,
      };
    } catch (error: any) {
      logger.error(`Failed to delete group ${groupName}:`, error);
      throw error;
    }
  }

  public async getGroupAssets(
    groupName: string,
    assetType?: string
  ): Promise<{
    groupName: string;
    totalAssets: number;
    assetsByType: Record<string, number>;
    assets: Array<{
      assetId: string;
      assetType: string;
      assetName: string;
      arn: string;
      accessType: 'direct' | 'folder_inherited';
      folderPath?: string;
      permissions?: string[];
    }>;
  }> {
    try {
      const cache = await cacheService.getMasterCache();
      const group = cache.entries.group?.find((g: CacheEntry) => g.assetName === groupName);

      logger.debug(`Looking for group ${groupName}`, {
        found: !!group,
        groupArn: group?.arn,
        totalGroups: cache.entries.group?.length,
      });

      if (!group) {
        throw new Error(`Group ${groupName} not found`);
      }

      const assetTypesToCheck = assetType
        ? [assetType]
        : ['dashboard', 'dataset', 'analysis', 'datasource', 'folder'];

      const result = this.collectGroupAssets(group, cache, assetTypesToCheck);

      logger.debug(`Group assets collected for ${groupName}`, {
        totalAssets: result.assets.length,
        assetsByType: result.assetsByType,
        sampleAssets: result.assets.slice(0, DEBUG_CONFIG.SAMPLE_ENTRIES_TO_LOG).map((a) => ({
          name: a.assetName,
          type: a.assetType,
          access: a.accessType,
        })),
      });

      return {
        groupName,
        totalAssets: result.assets.length,
        assetsByType: result.assetsByType,
        assets: result.assets,
      };
    } catch (error) {
      logger.error(`Failed to get assets for group ${groupName}:`, error);
      throw error;
    }
  }

  /**
   * Get all assets that a group has access to
   */
  public async getUserGroups(userId: string): Promise<Array<{ groupName: string; arn: string }>> {
    try {
      const cache = await cacheService.getMasterCache();
      const groups = cache.entries.group || [];

      const userGroups = groups.filter((group: CacheEntry) => {
        const members = group.metadata?.members || [];
        return members.some(
          (member: any) =>
            // Use camelCase for internal domain model
            member.memberName === userId ||
            member.userName === userId ||
            member.principalId === userId
        );
      });

      return userGroups.map((group: CacheEntry) => ({
        groupName: group.assetName,
        arn: group.arn,
      }));
    } catch (error) {
      logger.error(`Failed to get groups for user ${userId}:`, error);
      return [];
    }
  }

  public async updateGroup(
    groupName: string,
    description: string
  ): Promise<{ success: boolean; group: { groupName: string; description: string } }> {
    try {
      // Update group in QuickSight
      await this.quickSightService.updateGroup({
        groupName,
        description,
      });

      logger.info(`Updated group ${groupName} in QuickSight`);

      // Update the export JSON file
      await this.updateGroupInExportFile({
        groupName,
        description,
        action: 'update',
      });

      // Update cache
      await this.updateGroupInCache({
        groupName,
        description,
        lastUpdatedTime: new Date(),
        action: 'update',
      });

      return {
        success: true,
        group: {
          groupName,
          description,
        },
      };
    } catch (error: any) {
      logger.error(`Failed to update group ${groupName}:`, error);
      throw error;
    }
  }

  private async archiveGroupInExportFile(params: {
    groupName: string;
    groupDetails: any;
    reason?: string;
    deletedBy?: string;
  }): Promise<void> {
    try {
      // Remove from active groups
      const exportPath = 'assets/organization/groups.json';
      const groupsData = await this.loadGroupsData();

      const groupData = groupsData[params.groupName];
      if (groupData) {
        delete groupsData[params.groupName];
        await this.s3Service.putObject(this.bucketName, exportPath, groupsData);
      }

      // Add to archived groups
      const archivePath = 'archived/organization/groups.json';
      let archivedData: Record<string, AssetExportData> = {};

      try {
        archivedData = (await this.s3Service.getObject(this.bucketName, archivePath)) || {};
      } catch (_error) {
        archivedData = {};
      }

      archivedData[params.groupName] = {
        ...groupData,
        archivedMetadata: {
          archivedAt: new Date().toISOString(),
          archivedBy: params.deletedBy || 'system',
          archiveReason: params.reason || 'Deleted by user',
        },
      } as AssetExportData;

      await this.s3Service.putObject(this.bucketName, archivePath, archivedData);
      logger.info(`Archived group ${params.groupName}`);
    } catch (error) {
      logger.error(`Failed to archive group:`, error);
      throw error;
    }
  }

  /**
   * Build the describe API response for a group
   */
  private buildGroupDescribeResponse(
    params: GroupUpdateParams,
    existingData?: AssetExportData
  ): ApiResponse<GroupDescribeData> {
    const existing = existingData?.apiResponses?.describe?.data as GroupDescribeData | undefined;

    return {
      timestamp: new Date().toISOString(),
      data: {
        Group: {
          GroupName: params.groupName,
          Description: params.description ?? existing?.Group?.Description ?? '',
          Arn: params.arn ?? existing?.Group?.Arn,
          PrincipalId: params.principalId ?? existing?.Group?.PrincipalId,
        },
      } as GroupDescribeData,
    };
  }

  /**
   * Build the list API response for a group
   */
  private buildGroupListResponse(
    params: GroupUpdateParams,
    existingData?: AssetExportData
  ): ApiResponse<GroupListData> {
    const existing = existingData?.apiResponses?.list?.data as GroupListData | undefined;

    return {
      timestamp: new Date().toISOString(),
      data: {
        GroupName: params.groupName,
        Description: params.description ?? existing?.Description ?? '',
        Arn: params.arn ?? existing?.Arn,
        PrincipalId: params.principalId ?? existing?.PrincipalId,
      } as GroupListData,
    };
  }

  /**
   * Check if group has direct access to an asset
   */
  private checkDirectAccess(
    entry: any,
    groupArn: string,
    groupName: string
  ): {
    hasAccess: boolean;
    accessType: 'direct' | 'folder_inherited';
    permissions: string[];
  } {
    const groupPermission = entry.permissions?.find((p: any) =>
      principalMatchesGroup(p.principal, groupArn, groupName)
    );

    return {
      hasAccess: !!groupPermission,
      accessType: 'direct',
      permissions: groupPermission?.actions || [],
    };
  }

  // Removed checkFolderInheritance method as it's no longer used

  // Removed checkGroupAccess method as it's no longer used

  /**
   * Check if asset is member of accessible folders
   */
  private checkFolderMembership(
    entry: CacheEntry,
    type: string,
    accessibleFolders: Array<{ folder: CacheEntry; permissions: string[] }>,
    assets: AssetAccessInfo[],
    assetsByType: Record<string, number>,
    addedAssetIds: Set<string>
  ): void {
    for (const { folder, permissions } of accessibleFolders) {
      const isMember = folder.metadata?.members?.some(
        (member: any) => member.MemberId === entry.assetId || member.MemberArn === entry.arn
      );

      if (isMember && !addedAssetIds.has(entry.assetId)) {
        assets.push(
          this.createAssetAccessInfo(
            entry,
            type,
            'folder_inherited',
            permissions,
            (folder.metadata?.fullPath as string) || folder.assetName
          )
        );
        this.incrementAssetCount(type, assetsByType);
        addedAssetIds.add(entry.assetId);
        break; // Asset found in a folder, no need to check other folders
      }
    }
  }

  /**
   * Collect all assets accessible by a group
   */
  private collectGroupAssets(
    group: CacheEntry,
    cache: any,
    assetTypesToCheck: string[]
  ): {
    assets: AssetAccessInfo[];
    assetsByType: Record<string, number>;
  } {
    const assets: AssetAccessInfo[] = [];
    const assetsByType: Record<string, number> = {
      dashboards: 0,
      datasets: 0,
      analyses: 0,
      datasources: 0,
      folders: 0,
    };
    const addedAssetIds = new Set<string>();

    // Find accessible folders
    const accessibleFolders = this.findAccessibleFolders(group, cache);

    // Process each asset type
    const context = {
      cache,
      group,
      accessibleFolders,
      assets,
      assetsByType,
      addedAssetIds,
    };

    for (const type of assetTypesToCheck) {
      this.processAssetType(type, context);
    }

    return { assets, assetsByType };
  }

  /**
   * Asset access info type
   */
  private createAssetAccessInfo(
    entry: CacheEntry,
    type: string,
    accessType: 'direct' | 'folder_inherited',
    permissions?: string[],
    folderPath?: string
  ): AssetAccessInfo {
    return {
      assetId: entry.assetId,
      assetType: type,
      assetName: entry.assetName,
      arn: entry.arn,
      accessType,
      permissions,
      folderPath,
    };
  }

  /**
   * Find folders accessible by a group
   */
  private findAccessibleFolders(
    group: CacheEntry,
    cache: any
  ): Array<{ folder: CacheEntry; permissions: string[] }> {
    const accessibleFolders: Array<{ folder: CacheEntry; permissions: string[] }> = [];
    const folders = cache.entries.folder || [];
    const groupArn = group.arn;
    const groupName = group.assetName;

    for (const folder of folders) {
      const folderPermission = folder.permissions?.find((p: any) =>
        principalMatchesGroup(p.principal, groupArn, groupName)
      );

      if (folderPermission) {
        accessibleFolders.push({
          folder,
          permissions: folderPermission.actions || [],
        });
      }
    }

    return accessibleFolders;
  }

  /**
   * Increment asset count by type
   */
  private incrementAssetCount(type: string, assetsByType: Record<string, number>): void {
    const typeKey = getPluralForm(type as AssetType);
    if (typeKey in assetsByType && assetsByType[typeKey] !== undefined) {
      assetsByType[typeKey]++;
    }
  }

  /**
   * Load existing groups data from S3
   */
  private async loadGroupsData(): Promise<Record<string, AssetExportData>> {
    const exportPath = 'assets/organization/groups.json';
    try {
      return (await this.s3Service.getObject(this.bucketName, exportPath)) || {};
    } catch (_error) {
      // File doesn't exist yet, start with empty
      return {};
    }
  }

  /**
   * Process a single asset type for group access
   */
  private processAssetType(
    type: string,
    context: {
      cache: any;
      group: CacheEntry;
      accessibleFolders: Array<{ folder: CacheEntry; permissions: string[] }>;
      assets: AssetAccessInfo[];
      assetsByType: Record<string, number>;
      addedAssetIds: Set<string>;
    }
  ): void {
    const { cache, group, accessibleFolders, assets, assetsByType, addedAssetIds } = context;
    const entries = cache.entries[type as keyof typeof cache.entries] || [];
    const groupArn = group.arn;
    const groupName = group.assetName;

    for (const entry of entries) {
      if (entry.status !== 'active') {
        continue;
      }

      // Check direct access
      const directAccess = this.checkDirectAccess(entry, groupArn, groupName);
      if (directAccess.hasAccess && !addedAssetIds.has(entry.assetId)) {
        assets.push(
          this.createAssetAccessInfo(entry, type, directAccess.accessType, directAccess.permissions)
        );
        this.incrementAssetCount(type, assetsByType);
        addedAssetIds.add(entry.assetId);
        continue;
      }

      // Check folder membership
      this.checkFolderMembership(
        entry,
        type,
        accessibleFolders,
        assets,
        assetsByType,
        addedAssetIds
      );
    }
  }

  private async updateGroupInCache(params: {
    groupName: string;
    description?: string;
    arn?: string;
    principalId?: string;
    createdTime?: Date;
    lastUpdatedTime?: Date;
    status?: 'active' | 'archived';
    action: 'create' | 'update' | 'delete';
    reason?: string;
    deletedBy?: string;
  }): Promise<void> {
    try {
      if (params.action === 'delete') {
        // For delete, mark as archived in cache
        await cacheService.updateAsset(ASSET_TYPES.group, params.groupName, {
          status: 'archived',
          lastUpdatedTime: new Date(),
        });
      } else if (params.action === 'create') {
        // For create, add new entry
        const cacheEntry: Partial<CacheEntry> = {
          assetId: params.groupName,
          assetName: params.groupName,
          assetType: ASSET_TYPES.group,
          arn: params.arn || '',
          status: 'active',
          createdTime: params.createdTime || new Date(),
          lastUpdatedTime: params.createdTime || new Date(),
          exportedAt: new Date(),
          enrichmentStatus: 'enriched',
          tags: [],
          permissions: [],
          metadata: {
            description: params.description || '',
            principalId: params.principalId || '',
            memberCount: 0,
          },
          exportFilePath: 'assets/organization/groups.json',
          storageType: 'collection',
        };
        await cacheService.updateAsset(ASSET_TYPES.group, params.groupName, cacheEntry);
      } else {
        // For update, just update description
        await cacheService.updateAsset(ASSET_TYPES.group, params.groupName, {
          lastUpdatedTime: params.lastUpdatedTime || new Date(),
          metadata: {
            description: params.description,
          },
        });
      }

      // Clear memory cache to force refresh
      await cacheService.clearMemoryCache();

      logger.info(`Updated group ${params.groupName} in cache`);
    } catch (error) {
      logger.error(`Failed to update group in cache:`, error);
      throw error;
    }
  }

  private async updateGroupInExportFile(params: GroupUpdateParams): Promise<void> {
    try {
      const exportPath = 'assets/organization/groups.json';

      // Get existing groups collection
      const groupsData = await this.loadGroupsData();

      if (params.action === 'create' || params.action === 'update') {
        // Get existing group data or create new
        const existingGroup = groupsData[params.groupName];

        // Update the group data using helper methods
        groupsData[params.groupName] = {
          ...existingGroup,
          apiResponses: {
            ...existingGroup?.apiResponses,
            list: this.buildGroupListResponse(params, existingGroup),
            describe: this.buildGroupDescribeResponse(params, existingGroup),
          },
        } as AssetExportData;
      }

      // Save updated collection
      await this.s3Service.putObject(this.bucketName, exportPath, groupsData);
      logger.info(`Updated group ${params.groupName} in export file`);
    } catch (error) {
      logger.error(`Failed to update group in export file:`, error);
      throw error;
    }
  }
}
