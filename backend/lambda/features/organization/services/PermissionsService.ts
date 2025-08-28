import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { ASSET_TYPES, type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type AssetPermission } from '../types';

export class PermissionsService {
  private readonly quickSightService: QuickSightService;

  constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  /**
   * Get permissions for an analysis
   */
  public async getAnalysisPermissions(analysisId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeAnalysisPermissions(analysisId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching analysis permissions for ${analysisId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for any asset type
   */
  public async getAssetPermissions(
    assetType: AssetType,
    assetId: string
  ): Promise<AssetPermission[]> {
    // Map asset types to their corresponding permission methods
    const permissionMethods: Record<AssetType, () => Promise<AssetPermission[]>> = {
      [ASSET_TYPES.dashboard]: () => this.getDashboardPermissions(assetId),
      [ASSET_TYPES.analysis]: () => this.getAnalysisPermissions(assetId),
      [ASSET_TYPES.dataset]: () => this.getDataSetPermissions(assetId),
      [ASSET_TYPES.datasource]: () => this.getDataSourcePermissions(assetId),
      [ASSET_TYPES.folder]: () => this.getFolderPermissions(assetId),
      // Users and groups don't have permissions in QuickSight
      [ASSET_TYPES.user]: () => Promise.resolve([]),
      [ASSET_TYPES.group]: () => Promise.resolve([]),
    };

    const method = permissionMethods[assetType];
    if (!method) {
      logger.error(`Unknown asset type: ${assetType}`);
      return Promise.resolve([]);
    }

    return await method();
  }

  /**
   * Get permissions for a dashboard
   */
  public async getDashboardPermissions(dashboardId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeDashboardPermissions(dashboardId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching dashboard permissions for ${dashboardId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for a dataset
   */
  public async getDataSetPermissions(dataSetId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeDatasetPermissions(dataSetId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching dataset permissions for ${dataSetId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for a data source
   */
  public async getDataSourcePermissions(dataSourceId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeDatasourcePermissions(dataSourceId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching datasource permissions for ${dataSourceId}:`, error);
      return [];
    }
  }

  /**
   * Get permissions for a folder
   */
  public async getFolderPermissions(folderId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.quickSightService.describeFolderPermissions(folderId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching folder permissions for ${folderId}:`, error);
      return [];
    }
  }

  /**
   * Determine if a principal is a user or group
   */
  private determinePrincipalType(principal: string): 'USER' | 'GROUP' {
    // QuickSight principals have the format:
    // Users: arn:aws:quicksight:region:account-id:user/namespace/username
    // Groups: arn:aws:quicksight:region:account-id:group/namespace/groupname
    if (principal.includes(':group/')) {
      return 'GROUP';
    }
    return 'USER';
  }

  /**
   * Transform QuickSight permissions to our format
   */
  private transformPermissions(permissions: any[]): AssetPermission[] {
    return permissions.map((permission) => ({
      principal: permission.Principal,
      principalType: this.determinePrincipalType(permission.Principal),
      actions: permission.Actions || [],
    }));
  }
}
