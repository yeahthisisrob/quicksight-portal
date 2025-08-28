/**
 * Utility function to build asset metadata from archived data
 */
import type { ArchivedAssetItem } from '../../../model/types';
import type { AssetMetadata } from '../types';

export function buildAssetMetadata(
  archivedData: any,
  asset: ArchivedAssetItem
): AssetMetadata {
  const metadata: AssetMetadata = {
    permissions: archivedData.apiResponses?.permissions?.data || [],
    tags: archivedData.apiResponses?.tags?.data || [],
    refreshSchedules: archivedData.apiResponses?.refreshSchedules?.data || [],
    refreshProperties: archivedData.apiResponses?.dataSetRefreshProperties?.data || null,
    folderMemberships: archivedData.apiResponses?.folderMemberships?.data || [],
  };
  
  const describeData = archivedData.apiResponses?.describe?.data;
  if (describeData) {
    extractBasicMetadata(metadata, describeData);
    
    if (asset.type === 'dataset') {
      extractDatasetMetadata(metadata, describeData);
    }
  }
  
  return metadata;
}

function extractBasicMetadata(metadata: AssetMetadata, describeData: any): void {
  Object.assign(metadata, {
    originalName: describeData.Name || describeData.name,
    description: describeData.Description || describeData.description,
    createdTime: describeData.CreatedTime || describeData.createdTime,
    lastUpdatedTime: describeData.LastUpdatedTime || describeData.lastUpdatedTime,
  });
}

function extractDatasetMetadata(metadata: AssetMetadata, describeData: any): void {
  Object.assign(metadata, {
    importMode: describeData.ImportMode || describeData.importMode,
    rowCount: describeData.RowInfo?.RowCount,
    consumedSpiceCapacityInBytes: describeData.ConsumedSpiceCapacityInBytes,
  });
}