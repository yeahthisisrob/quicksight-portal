/**
 * Utility functions for handling asset type mappings between frontend and backend
 */

import { config } from '@/shared/config/config';

// List of known datasource subtypes that should be mapped to 'datasource'
const DATASOURCE_SUBTYPES = [
  'athena',
  'redshift',
  's3',
  'mysql',
  'postgresql',
  'aurora',
  'aurora_postgresql',
  'mariadb',
  'presto',
  'snowflake',
  'spark',
  'sqlserver',
  'teradata',
  'timestream',
  'twitter',
  'bigquery',
  'databricks',
  'amazonelasticsearch',
];

/**
 * Maps an asset type to the correct QuickSight resource type for API operations.
 * This handles cases where individual assets have subtypes (like "athena" for datasources)
 * but the API expects the main resource type ("datasource").
 *
 * @param assetType - The asset type to map
 * @returns The corresponding QuickSight resource type
 */
function getQuickSightResourceType(assetType: string): string {
  const type = assetType.toLowerCase();

  switch (type) {
    case 'dashboard':
      return 'dashboard';
    case 'analysis':
      return 'analysis';
    case 'dataset':
      return 'dataset';
    case 'datasource':
      return 'datasource';
    case 'folder':
      return 'folder';
    case 'user':
      return 'user';
    case 'group':
      return 'group';
    default:
      // If asset type is a datasource subtype, map it to datasource
      if (DATASOURCE_SUBTYPES.includes(type)) {
        return 'datasource';
      }
      // Default fallback - return as lowercase
      return type;
  }
}

/**
 * QuickSight console URL path patterns by asset type.
 * These map to the actual AWS QuickSight console routes.
 */
const QUICKSIGHT_CONSOLE_PATHS: Record<string, (id: string) => string> = {
  dashboard: (id) => `sn/dashboards/${id}`,
  analysis: (id) => `sn/analyses/${id}`,
  dataset: (id) => `sn/data-sets/${id}/view`,
  datasource: (id) => `sn/data/data-source/Connection%3A${id}`,
};

/**
 * Builds the QuickSight console URL for an asset.
 * Opens the asset directly in the AWS QuickSight console.
 *
 * @param assetType - The type of asset (dashboard, analysis, dataset, datasource)
 * @param assetId - The unique identifier of the asset
 * @returns The full QuickSight console URL, or null if the asset type doesn't support console URLs
 */
export function getQuickSightConsoleUrl(assetType: string, assetId: string): string | null {
  const type = getQuickSightResourceType(assetType);
  const pathBuilder = QUICKSIGHT_CONSOLE_PATHS[type];

  if (!pathBuilder) {
    return null;
  }

  const region = config.AWS_REGION;
  return `https://${region}.quicksight.aws.amazon.com/${pathBuilder(assetId)}`;
}
