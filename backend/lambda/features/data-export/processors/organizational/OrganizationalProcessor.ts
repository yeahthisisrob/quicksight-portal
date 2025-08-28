import { logger } from '../../../../shared/utils/logger';
import { BaseAssetProcessor, type AssetProcessingCapabilities } from '../BaseAssetProcessor';

/**
 * Base class for organizational asset processors (users, groups, folders)
 * These assets have special characteristics:
 * - No reliable timestamps for change detection
 * - Must always be fully refreshed (no smart sync)
 * - Often have interdependencies (users->groups, folders->members)
 * - Should be exported in a specific order for efficiency
 */
export abstract class OrganizationalProcessor extends BaseAssetProcessor {
  /**
   * Common capabilities for organizational assets
   * - No definition (not created/designed like dashboards)
   * - No permissions (managed differently than content assets)
   * - No tags (organizational structure, not content)
   * - Has special operations (group members, user groups, folder members)
   */
  public readonly capabilities: AssetProcessingCapabilities = {
    hasDefinition: false,
    hasPermissions: false,
    hasTags: false,
    hasSpecialOperations: true,
  };

  /**
   * All organizational assets use collection storage
   * They are stored as a single JSON file per type
   */
  public readonly storageType = 'collection' as const;

  /**
   * Common pattern for describe - organizational assets typically
   * have minimal describe data since most info comes from list
   */
  protected override executeDescribe(assetId: string): Promise<any> {
    return Promise.resolve({
      [`${this.getAssetTypeCapitalized()}Name`]: assetId,
    });
  }

  /**
   * Organizational assets don't have permissions in the traditional sense
   */
  protected override executeGetPermissions(assetId: string): Promise<any[]> {
    // Most organizational assets don't have permissions
    // Subclasses like FolderProcessor can override this method if they do need permissions
    logger.debug(`No permissions to fetch for organizational asset: ${assetId}`);
    return Promise.resolve([]);
  }

  /**
   * Organizational assets don't have tags
   */
  protected override executeGetTags(): Promise<any[]> {
    return Promise.resolve([]);
  }

  /**
   * Get the capitalized asset type for API field names
   * e.g., 'user' -> 'User', 'group' -> 'Group'
   */
  protected getAssetTypeCapitalized(): string {
    return this.assetType.charAt(0).toUpperCase() + this.assetType.slice(1);
  }

  /**
   * Override shouldUpdate to always return true
   * Organizational assets must always be refreshed since we can't detect changes reliably
   */
  protected shouldUpdate(_cachedEntry: any, _newEntry: any): boolean {
    return true;
  }
}
