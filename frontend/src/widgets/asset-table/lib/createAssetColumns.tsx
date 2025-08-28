import { Tooltip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import { generateBaseColumns } from './baseColumns';
import {
  generateDatasetColumns,
  generateFolderColumns,
  generateUserColumns,
  generateGroupColumns,
  generateDatasourceColumns,
  generateDashboardAnalysisColumns,
  generateUsedByColumn,
  generateUsesColumn,
} from './columnGenerators';

import type { ColumnConfig } from '@/features/asset-management';
import type { components } from '@shared/generated/types';

// Import the actual generated types
type AssetListItem = components['schemas']['AssetListItem'];

// Create a practical type that includes all possible properties
// This is a pragmatic approach that maintains type safety for known properties
// while allowing flexibility for frontend-added properties
interface AssetRow extends Omit<AssetListItem, 'enrichmentStatus'> {
  // Type discriminator
  type: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group';
  
  // Frontend-added properties
  relatedAssets?: any;
  
  // Common properties for dashboards and analyses
  definitionErrors?: Array<{
    type: string;
    message: string;
    violatedEntities?: Array<{
      path: string;
    }>;
  }>;
  
  // Dashboard-specific
  dashboardStatus?: string;
  visualCount?: number;
  sheetCount?: number;
  datasetCount?: number;
  publishedVersionNumber?: number;
  
  // Analysis-specific
  analysisStatus?: string;
  
  // Dataset-specific
  sourceType?: string;
  importMode?: string;
  rowCount?: number;
  columnCount?: number;
  sizeInBytes?: number;
  refreshSchedules?: any[];
  refreshScheduleCount?: number;
  dataSetRefreshProperties?: any;
  hasRefreshProperties?: boolean;
  DataSetRefreshProperties?: any;
  
  // Datasource-specific
  datasourceStatus?: string;
  connectionMode?: string;
  
  // Folder-specific
  path?: string;
  memberCount?: number;
  
  // User-specific
  email?: string;
  Email?: string;
  role?: string;
  Role?: string;
  activity?: {
    totalActivities?: number;
    lastActive?: string;
    totalViews?: number;
    uniqueViewers?: number;
  };
  groupCount?: number;
  
  // Group-specific
  description?: string;
  Members?: any[];
  assetsCount?: number;
  
  // Enrichment properties (override to make optional)
  enrichmentStatus?: components['schemas']['EnrichmentStatus'];
  
  // Properties from the backend that might be in either format
  [key: string]: any;
}

export type { AssetRow };

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

/**
 * Render date cell with relative time
 */
export const renderDateCell = (date: string | null | undefined) => {
  if (!date) return <Typography variant="body2" color="text.secondary">-</Typography>;
  
  const dateObj = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - dateObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let displayText: string;
  if (diffDays === 0) {
    // Today - show time
    displayText = dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else if (diffDays === 1) {
    displayText = 'Yesterday';
  } else if (diffDays < 7) {
    displayText = `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    displayText = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    displayText = `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    displayText = `${years} year${years > 1 ? 's' : ''} ago`;
  }
  
  return (
    <Tooltip title={dateObj.toLocaleString()}>
      <Typography variant="body2" color="text.secondary">
        {displayText}
      </Typography>
    </Tooltip>
  );
};

/**
 * Format relative date for display
 */
export const formatRelativeDate = (date: string | Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  
  // Format with appropriate decimal places
  if (size >= 100) {
    return `${Math.round(size)} ${sizes[i]}`;
  } else if (size >= 10) {
    return `${size.toFixed(1)} ${sizes[i]}`;
  } else {
    return `${size.toFixed(2)} ${sizes[i]}`;
  }
};

/**
 * Main function to create asset columns with reduced complexity
 */
export const createAssetColumns = (
  assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group',
  navigate: ReturnType<typeof useNavigate>,
  handlers: {
    onPermissionsClick?: (asset: any) => void;
    onTagsClick?: (asset: any) => void;
    onRelatedAssetsClick?: (asset: any, relatedAssets: any[]) => void;
    getRelatedAssetsForAsset?: (assetId: string) => any[];
    onFolderMembersClick?: (folder: any) => void;
    onFoldersClick?: (asset: any) => void;
    onActivityClick?: (asset: any) => void;
    onJsonViewerClick?: (asset: any, assetType: string) => void;
    onUserGroupsClick?: (user: any) => void;
    onGroupMembersClick?: (group: any) => void;
    onGroupAssetsClick?: (group: any) => void;
    onGroupDelete?: (group: any) => void;
    onGroupUpdate?: (group: any) => void;
    onRefreshScheduleClick?: (dataset: any) => void;
    onDefinitionErrorsClick?: (asset: any) => void;
  }
): ColumnConfig[] => {
  // Get base columns
  const baseColumns = generateBaseColumns(assetType, { ...handlers, navigate });
  
  // Get specific columns based on asset type
  const specificColumns = getSpecificColumnsForAssetType(assetType, handlers);
  
  // Add relationship columns if needed
  const relationshipColumns = getRelationshipColumns(assetType, handlers);
  
  // Merge columns with proper ordering
  return mergeColumns(baseColumns, specificColumns, relationshipColumns, assetType);
};

/**
 * Get specific columns for the asset type
 */
function getSpecificColumnsForAssetType(
  assetType: string,
  handlers: any
): ColumnConfig[] {
  switch (assetType) {
    case 'dataset':
      return generateDatasetColumns(handlers);
    case 'folder':
      return generateFolderColumns(handlers);
    case 'user':
      return generateUserColumns(handlers);
    case 'group':
      return generateGroupColumns(handlers);
    case 'datasource':
      return generateDatasourceColumns();
    case 'dashboard':
    case 'analysis':
      return generateDashboardAnalysisColumns(handlers);
    default:
      return [];
  }
}

/**
 * Get relationship columns based on asset type
 */
function getRelationshipColumns(
  assetType: string,
  handlers: any
): ColumnConfig[] {
  const columns: ColumnConfig[] = [];
  
  // Add usedBy column for certain types
  if (!['dashboard', 'folder', 'user', 'group'].includes(assetType)) {
    columns.push(generateUsedByColumn(handlers));
  }
  
  // Add uses column for certain types
  if (!['datasource', 'folder', 'user', 'group'].includes(assetType)) {
    columns.push(generateUsesColumn(handlers));
  }
  
  return columns;
}

/**
 * Merge columns with proper ordering
 */
function mergeColumns(
  baseColumns: ColumnConfig[],
  specificColumns: ColumnConfig[],
  relationshipColumns: ColumnConfig[],
  assetType: string
): ColumnConfig[] {
  // Special handling for groups - insert description right after name
  if (assetType === 'group') {
    const nameIndex = baseColumns.findIndex(col => col.id === 'name');
    if (nameIndex !== -1) {
      const descriptionColumn = specificColumns.find(col => col.id === 'description');
      const otherColumns = specificColumns.filter(col => col.id !== 'description');
      
      if (descriptionColumn) {
        baseColumns.splice(nameIndex + 1, 0, descriptionColumn);
      }
      
      // Add relationship columns
      baseColumns.push(...relationshipColumns);
      
      // Add other group columns at the end
      if (otherColumns.length > 0) {
        baseColumns.push(...otherColumns);
      }
      
      return baseColumns;
    }
  }

  // Find the position to insert specific columns
  let insertIndex = -1;
  
  // Find the position after 'tags' column
  const tagsIndex = baseColumns.findIndex(col => col.id === 'tags');
  if (tagsIndex !== -1) {
    insertIndex = tagsIndex + 1;
  }
  
  // First add relationship columns
  if (insertIndex !== -1 && relationshipColumns.length > 0) {
    baseColumns.splice(insertIndex, 0, ...relationshipColumns);
    insertIndex += relationshipColumns.length;
  } else if (relationshipColumns.length > 0) {
    baseColumns.push(...relationshipColumns);
  }
  
  // Then add specific columns
  if (insertIndex !== -1 && specificColumns.length > 0) {
    baseColumns.splice(insertIndex, 0, ...specificColumns);
  } else if (specificColumns.length > 0) {
    baseColumns.push(...specificColumns);
  }

  return baseColumns;
}