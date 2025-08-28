import { FIELD_LIMITS } from '../../../shared/constants';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { type S3Service } from '../../../shared/services/aws/S3Service';
import { type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type FieldMetadataEntry, type BulkFieldMetadata } from '../types';

export interface FieldMetadata {
  sourceType: AssetType;
  sourceId: string;
  fieldName: string;
  description?: string;
  businessGlossary?: string;
  tags?: string[];
  category?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  lastUpdated?: Date;
  updatedBy?: string;
}

export interface FieldMetadataUpdate {
  description?: string;
  businessGlossary?: string;
  tags?: string[];
  category?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  updatedBy?: string;
}

export interface BulkFieldMetadataResponse {
  success: boolean;
  totalFields: number;
  updatedFields: number;
  errors: Array<{
    fieldId: string;
    error: string;
  }>;
}

export class FieldMetadataService {
  private readonly bucketName: string;
  private readonly CACHE_TTL = FIELD_LIMITS.CACHE_TTL_MS;
  private cacheTimestamp: number = 0;
  private readonly METADATA_KEY = 'catalog/field-metadata-bulk.json';
  private metadataCache: Map<string, FieldMetadataEntry> | null = null;
  private readonly s3Service: S3Service;

  constructor() {
    this.s3Service = ClientFactory.getS3Service();
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }
    this.bucketName = bucketName;
  }

  // Methods expected by DataCatalogHandler
  public async addFieldTags(
    sourceType: string,
    sourceId: string,
    fieldName: string,
    tags: string[]
  ): Promise<void> {
    const existing = await this.getFieldMetadata(sourceType, sourceId, fieldName);
    const currentTags = existing?.tags || [];
    const updatedTags = [...new Set([...currentTags, ...tags])];

    await this.updateFieldMetadata(sourceType, sourceId, fieldName, {
      tags: updatedTags,
    });
  }

  public async bulkUpdateFieldMetadata(
    updates: Array<{
      sourceType: string;
      sourceId: string;
      fieldName: string;
      updates: FieldMetadataUpdate;
    }>
  ): Promise<BulkFieldMetadataResponse> {
    await this.ensureCacheLoaded();

    const result: BulkFieldMetadataResponse = {
      success: true,
      totalFields: updates.length,
      updatedFields: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        // Validate required fields
        if (!update.sourceType || !update.sourceId || !update.fieldName) {
          throw new Error(
            'Missing required fields: sourceType, sourceId, and fieldName are required'
          );
        }

        const fieldId = this.getFieldId(update.sourceType, update.sourceId, update.fieldName);
        if (!this.metadataCache) {
          throw new Error('Metadata cache not initialized');
        }
        const existing = this.metadataCache.get(fieldId) || {};

        const updated: FieldMetadataEntry = {
          ...existing,
          ...update.updates,
          lastUpdated: new Date().toISOString(),
        };

        this.metadataCache.set(fieldId, updated);
        result.updatedFields++;
      } catch (error) {
        result.errors.push({
          fieldId: this.getFieldId(update.sourceType, update.sourceId, update.fieldName),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    // Save to S3
    if (result.updatedFields > 0) {
      try {
        await this.saveMetadataToS3();
      } catch (error) {
        result.success = false;
        result.errors.push({
          fieldId: 'bulk-save',
          error: `Failed to save to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return result;
  }

  public async clearAllMetadata(): Promise<void> {
    this.metadataCache = new Map();
    await this.saveMetadataToS3();
    logger.info('Cleared all field metadata');
  }

  public async getAllFieldMetadata(filters?: {
    sourceType?: string;
    hasDescription?: boolean;
    hasBusinessGlossary?: boolean;
    sensitivity?: string;
    category?: string;
  }): Promise<FieldMetadata[]> {
    await this.ensureCacheLoaded();

    const allMetadata: FieldMetadata[] = [];

    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }
    for (const [fieldId, metadata] of this.metadataCache.entries()) {
      const parts = fieldId.split('::');
      if (parts.length !== FIELD_LIMITS.FIELD_ID_PARTS) {
        continue; // Skip invalid fieldIds
      }
      const [sourceType, sourceId, fieldName] = parts;

      // Apply filters
      if (filters) {
        if (filters.sourceType && sourceType !== filters.sourceType) {
          continue;
        }
        if (filters.hasDescription && !metadata.description) {
          continue;
        }
        if (filters.hasBusinessGlossary && !metadata.businessGlossary) {
          continue;
        }
        if (filters.sensitivity && metadata.sensitivity !== filters.sensitivity) {
          continue;
        }
        if (filters.category && metadata.category !== filters.category) {
          continue;
        }
      }

      allMetadata.push({
        sourceType: sourceType as any,
        sourceId: sourceId || '',
        fieldName: fieldName || '',
        description: metadata.description,
        businessGlossary: metadata.businessGlossary,
        tags: metadata.tags || [],
        category: metadata.category,
        sensitivity: metadata.sensitivity,
        lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated) : undefined,
        updatedBy: metadata.updatedBy,
      });
    }

    return allMetadata.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
  }

  public async getFieldMetadata(
    sourceType: string,
    sourceId: string,
    fieldName: string
  ): Promise<FieldMetadata | undefined> {
    await this.ensureCacheLoaded();

    const fieldId = this.getFieldId(sourceType, sourceId, fieldName);
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }
    const metadata = this.metadataCache.get(fieldId);

    if (!metadata) {
      return undefined;
    }

    return {
      sourceType: sourceType as any,
      sourceId,
      fieldName,
      description: metadata.description,
      businessGlossary: metadata.businessGlossary,
      tags: metadata.tags || [],
      category: metadata.category,
      sensitivity: metadata.sensitivity,
      lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated) : undefined,
      updatedBy: metadata.updatedBy,
    };
  }

  public async getMetadataStats(): Promise<{
    totalFields: number;
    fieldsWithDescription: number;
    fieldsWithBusinessGlossary: number;
    fieldsByCategory: Record<string, number>;
    fieldsBySensitivity: Record<string, number>;
    lastUpdated?: Date;
  }> {
    await this.ensureCacheLoaded();

    const stats = {
      totalFields: this.metadataCache ? this.metadataCache.size : 0,
      fieldsWithDescription: 0,
      fieldsWithBusinessGlossary: 0,
      fieldsByCategory: {} as Record<string, number>,
      fieldsBySensitivity: {} as Record<string, number>,
      lastUpdated: undefined as Date | undefined,
    };

    let latestUpdate: string | undefined;

    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }
    for (const metadata of this.metadataCache.values()) {
      if (metadata.description) {
        stats.fieldsWithDescription++;
      }
      if (metadata.businessGlossary) {
        stats.fieldsWithBusinessGlossary++;
      }

      if (metadata.category) {
        stats.fieldsByCategory[metadata.category] =
          (stats.fieldsByCategory[metadata.category] || 0) + 1;
      }

      if (metadata.sensitivity) {
        stats.fieldsBySensitivity[metadata.sensitivity] =
          (stats.fieldsBySensitivity[metadata.sensitivity] || 0) + 1;
      }

      if (metadata.lastUpdated && (!latestUpdate || metadata.lastUpdated > latestUpdate)) {
        latestUpdate = metadata.lastUpdated;
      }
    }

    if (latestUpdate) {
      stats.lastUpdated = new Date(latestUpdate);
    }

    return stats;
  }

  public async removeFieldTags(
    sourceType: string,
    sourceId: string,
    fieldName: string,
    tagsToRemove: string[]
  ): Promise<void> {
    const existing = await this.getFieldMetadata(sourceType, sourceId, fieldName);
    if (!existing) {
      // Field doesn't exist, nothing to remove
      return;
    }

    const currentTags = existing.tags || [];
    const updatedTags = currentTags.filter((tag) => !tagsToRemove.includes(tag));

    await this.updateFieldMetadata(sourceType, sourceId, fieldName, {
      tags: updatedTags,
    });
  }

  public async searchFieldsByTags(tags: string[]): Promise<FieldMetadata[]> {
    const allFields = await this.getAllFieldMetadata();

    return allFields.filter((field) => {
      if (!field.tags || field.tags.length === 0) {
        return false;
      }
      return tags.some((tag) => field.tags?.includes(tag));
    });
  }

  public async updateFieldMetadata(
    sourceType: string,
    sourceId: string,
    fieldName: string,
    updates: FieldMetadataUpdate
  ): Promise<FieldMetadata> {
    await this.ensureCacheLoaded();

    const fieldId = this.getFieldId(sourceType, sourceId, fieldName);
    if (!this.metadataCache) {
      throw new Error('Metadata cache not initialized');
    }
    const existing = this.metadataCache.get(fieldId) || {};

    const updated: FieldMetadataEntry = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    this.metadataCache.set(fieldId, updated);

    // Save to S3
    await this.saveMetadataToS3();

    return {
      sourceType: sourceType as any,
      sourceId,
      fieldName,
      description: updated.description,
      businessGlossary: updated.businessGlossary,
      tags: updated.tags || [],
      category: updated.category,
      sensitivity: updated.sensitivity,
      lastUpdated: updated.lastUpdated ? new Date(updated.lastUpdated) : new Date(),
      updatedBy: updated.updatedBy,
    };
  }

  private async ensureCacheLoaded(): Promise<void> {
    if (!this.metadataCache || Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
      try {
        await this.loadMetadataCache();
      } catch (error) {
        logger.error('Failed to load metadata cache:', error);
        // Initialize with empty cache on error
        this.metadataCache = new Map();
        this.cacheTimestamp = Date.now();
      }
    }
  }

  private getFieldId(sourceType: string, sourceId: string, fieldName: string): string {
    return `${sourceType}::${sourceId}::${fieldName}`;
  }

  private async loadMetadataCache(): Promise<void> {
    try {
      const bulkData = await this.s3Service.getObject(this.bucketName, this.METADATA_KEY);
      this.metadataCache = new Map();

      if (bulkData && bulkData.fields) {
        for (const [fieldId, metadata] of Object.entries(bulkData.fields)) {
          this.metadataCache.set(fieldId, metadata as FieldMetadataEntry);
        }
      }

      this.cacheTimestamp = Date.now();
      logger.info(`Loaded ${this.metadataCache.size} field metadata entries from S3`);
    } catch (error: any) {
      this.metadataCache = new Map();
      if (error.name === 'NoSuchKey') {
        logger.info('No existing field metadata found, starting with empty cache');
      } else {
        logger.error('Error loading field metadata cache:', error);
        throw error;
      }
    }
  }

  private async saveMetadataToS3(): Promise<void> {
    if (!this.metadataCache) {
      throw new Error('Metadata cache not loaded');
    }

    const bulkData: BulkFieldMetadata = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      totalFields: this.metadataCache.size,
      fields: Object.fromEntries(this.metadataCache.entries()),
    };

    await this.s3Service.putObject(
      this.bucketName,
      this.METADATA_KEY,
      JSON.stringify(bulkData, null, 2),
      'application/json'
    );

    logger.info(`Saved ${this.metadataCache.size} field metadata entries to S3`);
  }
}
