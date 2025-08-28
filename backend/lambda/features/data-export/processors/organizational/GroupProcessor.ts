import { OrganizationalProcessor } from './OrganizationalProcessor';
import { type QuickSightService } from '../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../shared/services/parsing/AssetParserService';
import { logger } from '../../../../shared/utils/logger';
import { type TagService } from '../../../organization/services/TagService';
import { type AssetType } from '../../types';

/**
 * Processor for QuickSight Groups
 * Groups should be exported FIRST among organizational assets
 * so that user export can leverage the fresh group cache
 */
export class GroupProcessor extends OrganizationalProcessor {
  public readonly assetType: AssetType = 'group';

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
   * Execute special operations - fetch group members
   */
  protected override async executeSpecialOperations(assetId: string): Promise<Record<string, any>> {
    const specialData: Record<string, any> = {};

    try {
      const members = await this.quickSightService.listGroupMemberships(assetId, 'default');
      // Keep members in SDK format (PascalCase) for exported JSON
      specialData.members = members;
    } catch (error) {
      logger.warn(`Failed to get members for group ${assetId}:`, error);
      specialData.members = [];
    }

    return specialData;
  }

  protected getAssetId(summary: any): string {
    // Use camelCase property from domain model
    return summary.groupName || '';
  }

  protected getAssetName(summary: any): string {
    // Use camelCase property from domain model
    return summary.groupName || '';
  }

  protected getServicePath(): string {
    return 'groups';
  }
}
