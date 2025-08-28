/**
 * Utility functions for extracting metadata from archived asset data
 */
import type { AssetMetadata } from '../ui/RestoreAssetDialog/types';

/**
 * Extract base metadata from API responses
 */
export function extractBaseMetadata(apiResponses: any): Partial<AssetMetadata> {
  return {
    permissions: apiResponses?.permissions?.data || [],
    tags: apiResponses?.tags?.data || [],
    refreshSchedules: apiResponses?.refreshSchedules?.data || [],
    refreshProperties: apiResponses?.dataSetRefreshProperties?.data || null,
    folderMemberships: apiResponses?.folderMemberships?.data || [],
  };
}

/**
 * Extract describe metadata fields
 */
export function extractDescribeMetadata(describeData: any): Partial<AssetMetadata> {
  if (!describeData) return {};
  
  return {
    originalName: describeData.Name || describeData.name,
    description: describeData.Description || describeData.description,
    createdTime: describeData.CreatedTime || describeData.createdTime,
    lastUpdatedTime: describeData.LastUpdatedTime || describeData.lastUpdatedTime,
  };
}

/**
 * Extract dataset-specific metadata
 */
export function extractDatasetMetadata(describeData: any): Partial<AssetMetadata> {
  if (!describeData) return {};
  
  return {
    importMode: describeData.ImportMode || describeData.importMode,
    rowCount: describeData.RowInfo?.RowCount,
    consumedSpiceCapacityInBytes: describeData.ConsumedSpiceCapacityInBytes,
  };
}

/**
 * Main function to extract complete metadata from archived data
 */
export function extractAssetMetadata(archivedData: any, assetType: string): AssetMetadata {
  const apiResponses = archivedData.apiResponses || {};
  const describeData = apiResponses.describe?.data;
  
  return {
    ...extractBaseMetadata(apiResponses),
    ...extractDescribeMetadata(describeData),
    ...(assetType === 'dataset' ? extractDatasetMetadata(describeData) : {}),
  } as AssetMetadata;
}