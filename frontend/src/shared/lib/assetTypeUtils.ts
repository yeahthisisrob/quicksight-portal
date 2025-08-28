/**
 * Utility functions for handling asset type mappings between frontend and backend
 */

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
  'amazonelasticsearch'
];

/**
 * Maps an asset type to the correct QuickSight resource type for API operations.
 * This handles cases where individual assets have subtypes (like "athena" for datasources)
 * but the API expects the main resource type ("datasource").
 * 
 * @param assetType - The asset type to map
 * @returns The corresponding QuickSight resource type
 */
export function getQuickSightResourceType(assetType: string): string {
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
 * Maps an asset type to the correct QuickSight resource type for folder operations.
 * Folder operations expect uppercase values.
 * 
 * @param assetType - The asset type to map
 * @returns The corresponding QuickSight resource type in uppercase
 */
export function getQuickSightFolderMemberType(assetType: string): string {
  return getQuickSightResourceType(assetType).toUpperCase();
}

/**
 * Maps an asset type to the correct QuickSight resource type for tag operations.
 * Tag operations expect specific lowercase string literal types.
 * 
 * @param assetType - The asset type to map
 * @returns The corresponding QuickSight resource type for tag operations
 */
export function getQuickSightTagResourceType(assetType: string): 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group' {
  const type = getQuickSightResourceType(assetType);
  
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
      // Fallback to datasource for unknown types (likely datasource subtypes)
      return 'datasource';
  }
}