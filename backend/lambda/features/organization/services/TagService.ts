import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type Tag } from '../types';

export class TagService {
  private readonly awsRegion: string;
  private readonly quickSightService: QuickSightService;

  constructor(awsAccountId: string) {
    this.awsRegion = process.env.AWS_REGION || 'us-east-1';
    this.quickSightService = ClientFactory.getQuickSightService(awsAccountId);
  }

  public async getResourceTags(resourceType: AssetType, resourceId: string): Promise<Tag[]> {
    try {
      return await this.quickSightService.getResourceTags(resourceType, resourceId, this.awsRegion);
    } catch (error: any) {
      if (error.name === 'AccessDeniedException') {
        logger.debug(`No permission to read tags for ${resourceType} ${resourceId}`);
      } else if (error.name === 'ResourceNotFoundException') {
        // This is expected for deleted assets during archive detection
        logger.debug(`Resource not found (likely deleted): ${resourceType} ${resourceId}`);
      } else {
        logger.error(`Error getting tags for ${resourceType} ${resourceId}:`, error);
      }
      return [];
    }
  }

  public async removeResourceTags(
    resourceType: AssetType,
    resourceId: string,
    tagKeys: string[]
  ): Promise<void> {
    try {
      await this.quickSightService.untagResource(resourceType, resourceId, tagKeys, this.awsRegion);
      logger.info(`Successfully removed ${tagKeys.length} tags from ${resourceType} ${resourceId}`);
    } catch (error) {
      logger.error(`Error removing tags from ${resourceType} ${resourceId}:`, error);
      throw error;
    }
  }

  public async tagResource(
    resourceType: AssetType,
    resourceId: string,
    tags: Tag[]
  ): Promise<void> {
    logger.info(`Tagging ${resourceType} ${resourceId} with ${tags.length} tags`);

    try {
      await this.quickSightService.tagResource(resourceType, resourceId, tags, this.awsRegion);
      logger.info(`Successfully tagged ${resourceType} ${resourceId}`);
    } catch (error: any) {
      logger.error(`Error tagging ${resourceType} ${resourceId}:`, error);
      if (error.name === 'AccessDeniedException') {
        throw new Error(
          `No permission to tag ${resourceType}. Please ensure your IAM role has quicksight:TagResource permission.`
        );
      }
      if (error.name === 'InvalidParameterValueException') {
        throw new Error('Invalid tag format. Keys and values must follow AWS tagging rules.');
      }
      throw error;
    }
  }

  public async updateResourceTags(
    resourceType: AssetType,
    resourceId: string,
    tags: Tag[]
  ): Promise<void> {
    const currentTags = await this.getResourceTags(resourceType, resourceId);

    const currentTagKeys = currentTags.map((t) => t.key);
    const newTagKeys = tags.map((t) => t.key);
    const tagsToRemove = currentTagKeys.filter((key) => !newTagKeys.includes(key));

    if (tagsToRemove.length > 0) {
      await this.removeResourceTags(resourceType, resourceId, tagsToRemove);
    }

    if (tags.length > 0) {
      await this.tagResource(resourceType, resourceId, tags);
    }
  }
}
