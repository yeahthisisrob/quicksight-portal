import { OrganizationalProcessor } from './OrganizationalProcessor';
import { type QuickSightService } from '../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../shared/services/parsing/AssetParserService';
import { logger } from '../../../../shared/utils/logger';
import { type TagService } from '../../../organization/services/TagService';
import { type AssetType } from '../../types';

/**
 * Processor for QuickSight Folders
 * Folders can be exported independently of other organizational assets
 */
export class FolderProcessor extends OrganizationalProcessor {
  public readonly assetType: AssetType = 'folder';

  /**
   * Folders need permissions to track group access
   */
  public override readonly capabilities = {
    hasDefinition: false,
    hasPermissions: true,
    hasTags: false,
    hasSpecialOperations: true,
  };

  constructor(
    quickSightService: QuickSightService,
    s3Service: S3Service,
    tagService: TagService,
    assetParserService: AssetParserService,
    awsAccountId: string,
    maxConcurrency?: number
  ) {
    super(
      quickSightService,
      s3Service,
      tagService,
      assetParserService,
      awsAccountId,
      maxConcurrency
    );
  }

  /**
   * Fetch full folder details including FolderPath
   */
  protected override async executeDescribe(assetId: string): Promise<any> {
    try {
      const folder = await this.quickSightService.describeFolder(assetId);
      return folder || { FolderName: assetId };
    } catch (error) {
      logger.warn(`Failed to describe folder ${assetId}:`, error);
      return { FolderName: assetId };
    }
  }

  /**
   * Fetch folder permissions (overrides parent class which returns empty array)
   */
  protected override async executeGetPermissions(assetId: string): Promise<any[]> {
    try {
      const permissions = await this.quickSightService.describeFolderPermissions(assetId);
      return permissions || [];
    } catch (error) {
      logger.warn(`Failed to get permissions for folder ${assetId}:`, error);
      return [];
    }
  }

  /**
   * Execute special operations - fetch folder members
   */
  protected override async executeSpecialOperations(assetId: string): Promise<Record<string, any>> {
    const specialData: Record<string, any> = {};

    try {
      const members = await this.quickSightService.getAllFolderMembers(assetId);
      specialData.members = members.map((member: any) => {
        if (!member.MemberType && member.MemberArn) {
          member.MemberType = this.inferMemberTypeFromArn(member.MemberArn);
        }
        return member;
      });
    } catch (error) {
      logger.warn(`Failed to get members for folder ${assetId}:`, error);
      specialData.members = [];
    }

    return specialData;
  }

  protected getAssetId(summary: any): string {
    // Use camelCase property from domain model
    return summary.folderId || '';
  }

  protected getAssetName(summary: any): string {
    // Use camelCase property from domain model
    return summary.name || '';
  }

  protected getServicePath(): string {
    return 'folders';
  }

  /**
   * Infer member type from ARN when MemberType is missing from API response
   */
  private inferMemberTypeFromArn(arn: string): string | undefined {
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
}
