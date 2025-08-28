import { type AssetExportData } from '../../../models/asset-export.model';
import { ASSET_TYPES } from '../../../types/assetTypes';
import { BaseAssetParser, type ParserCapabilities } from '../BaseAssetParser';

/**
 * User metadata extracted from API responses
 */
export interface UserMetadata {
  assetId: string;
  name: string;
  arn: string;
  email?: string;
  role?: string;
  active?: boolean;
  principalId?: string;
}

/**
 * User-specific parser implementation
 */
export class UserParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.user;

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
   * Extract definition from user response (not applicable for users)
   */
  protected override extractDefinition(userDefinition: any): any {
    return userDefinition;
  }

  /**
   * Extract comprehensive user metadata from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData): UserMetadata {
    const listData = assetData.apiResponses?.list?.data;
    const describeData = assetData.apiResponses?.describe?.data;

    return this.extractUserMetadata(listData, describeData);
  }

  /**
   * Extract comprehensive user metadata from individual data components
   */
  public extractUserMetadata(listData: any, describeData: any): UserMetadata {
    const user = describeData?.User;
    const sourceData = { ...user, ...listData }; // Prefer listData over user data

    return {
      assetId: sourceData.UserName,
      name: sourceData.UserName,
      arn: sourceData.Arn,
      email: sourceData.Email,
      role: sourceData.Role,
      active: sourceData.Active ?? true,
      principalId: sourceData.PrincipalId,
    };
  }
}
