import { type AssetExportData } from '../../../models/asset-export.model';
import { ASSET_TYPES } from '../../../types/assetTypes';
import { BaseAssetParser, type ParserCapabilities } from '../BaseAssetParser';

/**
 * Folder metadata extracted from API responses
 */
export interface FolderMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  folderPath?: any[];
  parentId?: string;
  memberCount: number;
  members?: any[];
}

/**
 * Folder-specific parser implementation
 */
export class FolderParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.folder;

  public readonly capabilities: ParserCapabilities = {
    hasDataSets: false,
    hasCalculatedFields: false,
    hasParameters: false,
    hasFilters: false,
    hasSheets: false,
    hasVisuals: false,
    hasFields: false,
    hasDatasourceInfo: false,
  };

  /**
   * Extract definition from folder response (not applicable for folders)
   */
  protected override extractDefinition(folderDefinition: any): any {
    return folderDefinition;
  }

  /**
   * Extract comprehensive folder metadata from individual data components
   */
  public extractFolderMetadata(
    listData: any,
    describeData: any,
    membersData: any[] = []
  ): FolderMetadata {
    const folderName = describeData?.Name || listData?.Name || '';
    const folderPath = describeData?.FolderPath || listData?.FolderPath || [];

    return {
      assetId: describeData?.FolderId || listData?.FolderId,
      name: folderName,
      arn: describeData?.Arn || listData?.Arn,
      createdTime: describeData?.CreatedTime || listData?.CreatedTime,
      lastUpdatedTime: describeData?.LastUpdatedTime || listData?.LastUpdatedTime,
      folderPath: folderPath,
      parentId:
        folderPath.length > 0 ? folderPath[folderPath.length - 1]?.split('/').pop() : undefined,
      memberCount: membersData.length,
      members: membersData,
    };
  }

  /**
   * Extract comprehensive folder metadata from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData): FolderMetadata {
    const listData = assetData.apiResponses?.list?.data;
    const describeData = assetData.apiResponses?.describe?.data;
    const membersData = assetData.apiResponses?.members?.data || [];

    return this.extractFolderMetadata(listData, describeData, membersData);
  }
}
