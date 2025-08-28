import type { components } from '@shared/generated/types';

import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { S3Service } from '../../../shared/services/aws/S3Service';
import { type FolderMetadata } from '../types';
import { TagService } from './TagService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { ASSET_TYPES, type AssetType } from '../../../shared/types/assetTypes';
import { mapFolderFromCache } from '../../../shared/utils/assetMapping';
import { logger } from '../../../shared/utils/logger';

// Use shared API types for consistency

type FolderListItem = components['schemas']['FolderListItem'];
type FolderDetails = components['schemas']['FolderDetails'];
type FolderMember = components['schemas']['FolderMember'];

// QuickSight's member types for folder members (uppercase)
type QuickSightMemberType = 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE' | 'USER' | 'GROUP';
type QuickSightAssetMemberType = 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE';
type QuickSightPrincipalMemberType = 'USER' | 'GROUP';

// Member roles for folder permissions
type FolderMemberRole = 'ADMIN' | 'AUTHOR' | 'VIEWER';

// Mapping from QuickSight member types to our internal asset types
const MEMBER_TYPE_TO_ASSET_TYPE: Record<QuickSightAssetMemberType, AssetType> = {
  DASHBOARD: ASSET_TYPES.dashboard,
  ANALYSIS: ASSET_TYPES.analysis,
  DATASET: ASSET_TYPES.dataset,
  DATASOURCE: ASSET_TYPES.datasource,
} as const;

// List of QuickSight member types that represent assets (not principals)
const ASSET_MEMBER_TYPES: QuickSightAssetMemberType[] = [
  'DASHBOARD',
  'ANALYSIS',
  'DATASET',
  'DATASOURCE',
];

/**
 * FolderService manages QuickSight folders and their members.
 *
 * Key concepts:
 * - Asset Types: Our internal singular types (dashboard, analysis, dataset, datasource)
 * - Member Types: QuickSight's uppercase types for folder members (DASHBOARD, ANALYSIS, etc.)
 * - Principal Types: USER and GROUP members who have permissions on folders
 * - Member Roles: Permission levels for principals (ADMIN, AUTHOR, VIEWER)
 */
export class FolderService {
  private readonly bucketName: string;
  private readonly folderMetadataCache: Map<string, FolderMetadata> = new Map();
  private readonly quickSightService: QuickSightService;
  private readonly s3Service: S3Service;
  private readonly tagService: TagService;

  constructor(private readonly accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
    this.s3Service = new S3Service(accountId);
    this.tagService = new TagService(accountId);
    this.bucketName = process.env.BUCKET_NAME || '';
  }

  /**
   * Add an asset (dashboard, analysis, dataset, or datasource) to a folder.
   * This organizes the asset within the folder structure.
   * @param memberType QuickSight's uppercase member type (DASHBOARD, ANALYSIS, etc.)
   */
  public async addAssetToFolder(
    folderId: string,
    assetId: string,
    memberType: QuickSightAssetMemberType
  ): Promise<void> {
    try {
      await this.quickSightService.createFolderMembership(folderId, assetId, memberType);
    } catch (error) {
      logger.error('Failed to add asset to folder', { folderId, assetId, memberType, error });
      throw error;
    }
  }

  /**
   * Add a USER or GROUP member to a folder with specific permissions.
   * This grants the principal access to the folder, not adding assets to the folder.
   */
  public async addMember(
    folderId: string,
    memberId: string,
    memberType: QuickSightPrincipalMemberType,
    role: FolderMemberRole
  ): Promise<void> {
    try {
      const principal =
        memberType === 'USER'
          ? `arn:aws:quicksight:${process.env.AWS_REGION}:${this.accountId}:user/default/${memberId}`
          : `arn:aws:quicksight:${process.env.AWS_REGION}:${this.accountId}:group/default/${memberId}`;

      const actions = this.mapRoleToActions(role);

      await this.quickSightService.updateFolderPermissions(
        folderId,
        [{ Principal: principal, Actions: actions }],
        []
      );
    } catch (error) {
      logger.error('Failed to add folder member', { folderId, memberId, error });
      throw error;
    }
  }

