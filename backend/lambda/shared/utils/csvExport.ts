/**
 * CSV Export utility functions
 */

// CSV export constants
const CSV_CONSTANTS = {
  DATE_FORMAT_LENGTH: 10, // YYYY-MM-DD format
} as const;

// Type for fields that can have multiple naming conventions
type FieldVariants = string | string[];

// Column definition with flexible field mapping
export interface CSVColumn {
  header: string;
  field: FieldVariants;
  format?: (value: any) => string;
}

// Asset type configurations
const ASSET_CONFIGS: Record<string, CSVColumn[]> = {
  dashboard: [
    { header: 'Name', field: 'name' },
    { header: 'ID', field: 'id' },
    {
      header: 'Status',
      field: ['dashboardStatus', 'metadata.status', 'status'],
      format: (v) => v || 'Unknown',
    },
    {
      header: 'Last Modified',
      field: ['lastUpdatedTime', 'lastModified', 'metadata.lastUpdatedTime'],
      format: formatDate,
    },
    {
      header: 'Created',
      field: ['createdTime', 'created', 'metadata.createdTime'],
      format: formatDate,
    },
    {
      header: 'Visual Count',
      field: 'visualCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Sheet Count',
      field: 'sheetCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Dataset Count',
      field: 'datasetCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Total Views',
      field: ['activity.totalViews', 'viewStats.last30Days.totalViews', 'viewStats.totalViews'],
      format: (v) => v ?? 0,
    },
    {
      header: 'Unique Viewers',
      field: [
        'activity.uniqueViewers',
        'viewStats.last30Days.uniqueViewers',
        'viewStats.uniqueViewers',
      ],
      format: (v) => v ?? 0,
    },
    {
      header: 'Last Viewed',
      field: ['activity.lastViewed', 'viewStats.lastViewed'],
      format: formatDate,
    },
    { header: 'Tags', field: 'tags', format: formatTags },
  ],

  dataset: [
    { header: 'Name', field: 'name' },
    { header: 'ID', field: 'id' },
    {
      header: 'Import Mode',
      field: ['importMode', 'metadata.importMode'],
      format: (v) => v || 'Unknown',
    },
    {
      header: 'Source Type',
      field: ['sourceType', 'metadata.sourceType', 'metadata.datasourceType', 'datasourceType'],
      format: (v) => v || 'Unknown',
    },
    {
      header: 'Last Modified',
      field: ['lastUpdatedTime', 'lastModified', 'metadata.lastUpdatedTime'],
      format: formatDate,
    },
    {
      header: 'Created',
      field: ['createdTime', 'created', 'metadata.createdTime'],
      format: formatDate,
    },
    {
      header: 'Field Count',
      field: 'fieldCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Size (Bytes)',
      field: ['sizeInBytes', 'metadata.consumedSpiceCapacityInBytes'],
      format: (v) => v ?? 0,
    },
    { header: 'Used By', field: 'relatedAssets', format: countRelatedAssets('used_by') },
    { header: 'Uses', field: 'relatedAssets', format: countRelatedAssets('uses') },
    { header: 'Tags', field: 'tags', format: formatTags },
  ],

  analysis: [
    { header: 'Name', field: 'name' },
    { header: 'ID', field: 'id' },
    {
      header: 'Status',
      field: ['dashboardStatus', 'metadata.status', 'status'],
      format: (v) => v || 'Unknown',
    },
    {
      header: 'Last Modified',
      field: ['lastUpdatedTime', 'lastModified', 'metadata.lastUpdatedTime'],
      format: formatDate,
    },
    {
      header: 'Created',
      field: ['createdTime', 'created', 'metadata.createdTime'],
      format: formatDate,
    },
    {
      header: 'Visual Count',
      field: 'visualCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Sheet Count',
      field: 'sheetCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Dataset Count',
      field: 'datasetCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Total Views',
      field: ['activity.totalViews', 'viewStats.totalViews'],
      format: (v) => v ?? 0,
    },
    {
      header: 'Unique Viewers',
      field: ['activity.uniqueViewers', 'viewStats.uniqueViewers'],
      format: (v) => v ?? 0,
    },
    {
      header: 'Last Viewed',
      field: ['activity.lastViewed', 'viewStats.lastViewed'],
      format: formatDate,
    },
    { header: 'Used By', field: 'relatedAssets', format: countRelatedAssets('used_by') },
    { header: 'Uses', field: 'relatedAssets', format: countRelatedAssets('uses') },
    { header: 'Tags', field: 'tags', format: formatTags },
  ],

  datasource: [
    { header: 'Name', field: 'name' },
    { header: 'ID', field: 'id' },
    {
      header: 'Type',
      field: [
        'sourceType',
        'metadata.sourceType',
        'metadata.datasourceType',
        'datasourceType',
        'type',
      ],
      format: (v) => v || 'Unknown',
    },
    {
      header: 'Connection Mode',
      field: ['connectionMode', 'metadata.connectionMode'],
      format: (v) => v || 'Unknown',
    },
    {
      header: 'Last Modified',
      field: ['lastUpdatedTime', 'lastModified', 'metadata.lastUpdatedTime'],
      format: formatDate,
    },
    {
      header: 'Created',
      field: ['createdTime', 'created', 'metadata.createdTime'],
      format: formatDate,
    },
    { header: 'Used By', field: 'relatedAssets', format: countRelatedAssets('used_by') },
    { header: 'Tags', field: 'tags', format: formatTags },
  ],

  user: [
    { header: 'Username', field: ['name', 'userName', 'UserName', 'metadata.userName'] },
    { header: 'Email', field: ['email', 'Email', 'metadata.email', 'metadata.Email'] },
    { header: 'Role', field: ['role', 'Role', 'metadata.role', 'metadata.Role'] },
    {
      header: 'Active',
      field: ['active', 'Active', 'metadata.active'],
      format: (v) => (v !== false ? 'Yes' : 'No'),
    },
    { header: 'Principal ID', field: ['id', 'principalId', 'PrincipalId', 'metadata.principalId'] },
    {
      header: 'Groups',
      field: ['groups', 'metadata.groups'],
      format: (v) => (Array.isArray(v) ? v.join('; ') : ''),
    },
    {
      header: 'Group Count',
      field: 'groupCount',
      format: (v) => v ?? 0,
    },
    {
      header: 'Total Activities',
      field: ['activity.totalActivities'],
      format: (v) => v ?? 0,
    },
    {
      header: 'Last Active',
      field: ['activity.lastActive', 'lastActivityTime', 'metadata.lastActivityTime'],
      format: formatDate,
    },
    {
      header: 'Created',
      field: ['createdTime', 'created', 'metadata.createdTime'],
      format: formatDate,
    },
    { header: 'Tags', field: 'tags', format: formatTags },
  ],

  folder: [
    { header: 'Name', field: ['name', 'Name', 'Folder.Name', 'metadata.Name'] },
    { header: 'ID', field: ['id', 'FolderId', 'Folder.FolderId', 'metadata.FolderId'] },
    {
      header: 'Type',
      field: ['type', 'FolderType', 'Folder.FolderType', 'metadata.FolderType'],
      format: (v) => v || 'SHARED',
    },
    {
      header: 'Path',
      field: ['path', 'metadata.fullPath'],
      format: (v) => v || '/',
    },
    {
      header: 'Parent ID',
      field: ['parentId', 'metadata.parentId'],
    },
    {
      header: 'Created',
      field: [
        'createdTime',
        'created',
        'CreatedTime',
        'Folder.CreatedTime',
        'metadata.CreatedTime',
        'metadata.Folder.CreatedTime',
      ],
      format: formatDate,
    },
    {
      header: 'Last Modified',
      field: [
        'lastUpdatedTime',
        'lastModified',
        'LastUpdatedTime',
        'Folder.LastUpdatedTime',
        'metadata.LastUpdatedTime',
      ],
      format: formatDate,
    },
    {
      header: 'Permissions',
      field: ['permissions', 'Permissions'],
      format: (v) => {
        const count = (v || []).length;
        return count === 1 ? '1 permission' : `${count} permissions`;
      },
    },
    {
      header: 'Members',
      field: [
        'memberCount',
        'MemberCount',
        'Folder.MemberCount',
        'metadata.memberCount',
        'metadata.MemberCount',
      ],
      format: (v) => v ?? 0,
    },
    { header: 'Tags', field: ['tags', 'Tags'], format: formatTags },
  ],

  group: [
    { header: 'Name', field: ['name', 'groupName', 'GroupName'] },
    { header: 'ID', field: 'id' },
    {
      header: 'Description',
      field: ['description', 'metadata.description'],
    },
    {
      header: 'Created',
      field: ['createdTime', 'created', 'metadata.createdTime'],
      format: formatDate,
    },
    {
      header: 'Last Modified',
      field: ['lastUpdatedTime', 'lastModified', 'metadata.lastUpdatedTime'],
      format: formatDate,
    },
    {
      header: 'Member Count',
      field: ['memberCount', 'metadata.memberCount'],
      format: (v) => v ?? 0,
    },
    {
      header: 'Assets Count',
      field: 'assetsCount',
      format: (v) => v ?? 0,
    },
    { header: 'Tags', field: 'tags', format: formatTags },
  ],
};

