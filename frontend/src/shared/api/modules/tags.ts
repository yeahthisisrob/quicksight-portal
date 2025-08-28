import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Tags API - handles tagging operations for all resource types
 */
export const tagsApi = {
  // Get resource tags
  async getResourceTags(
    resourceType: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group',
    resourceId: string
  ): Promise<Array<{ key: string; value: string }>> {
    const response = await apiClient.get<ApiResponse<Array<{ key: string; value: string }>>>(
      `/tags/${resourceType}/${resourceId}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch tags');
    }
    return response.data.data || [];
  },

  // Update resource tags
  async updateResourceTags(
    resourceType: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group',
    resourceId: string,
    tags: Array<{ key: string; value: string }>
  ): Promise<void> {
    const response = await apiClient.post<ApiResponse<any>>(
      `/tags/${resourceType}/${resourceId}`,
      { tags }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update tags');
    }
  },

  // Remove resource tags
  async removeResourceTags(
    resourceType: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group',
    resourceId: string,
    tagKeys: string[]
  ): Promise<void> {
    const response = await apiClient.delete<ApiResponse<any>>(
      `/tags/${resourceType}/${resourceId}`,
      { data: { tagKeys } }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove tags');
    }
  },

  // Field metadata operations
  async getFieldMetadata(
    sourceTypeOrDatasetId: string | 'dataset' | 'analysis' | 'dashboard',
    sourceIdOrFieldName: string,
    fieldNameOrUndefined?: string
  ): Promise<any> {
    let url: string;
    if (fieldNameOrUndefined === undefined) {
      // Legacy call: getFieldMetadata(datasetId, fieldName)
      url = `/tags/field/${sourceTypeOrDatasetId}/${encodeURIComponent(sourceIdOrFieldName)}`;
    } else {
      // New call: getFieldMetadata(sourceType, sourceId, fieldName)
      url = `/tags/field/${sourceTypeOrDatasetId}/${sourceIdOrFieldName}/${encodeURIComponent(fieldNameOrUndefined)}`;
    }
    
    const response = await apiClient.get<ApiResponse<any>>(url);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch field metadata');
    }
    return response.data.data;
  },

  async updateFieldMetadata(
    sourceTypeOrDatasetId: string | 'dataset' | 'analysis' | 'dashboard',
    sourceIdOrFieldName: string,
    fieldNameOrMetadata: string | any,
    metadataOrUndefined?: any
  ): Promise<any> {
    let url: string;
    let metadata: any;
    
    if (metadataOrUndefined === undefined) {
      // Legacy call: updateFieldMetadata(datasetId, fieldName, metadata)
      url = `/tags/field/${sourceTypeOrDatasetId}/${encodeURIComponent(sourceIdOrFieldName)}`;
      metadata = fieldNameOrMetadata;
    } else {
      // New call: updateFieldMetadata(sourceType, sourceId, fieldName, metadata)
      url = `/tags/field/${sourceTypeOrDatasetId}/${sourceIdOrFieldName}/${encodeURIComponent(fieldNameOrMetadata as string)}`;
      metadata = metadataOrUndefined;
    }
    
    const response = await apiClient.put<ApiResponse<any>>(url, metadata);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update field metadata');
    }
    return response.data.data;
  },

  async addFieldTags(
    sourceTypeOrDatasetId: string | 'dataset' | 'analysis' | 'dashboard',
    sourceIdOrFieldName: string,
    fieldNameOrTags: string | Array<{ key: string; value: string }>,
    tagsOrUndefined?: Array<{ key: string; value: string }>
  ): Promise<void> {
    let url: string;
    let tags: Array<{ key: string; value: string }>;
    
    if (Array.isArray(fieldNameOrTags)) {
      // Legacy call: addFieldTags(datasetId, fieldName, tags)
      url = `/tags/field/${sourceTypeOrDatasetId}/${encodeURIComponent(sourceIdOrFieldName)}/tags`;
      tags = fieldNameOrTags;
    } else {
      // New call: addFieldTags(sourceType, sourceId, fieldName, tags)
      url = `/tags/field/${sourceTypeOrDatasetId}/${sourceIdOrFieldName}/${encodeURIComponent(fieldNameOrTags)}/tags`;
      tags = tagsOrUndefined!;
    }
    
    const response = await apiClient.post<ApiResponse<any>>(url, { tags });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add field tags');
    }
  },

  async removeFieldTags(
    sourceTypeOrDatasetId: string | 'dataset' | 'analysis' | 'dashboard',
    sourceIdOrFieldName: string,
    fieldNameOrTagKeys: string | string[],
    tagKeysOrUndefined?: string[]
  ): Promise<void> {
    let url: string;
    let tagKeys: string[];
    
    if (Array.isArray(fieldNameOrTagKeys)) {
      // Legacy call: removeFieldTags(datasetId, fieldName, tagKeys)
      url = `/tags/field/${sourceTypeOrDatasetId}/${encodeURIComponent(sourceIdOrFieldName)}/tags`;
      tagKeys = fieldNameOrTagKeys;
    } else {
      // New call: removeFieldTags(sourceType, sourceId, fieldName, tagKeys)
      url = `/tags/field/${sourceTypeOrDatasetId}/${sourceIdOrFieldName}/${encodeURIComponent(fieldNameOrTagKeys)}/tags`;
      tagKeys = tagKeysOrUndefined!;
    }
    
    const response = await apiClient.delete<ApiResponse<any>>(url, { data: { tagKeys } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove field tags');
    }
  },

  async getAllFieldsMetadata(
    sourceTypeOrDatasetId: string | 'dataset' | 'analysis' | 'dashboard',
    sourceIdOrUndefined?: string
  ): Promise<any[]> {
    let url: string;
    
    if (sourceIdOrUndefined === undefined) {
      // Legacy call: getAllFieldsMetadata(datasetId)
      url = `/tags/field/dataset/${sourceTypeOrDatasetId}/all`;
    } else {
      // New call: getAllFieldsMetadata(sourceType, sourceId)
      url = `/tags/field/${sourceTypeOrDatasetId}/${sourceIdOrUndefined}/all`;
    }
    
    const response = await apiClient.get<ApiResponse<any[]>>(url);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch fields metadata');
    }
    return response.data.data || [];
  },

  async searchFieldsByTags(tags: Array<{ key: string; value?: string }>): Promise<any[]> {
    const response = await apiClient.post<ApiResponse<any[]>>(
      '/tags/field/search',
      { tags }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to search fields');
    }
    return response.data.data || [];
  },
};