  public async get(folderId: string): Promise<FolderDetails> {
    try {
      const folders = await cacheService.getCacheEntries({
        assetType: 'folder',
        statusFilter: AssetStatusFilter.ALL,
      });
      const cachedFolder = folders.find((f: any) => f.assetId === folderId);

      if (!cachedFolder) {
        throw new Error(`Folder ${folderId} not found in cache`);
      }

      // Use DRY mapping utility
      return mapFolderFromCache(cachedFolder);
    } catch (error) {
      logger.error('Failed to get folder', { folderId, error });
      throw error;
    }
  }

  public async getExcludedAssets(excludeTag: string): Promise<Set<string>> {
    const excludedAssets = new Set<string>();

    try {
      const folders = await this.quickSightService.listFolders();

      // Get tags for each folder
      for (const folder of folders) {
        if (!folder.folderId) {
          continue;
        }

        try {
          const tags = await this.tagService.getResourceTags(ASSET_TYPES.folder, folder.folderId);

          // Check if folder has the exclude tag
          const hasExcludeTag = tags.some(
            (tag) => tag.key === excludeTag || tag.value === excludeTag
          );

          if (hasExcludeTag) {
            // Get all members of this folder
            const members = await this.quickSightService.listFolderMembers(folder.folderId);

            for (const member of members) {
              if (
                member.MemberId &&
                ASSET_MEMBER_TYPES.includes(member.MemberType as QuickSightAssetMemberType)
              ) {
                excludedAssets.add(member.MemberId);
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to process folder ${folder.folderId} for exclusions:`, error);
        }
      }

      logger.info(`Found ${excludedAssets.size} assets excluded with tag: ${excludeTag}`);
      return excludedAssets;
    } catch (error) {
      logger.error('Failed to get excluded assets:', error);
      return excludedAssets;
    }
  }

  public async getExcludedAssetsForAllTags(tags: string[]): Promise<Map<string, Set<string>>> {
    const result = new Map<string, Set<string>>();

    for (const tag of tags) {
      const excludedAssets = await this.getExcludedAssets(tag);
      result.set(tag, excludedAssets);
    }

    return result;
  }

  /**
   * Get all asset members of a folder (dashboards, analyses, datasets, datasources).
   * This excludes USER and GROUP members who have permissions on the folder.
   */
  public async getMembers(folderId: string): Promise<FolderMember[]> {
    try {
      const members = await this.quickSightService.listFolderMembers(folderId);

      // Map members and infer type from ARN if MemberType is missing
      const mappedMembers = members.map((member: any) => {
        let memberType = member.MemberType as QuickSightMemberType | undefined;

        // If MemberType is missing, infer from ARN
        if (!memberType && member.MemberArn) {
          memberType = this.inferMemberTypeFromArn(member.MemberArn);
        }

        return {
          ...member,
          MemberType: memberType,
        };
      });

      // Filter to only show asset members (not users/groups with permissions)
      const assetMembers = mappedMembers.filter((member: any) =>
        ASSET_MEMBER_TYPES.includes(member.MemberType as QuickSightAssetMemberType)
      );

      // Get master cache once for all lookups (exclude archived so we don't show archived members)
      const masterCache = await cacheService.getMasterCache({
        statusFilter: AssetStatusFilter.ACTIVE,
      });

      // Enrich members with asset names from cache
      const enrichedMembers = await Promise.all(
        assetMembers.map((member: any) => {
          try {
            // Map QuickSight member types to our asset types
            const assetType =
              MEMBER_TYPE_TO_ASSET_TYPE[member.MemberType as QuickSightAssetMemberType];

            if (!assetType) {
              logger.warn(`Unknown member type: ${member.MemberType}`);
              return member;
            }

            // Look up asset directly in master cache
            const assets = masterCache.entries[assetType as keyof typeof masterCache.entries];
            const cachedAsset = assets?.find((a: any) => a.assetId === member.MemberId);

            return {
              ...member,
              MemberName: cachedAsset?.assetName || `Unknown ${member.MemberType.toLowerCase()}`,
            };
          } catch (error) {
            logger.warn(`Failed to enrich member ${member.MemberId}:`, error);
            return {
              ...member,
              MemberName: `Unknown ${member.MemberType.toLowerCase()}`,
            };
          }
        })
      );

      // Return in the format expected by the frontend (typed as FolderMember[])
      return enrichedMembers
        .filter((member: any) => member.MemberId && member.MemberType)
        .map(
          (member: any): FolderMember => ({
            MemberId: member.MemberId,
            MemberType: member.MemberType as FolderMember['MemberType'],
            MemberName: member.MemberName || `Unknown ${member.MemberType.toLowerCase()}`,
          })
        );
    } catch (error) {
      logger.error('Failed to get folder members', { folderId, error });
      throw error;
    }
  }

  // Additional methods from old folders.service
  public async getMetadata(folderId: string): Promise<FolderMetadata> {
    const cached = this.folderMetadataCache.get(folderId);
    if (cached) {
      return await Promise.resolve(cached);
    }

    // In a real implementation, this would fetch from S3 or a database
    // For now, return empty metadata
    const metadata: FolderMetadata = {};
    this.folderMetadataCache.set(folderId, metadata);
    return await Promise.resolve(metadata);
  }

  public async list(): Promise<FolderListItem[]> {
    try {
      // Use cache with archived folders filtered out
      const masterCache = await cacheService.getMasterCache({
        statusFilter: AssetStatusFilter.ACTIVE,
      });
      const cachedFolders = masterCache.entries.folder || [];

      // Map cache entries to folder interface
      return cachedFolders.map((folder: any) => mapFolderFromCache(folder));
    } catch (error) {
      logger.error('Failed to list folders', { error });
      throw error;
    }
  }

  /**
   * Remove an asset (dashboard, analysis, dataset, or datasource) from a folder.
   * This removes the asset from the folder structure.
   * @param memberType QuickSight's uppercase member type (DASHBOARD, ANALYSIS, etc.)
   */
  public async removeAssetFromFolder(
    folderId: string,
    assetId: string,
    memberType: QuickSightAssetMemberType
  ): Promise<void> {
    try {
      // Remove the asset from the folder in QuickSight
      await this.quickSightService.deleteFolderMembership(folderId, assetId, memberType);

      // Update the cache to reflect the removal
      await this.updateFolderMembershipInCache(folderId, assetId, memberType, 'remove');

      // Clear memory cache to force refresh on frontend
      await cacheService.clearMemoryCache();

      logger.info(`Removed asset ${assetId} (${memberType}) from folder ${folderId}`);
    } catch (error) {
      logger.error('Failed to remove asset from folder', { folderId, assetId, memberType, error });
      throw error;
    }
  }

  /**
   * Remove a USER or GROUP member from a folder.
   * This revokes the principal's access to the folder.
   */
  public async removeMember(
    folderId: string,
    memberId: string,
    memberType: QuickSightPrincipalMemberType
  ): Promise<void> {
    try {
      const principal =
        memberType === 'USER'
          ? `arn:aws:quicksight:${process.env.AWS_REGION}:${this.accountId}:user/default/${memberId}`
          : `arn:aws:quicksight:${process.env.AWS_REGION}:${this.accountId}:group/default/${memberId}`;

      await this.quickSightService.updateFolderPermissions(
        folderId,
        [],
        [{ Principal: principal, Actions: [] }]
      );
    } catch (error) {
      logger.error('Failed to remove folder member', { folderId, memberId, error });
      throw error;
    }
  }

  public async updateMetadata(folderId: string, metadata: FolderMetadata): Promise<FolderMetadata> {
    const existing = await this.getMetadata(folderId);
    const updated = { ...existing, ...metadata };

    this.folderMetadataCache.set(folderId, updated);

    // In a real implementation, this would save to S3 or a database
    logger.info(`Updated metadata for folder ${folderId}`, { metadata: updated });

    return updated;
  }

  private inferMemberTypeFromArn(arn: string): QuickSightMemberType | undefined {
    if (arn.includes(':dashboard/')) {
      return 'DASHBOARD';
    }
    if (arn.includes(':analysis/')) {
      return 'ANALYSIS';
    }
    if (arn.includes(':dataset/')) {
      return 'DATASET';
    }
    if (arn.includes(':datasource/')) {
      return 'DATASOURCE';
    }
    if (arn.includes(':user/')) {
      return 'USER';
    }
    if (arn.includes(':group/')) {
      return 'GROUP';
    }
    return undefined;
  }

  private mapRoleToActions(role: FolderMemberRole): string[] {
    switch (role) {
      case 'ADMIN':
        return [
          'quicksight:CreateFolder',
          'quicksight:DescribeFolder',
          'quicksight:UpdateFolder',
          'quicksight:DeleteFolder',
          'quicksight:CreateFolderMembership',
          'quicksight:DeleteFolderMembership',
          'quicksight:DescribeFolderPermissions',
          'quicksight:UpdateFolderPermissions',
        ];
      case 'AUTHOR':
        return [
          'quicksight:DescribeFolder',
          'quicksight:CreateAnalysis',
          'quicksight:CreateDashboard',
        ];
      case 'VIEWER':
        return ['quicksight:DescribeFolder'];
    }
  }

  /**
   * Update folder membership in cache and exported JSON
   */
  private async updateFolderMembershipInCache(
    folderId: string,
    assetId: string,
    memberType: QuickSightAssetMemberType,
    action: 'add' | 'remove'
  ): Promise<void> {
    try {
      // Get the folder from cache
      const folders = await cacheService.getCacheEntries({
        assetType: 'folder',
        statusFilter: AssetStatusFilter.ALL,
      });
      const folder = folders.find((f: any) => f.assetId === folderId);

      if (!folder) {
        logger.warn(`Folder ${folderId} not found in cache during membership update`);
        return;
      }

      // Update the folder's member count - members are in SDK format (PascalCase)
      const currentMembers: any[] = folder.metadata?.members || [];
      let updatedMembers: any[] = [...currentMembers];

      if (action === 'remove') {
        updatedMembers = updatedMembers.filter((m: any) => m.MemberId !== assetId);
      } else {
        // For add action (if we implement it later)
        const memberArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${this.accountId}:${memberType.toLowerCase()}/${assetId}`;
        updatedMembers.push({
          MemberId: assetId,
          MemberArn: memberArn,
          MemberType: memberType,
        });
      }

      // Update the folder in cache
      await cacheService.updateAsset(ASSET_TYPES.folder, folderId, {
        metadata: {
          ...folder.metadata,
          members: updatedMembers,
          memberCount: updatedMembers.length,
        },
        lastUpdatedTime: new Date(),
      });

      // Also update the exported JSON file
      const exportPath = 'assets/folders/' + folderId + '.json';
      try {
        const exportData = await this.s3Service.getObject(this.bucketName, exportPath);
        if (exportData && exportData.apiResponses?.listMembers) {
          exportData.apiResponses.listMembers = {
            timestamp: new Date().toISOString(),
            data: updatedMembers,
          };
          await this.s3Service.putObject(this.bucketName, exportPath, exportData);
        }
      } catch (error) {
        logger.warn(`Failed to update exported JSON for folder ${folderId}`, { error });
      }
    } catch (error) {
      logger.error('Failed to update folder membership in cache', { folderId, assetId, error });
      // Don't throw here - cache update failure shouldn't fail the whole operation
    }
  }
}
