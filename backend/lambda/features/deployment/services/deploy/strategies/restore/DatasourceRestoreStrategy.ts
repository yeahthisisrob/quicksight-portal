import { BaseAssetRestoreStrategy } from './BaseAssetRestoreStrategy';
import type { AssetExportData } from '../../../../../../shared/models/asset-export.model';
import type { ValidationResult } from '../../types';

/**
 * Datasource-specific restore strategy
 */
export class DatasourceRestoreStrategy extends BaseAssetRestoreStrategy {
  /**
   * Delete existing datasource
   */
  public async deleteExisting(assetId: string): Promise<void> {
    await this.handleDeletion(assetId, () => this.quickSightService.deleteDatasource(assetId));
  }

  /**
   * Restore datasource to QuickSight
   */
  public async restore(
    assetId: string,
    assetData: AssetExportData
  ): Promise<{ arn?: string; [key: string]: any }> {
    const datasourceData = this.extractDatasourceData(assetData);

    this.validateRequiredData(assetId, datasourceData.type, 'datasource type');
    this.validateRequiredData(assetId, datasourceData.parameters, 'datasource parameters');

    this.logRestoreOperation(assetId, {
      name: datasourceData.name,
      type: datasourceData.type,
      hasParameters: !!datasourceData.parameters,
      hasCredentials: !!datasourceData.credentials,
      permissionCount: datasourceData.permissions.length,
      tagCount: datasourceData.tags.length,
    });

    return await this.quickSightService.createDataSource({
      dataSourceId: assetId,
      name: datasourceData.name,
      type: datasourceData.type,
      dataSourceParameters: datasourceData.parameters,
      credentials: datasourceData.credentials,
      permissions: datasourceData.permissions,
      ...this.getTagsForApi(datasourceData.tags),
      vpcConnectionProperties: datasourceData.vpcConnectionProperties,
      sslProperties: datasourceData.sslProperties,
    });
  }

  /**
   * Datasources have no dependencies to validate
   */
  protected async validateDependencies(
    assetId: string,
    assetData: AssetExportData
  ): Promise<ValidationResult[]> {
    // Datasources are leaf nodes in the dependency tree
    const describe = assetData.apiResponses?.describe?.data || {};
    if (describe.Type) {
      return await Promise.resolve([
        {
          validator: 'dependencies',
          passed: true,
          message: `Datasource ${assetId} of type ${describe.Type} has no dependencies`,
          severity: 'info',
          details: { assetId, type: describe.Type },
        },
      ]);
    }
    return await Promise.resolve([]);
  }

  /**
   * Extract datasource-specific data from export
   */
  private extractDatasourceData(assetData: AssetExportData): {
    name: string;
    permissions: any[];
    tags: any[];
    type: string;
    parameters: any;
    credentials?: any;
    vpcConnectionProperties?: any;
    sslProperties?: any;
  } {
    const basic = this.extractBasicMetadata(assetData);
    const describe = assetData.apiResponses?.describe?.data || {};

    return {
      ...basic,
      type: describe.Type,
      parameters: describe.DataSourceParameters,
      credentials: describe.Credentials,
      vpcConnectionProperties: describe.VpcConnectionProperties,
      sslProperties: describe.SslProperties,
    };
  }
}
