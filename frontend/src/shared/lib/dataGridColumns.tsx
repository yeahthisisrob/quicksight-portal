import { Visibility as ViewIcon } from '@mui/icons-material';
import { IconButton, Tooltip, Chip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { 
  createDateRenderer, 
  createPermissionsValueGetter, 
  createTagsValueGetter 
} from './dataGridHelpers';

// Local types to avoid boundary violations
interface Permission {
  principal: string;
  principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
  actions: string[];
}

// Interface for Tag type (defined locally to avoid boundary violations)

/**
 * Common column configurations for asset data grids
 */

export const createLastUpdatedColumn = (
  field: string = 'lastExportTime',
  headerName: string = 'Last Updated',
  width: number = 180
): GridColDef => ({
  field,
  headerName,
  width,
  renderCell: createDateRenderer(),
});

/**
 * Simple pass-through since backend now handles normalization
 */
export const normalizePermissions = (rawPermissions: any[]): Permission[] => {
  return rawPermissions || [];
};

export const createPermissionsColumn = (
  onCellClick: (row: any) => void,
  width: number = 140
): GridColDef => ({
  field: 'permissions',
  headerName: 'Permissions',
  width,
  renderCell: (params) => {
    const permissions = normalizePermissions(params.row.permissions || []);
    const userCount = permissions.filter(p => p.principalType === 'USER').length;
    const groupCount = permissions.filter(p => p.principalType === 'GROUP').length;
    const namespaceCount = permissions.filter(p => p.principalType === 'NAMESPACE').length;
    const publicCount = permissions.filter(p => p.principalType === 'PUBLIC').length;
    
    const parts: string[] = [];
    if (userCount > 0) parts.push(`${userCount}U`);
    if (groupCount > 0) parts.push(`${groupCount}G`);
    if (namespaceCount > 0) parts.push(`${namespaceCount}N`);
    if (publicCount > 0) parts.push(`${publicCount}P`);
    
    return (
      <Chip
        label={parts.length > 0 ? parts.join(' ') : '0'}
        size="small"
        onClick={() => onCellClick(params.row)}
        sx={{ cursor: 'pointer' }}
      />
    );
  },
  valueGetter: createPermissionsValueGetter(),
});

export const createTagsColumn = (
  onCellClick: (row: any) => void,
  width: number = 180
): GridColDef => ({
  field: 'tags',
  headerName: 'Tags',
  width,
  renderCell: (params) => {
    const tags = params.row.tags || [];
    
    return (
      <Chip
        label={`${tags.length} tags`}
        size="small"
        onClick={() => onCellClick(params.row)}
        sx={{ cursor: 'pointer' }}
      />
    );
  },
  valueGetter: createTagsValueGetter(),
});

export const createRelatedAssetsColumn = (
  onCellClick: (row: any, relatedAssets: any[]) => void,
  flex: number = 0.8,
  minWidth: number = 200
): GridColDef => ({
  field: 'relatedAssets',
  headerName: 'Related Assets',
  flex,
  minWidth,
  renderCell: (params) => {
    let relatedAssets: any[] = [];
    
    if (Array.isArray(params.row.relatedAssets)) {
      // New flat array format
      relatedAssets = params.row.relatedAssets;
    } else if (params.row.relatedAssets) {
      // Old object format with usedBy and uses - convert to flat array
      const usedByAssets = params.row.relatedAssets.usedBy || [];
      const usesAssets = params.row.relatedAssets.uses || [];
      relatedAssets = [...usedByAssets, ...usesAssets];
    }
    
    return (
      <Chip
        label={`${relatedAssets.length} related`}
        size="small"
        onClick={() => onCellClick(params.row, relatedAssets)}
        sx={{ cursor: 'pointer' }}
      />
    );
  },
  valueGetter: (params) => {
    let relatedAssets: any[] = [];
    
    if (Array.isArray(params.row.relatedAssets)) {
      relatedAssets = params.row.relatedAssets;
    } else if (params.row.relatedAssets) {
      const usedByAssets = params.row.relatedAssets.usedBy || [];
      const usesAssets = params.row.relatedAssets.uses || [];
      relatedAssets = [...usedByAssets, ...usesAssets];
    }
    
    if (!relatedAssets || relatedAssets.length === 0) {
      return '';
    }
    
    return relatedAssets.length.toString();
  },
});

export const createActionsColumn = (
  onView: (row: any) => void,
  headerName: string = 'Actions',
  width: number = 100,
  tooltipTitle: string = 'View Details'
): GridColDef => ({
  field: 'actions',
  headerName,
  width,
  sortable: false,
  renderCell: (params) => (
    <Tooltip title={tooltipTitle}>
      <IconButton
        size="small"
        onClick={() => onView(params.row)}
      >
        <ViewIcon />
      </IconButton>
    </Tooltip>
  ),
});

/**
 * Create a date column with custom formatting
 */
export const createDateColumn = (
  field: string,
  headerName: string,
  dateFormat: string = 'PPpp',
  showRelative: boolean = true,
  width: number = 180
): GridColDef => ({
  field,
  headerName,
  width,
  renderCell: createDateRenderer(dateFormat, showRelative),
});