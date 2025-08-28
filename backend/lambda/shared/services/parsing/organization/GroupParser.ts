import { type AssetExportData } from '../../../models/asset-export.model';
import { ASSET_TYPES } from '../../../types/assetTypes';
import { BaseAssetParser, type ParserCapabilities } from '../BaseAssetParser';

/**
 * Group metadata extracted from API responses
 */
export interface GroupMetadata {
  assetId: string;
  name: string;
  arn: string;
  description?: string;
  principalId?: string;
  memberCount: number;
  members?: Array<{
    memberName: string;
    arn: string;
    email?: string;
  }>;
}

/**
 * Group-specific parser implementation
 */
export class GroupParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.group;

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
   * Extract definition from group response (not applicable for groups)
   */
  protected override extractDefinition(groupDefinition: any): any {
    return groupDefinition;
  }

  /**
   * Extract comprehensive group metadata from individual data components
   */
  public extractGroupMetadata(
    listData: any,
    describeData: any,
    membersData: any[] = []
  ): GroupMetadata {
    const group = describeData?.Group;

    return {
      assetId: listData?.GroupName || group?.GroupName,
      name: listData?.GroupName || group?.GroupName,
      arn: listData?.Arn || group?.Arn,
      description: listData?.Description || group?.Description,
      principalId: listData?.PrincipalId || group?.PrincipalId,
      memberCount: membersData.length,
      members: membersData.map((member) => ({
        memberName: member.MemberName,
        arn: member.Arn,
        email: member.Email,
      })),
    };
  }

  /**
   * Extract comprehensive group metadata from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData): GroupMetadata {
    const listData = assetData.apiResponses?.list?.data;
    const describeData = assetData.apiResponses?.describe?.data;
    const membersData = assetData.apiResponses?.members?.data || [];

    return this.extractGroupMetadata(listData, describeData, membersData);
  }
}
