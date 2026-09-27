import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import type { AssetSummary, AssetType } from '../types';
import { type AssetProcessingCapabilities, BaseAssetProcessor } from './BaseAssetProcessor';

/**
 * Custom themes: each described (its configuration: palette, colors by
 * role, typography), with its permissions and tags. QuickSight's own themes
 * are fixed and never listed.
 */
export class ThemeProcessor extends BaseAssetProcessor {
  public readonly assetType: AssetType = ASSET_TYPES.theme;
  public readonly capabilities: AssetProcessingCapabilities = {
    hasDefinition: false,
    hasPermissions: true,
    hasTags: true,
    hasSpecialOperations: false,
  };

  public readonly storageType = 'individual' as const;

  protected override executeDescribe(assetId: string, assetName?: string): Promise<any> {
    return this.quickSightService.describeTheme(assetId, assetName);
  }

  protected override async executeGetPermissions(assetId: string): Promise<any> {
    try {
      return await this.quickSightService.describeThemePermissions(assetId);
    } catch (error: any) {
      // Unread, not empty: the permissions the previous export found are kept.
      logger.warn(`Could not read permissions for theme ${assetId}: ${error?.message}`);
      return undefined;
    }
  }

  protected override executeGetTags(assetId: string): Promise<any[] | undefined> {
    return this.tagService.readResourceTags(ASSET_TYPES.theme, assetId);
  }

  protected getAssetId(summary: AssetSummary): string | undefined {
    return (summary as any).themeId;
  }

  protected getAssetName(summary: AssetSummary): string {
    return (summary as any).name || `Theme ${(summary as any).themeId}`;
  }

  protected getServicePath(): string {
    return ASSET_TYPES_PLURAL.theme;
  }
}
