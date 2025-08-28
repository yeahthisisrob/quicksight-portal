import { OrganizationalProcessor } from './OrganizationalProcessor';
import { type QuickSightService } from '../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../shared/services/parsing/AssetParserService';
import { type TagService } from '../../../organization/services/TagService';
import { type AssetType } from '../../types';

/**
 * Processor for QuickSight Users
 */
export class UserProcessor extends OrganizationalProcessor {
  public readonly assetType: AssetType = 'user';

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

  protected override async executeSpecialOperations(
    _assetId: string
  ): Promise<Record<string, any>> {
    await Promise.resolve();
    return {};
  }

  protected getAssetId(summary: any): string {
    // Use camelCase property from domain model
    return summary.userName || '';
  }

  protected getAssetName(summary: any): string {
    // Use camelCase property from domain model
    return summary.userName || '';
  }

  protected getServicePath(): string {
    return 'users';
  }
}
