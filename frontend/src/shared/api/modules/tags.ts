import type { components, paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type TaggableAssetType =
  paths['/api/tags/{assetType}/{assetId}']['post']['parameters']['path']['assetType'];
type FieldSourceType =
  paths['/api/data-catalog/field/{sourceType}/{sourceId}/{fieldName}']['get']['parameters']['path']['sourceType'];
type Tag = components['schemas']['Tag'];

/**
 * Tags on QuickSight assets, and the portal's own metadata on a field.
 */
export const tagsApi = {
  /** Add tags to an asset (keys it already has are overwritten). */
  async updateResourceTags(
    resourceType: TaggableAssetType,
    resourceId: string,
    tags: Tag[]
  ): Promise<void> {
    unwrap(
      await client.POST('/api/tags/{assetType}/{assetId}', {
        params: { path: { assetType: resourceType, assetId: resourceId } },
        body: { tags },
      }),
      'Failed to update tags'
    );
  },

  async removeResourceTags(
    resourceType: TaggableAssetType,
    resourceId: string,
    tagKeys: string[]
  ): Promise<void> {
    unwrap(
      await client.DELETE('/api/tags/{assetType}/{assetId}', {
        params: { path: { assetType: resourceType, assetId: resourceId } },
        body: { tagKeys },
      }),
      'Failed to remove tags'
    );
  },

  /** A field's portal metadata (description, glossary, tags, lineage notes). */
  async getFieldMetadata(sourceType: FieldSourceType, sourceId: string, fieldName: string) {
    return unwrap(
      await client.GET('/api/data-catalog/field/{sourceType}/{sourceId}/{fieldName}', {
        params: { path: { sourceType, sourceId, fieldName } },
      }),
      'Failed to fetch field metadata'
    );
  },

  async updateFieldMetadata(
    sourceType: FieldSourceType,
    sourceId: string,
    fieldName: string,
    metadata: components['schemas']['FieldMetadataUpdate']
  ) {
    return unwrap(
      await client.PUT('/api/data-catalog/field/{sourceType}/{sourceId}/{fieldName}', {
        params: { path: { sourceType, sourceId, fieldName } },
        body: metadata,
      }),
      'Failed to update field metadata'
    );
  },
};
