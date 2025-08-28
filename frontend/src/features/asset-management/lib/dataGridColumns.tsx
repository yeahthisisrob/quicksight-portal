import { Visibility as ViewIcon } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { RelatedAssetsColumn , Permission, PermissionsCell } from '@/entities/asset';
import { TagsCell } from '@/entities/tag';

import { 
  createDateRenderer, 
  createPermissionsValueGetter, 
  createTagsValueGetter 
} from '@/shared/lib/dataGridHelpers';

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
    
    return (
      <PermissionsCell
        permissions={permissions}
        onClick={() => onCellClick(params.row)}
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
      <TagsCell
        tags={tags}
        onClick={() => onCellClick(params.row)}
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
  renderCell: (params) => (
    <RelatedAssetsColumn
      asset={params.row}
      onClick={() => {
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
        
        onCellClick(params.row, relatedAssets);
      }}
    />
  ),
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
    
    return relatedAssets.join(' ');
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