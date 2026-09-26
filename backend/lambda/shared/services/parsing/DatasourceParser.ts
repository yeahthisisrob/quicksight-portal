import type { AssetExportData } from '../../models/asset-export.model';
import { ASSET_TYPES } from '../../types/assetTypes';
import { BaseAssetParser, type ParserCapabilities } from './BaseAssetParser';

/**
 * Datasource metadata extracted from API responses
 */
interface DatasourceMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  datasourceType?: string;
  sourceType?: string;
  connectionMode?: string;
  /** S3: the bucket its manifest lives in. */
  bucket?: string;
  /** Athena: the workgroup its queries run in (QuickSight's default is 'primary'). */
  workGroup?: string;
  /** VPC connection it reaches its database through, if any. */
  vpcConnectionArn?: string;
  /** Where its credentials come from: none needed, a Secrets Manager secret, or stored in QuickSight. */
  credentials?: 'none' | 'secret' | 'stored';
}

/** Engines QuickSight reaches with its own role: no password to keep. */
const ROLE_ONLY_TYPES = new Set(['ATHENA', 'S3', 'TIMESTREAM', 'AWS_IOT_ANALYTICS']);

/** The connection facts that decide whether two data sources are interchangeable. */
function connectionFacts(type: string | undefined, describeData: any) {
  const params = describeData?.DataSourceParameters ?? {};
  const bucket = params.S3Parameters?.ManifestFileLocation?.Bucket;
  const athena = params.AthenaParameters;
  const vpc = describeData?.VpcConnectionProperties?.VpcConnectionArn;
  const credentials: DatasourceMetadata['credentials'] = describeData?.SecretArn
    ? 'secret'
    : type && ROLE_ONLY_TYPES.has(type)
      ? 'none'
      : describeData
        ? 'stored'
        : undefined;
  return {
    ...(bucket ? { bucket } : {}),
    ...(athena ? { workGroup: athena.WorkGroup || 'primary' } : {}),
    ...(vpc ? { vpcConnectionArn: vpc } : {}),
    ...(credentials ? { credentials } : {}),
  };
}

/**
 * Datasource-specific parser implementation
 */
export class DatasourceParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.datasource;

  public readonly capabilities: ParserCapabilities = {
    hasDataSets: false,
    hasCalculatedFields: false,
    hasParameters: false,
    hasFilters: false,
    hasSheets: false,
    hasVisuals: false,
    hasFields: false,
    hasDatasourceInfo: true,
  };

  /**
   * Extract comprehensive datasource metadata from individual data components
   */
  public extractDatasourceMetadata(listData: any, describeData: any): DatasourceMetadata {
    const type = listData?.Type || describeData?.Type;
    return {
      assetId: listData?.DataSourceId || describeData?.DataSourceId,
      name: listData?.Name || describeData?.Name,
      arn: listData?.Arn || describeData?.Arn,
      createdTime: listData?.CreatedTime || describeData?.CreatedTime,
      lastUpdatedTime: listData?.LastUpdatedTime || describeData?.LastUpdatedTime,
      datasourceType: type,
      sourceType: type,
      connectionMode: describeData?.DataSourceParameters?.S3Parameters ? 'FILE' : 'DIRECT',
      ...connectionFacts(type, describeData),
    };
  }

  /**
   * Extract definition from datasource response (not applicable for datasources)
   */
  protected override extractDefinition(datasourceDefinition: any): any {
    return datasourceDefinition;
  }

  /**
   * Extract comprehensive datasource metadata from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData): DatasourceMetadata {
    const listData = assetData.apiResponses?.list?.data;
    const describeData = assetData.apiResponses?.describe?.data;

    return this.extractDatasourceMetadata(listData, describeData);
  }
}