// Helper functions
function formatDate(value: any): string {
  if (!value) {
    return '';
  }
  try {
    return new Date(value).toISOString();
  } catch {
    return '';
  }
}

function formatTags(tags: any): string {
  if (!Array.isArray(tags)) {
    return '';
  }
  return tags
    .map((t: any) => `${t.Key || t.key || ''}:${t.Value || t.value || ''}`)
    .filter((t) => t !== ':')
    .join('; ');
}

function countRelatedAssets(type: 'used_by' | 'uses') {
  return (relatedAssets: any): string => {
    if (!relatedAssets) {
      return '0';
    }

    // Handle new format (array)
    if (Array.isArray(relatedAssets)) {
      return String(relatedAssets.filter((r: any) => r.relationshipType === type).length);
    }

    // Handle old format (object with arrays)
    const key = type === 'used_by' ? 'usedBy' : 'uses';
    return String(relatedAssets[key]?.length || 0);
  };
}

// Get nested property value using dot notation
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Get value from object trying multiple field paths
function getValue(obj: any, field: FieldVariants): any {
  if (typeof field === 'string') {
    return getNestedValue(obj, field);
  }

  // Try each field variant until we find a value
  for (const f of field) {
    const value = getNestedValue(obj, f);
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

/**
 * Generate CSV content from data
 */
export function generateCSV(data: any[], assetType: string): string {
  const columns = ASSET_CONFIGS[assetType] || getGenericColumns();

  if (!data || data.length === 0) {
    return columns.map((col) => `"${col.header}"`).join(',');
  }

  // Header row
  const headers = columns.map((col) => `"${col.header}"`).join(',');

  // Data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const rawValue = getValue(item, col.field);
        const value = col.format ? col.format(rawValue) : rawValue;

        // Handle null/undefined
        if (value === null || value === undefined) {
          return '""';
        }

        // Format based on type
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }

        // Numbers and booleans don't need quotes
        return String(value);
      })
      .join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Generate filename with timestamp
 */
export function generateCSVFilename(prefix: string): string {
  const date = new Date().toISOString().slice(0, CSV_CONSTANTS.DATE_FORMAT_LENGTH);
  return `quicksight_${prefix}_export_${date}.csv`;
}

/**
 * Get columns for a specific asset type
 */
export function getAssetColumns(assetType: string): CSVColumn[] {
  return ASSET_CONFIGS[assetType] || getGenericColumns();
}

// Generic columns for unknown asset types
function getGenericColumns(): CSVColumn[] {
  return [
    { header: 'ID', field: 'id' },
    { header: 'Name', field: 'name' },
    { header: 'Type', field: 'type' },
    { header: 'Last Modified', field: 'lastModified', format: formatDate },
    { header: 'Created', field: 'created', format: formatDate },
    { header: 'Tags', field: 'tags', format: formatTags },
  ];
}
