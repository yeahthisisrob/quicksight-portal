/**
 * Base column definitions shared across all asset types
 */
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';

import { PermissionsCell } from '@/entities/asset';
import { FoldersCell } from '@/entities/folder';
import { TagsCell } from '@/entities/tag';

import { renderDateCell, copyToClipboard, type AssetRow } from './createAssetColumns';
import { ACTIONS_WIDTH } from './tableStyles';
import { ActionsDropdown } from '../ui/ActionsDropdown';

import type { ColumnConfig } from '@/features/asset-management';
import type { NavigateFunction } from 'react-router-dom';

type BaseHandlers = {
  onPermissionsClick?: (asset: any) => void;
  onTagsClick?: (asset: any) => void;
  onFoldersClick?: (asset: any) => void;
  onJsonViewerClick?: (asset: any, assetType: string) => void;
  navigate: NavigateFunction;
};

/**
 * Generate the base columns present in all asset tables
 */
export function generateBaseColumns(
  assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group',
  handlers: BaseHandlers & Record<string, any>
): ColumnConfig[] {
  const columns: ColumnConfig[] = [];

  // Actions column - always first
  columns.push({
    id: 'actions',
    label: ' ',
    width: ACTIONS_WIDTH,
    sortable: false,
    filterable: false,
    hideable: false,
    required: true,
    visible: true,
    renderCell: (params) => (
      <ActionsDropdown 
        asset={params.row} 
        assetType={assetType}
        handlers={{ ...handlers, navigate: handlers.navigate }}
      />
    ),
  });

  // Name column - always second
  columns.push({
    id: 'name',
    label: 'Name',
    flex: assetType === 'group' ? 2 : 4,
    minWidth: assetType === 'group' ? 150 : 250,
    required: true,
    visible: true,
    renderCell: (params) => (
      <Tooltip title={params.value || 'Unnamed'}>
        <Typography 
          variant="body2" 
          sx={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' }
          }}
          onClick={() => handlers.navigate(`/assets/${assetType}s/${params.row.id}`)}
        >
          {params.value || 'Unnamed'}
        </Typography>
      </Tooltip>
    ),
  });

  // ID column (not for groups)
  if (assetType !== 'group') {
    columns.push({
      id: 'id',
      label: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} ID`,
      flex: 1,
      minWidth: 200,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const fullId = params.value || '';
        const shortId = fullId.length > 15 
          ? `${fullId.slice(0, 8)}...${fullId.slice(-4)}`
          : fullId;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={fullId}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {shortId}
              </Typography>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => copyToClipboard(fullId)}
              sx={{ padding: '2px' }}
            >
              <CopyIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Box>
        );
      },
    });
  }

  // Enrichment status
  columns.push({
    id: 'enrichmentStatus',
    label: 'Enrichment',
    width: 120,
    visible: false,
    renderCell: (params: { row: AssetRow }) => {
      const status = params.row.enrichmentStatus || 'skeleton';
      const color = status === 'enriched' ? 'success' : 
                   status === 'partial' ? 'warning' : 
                   'default';
      const label = status === 'enriched' ? 'Enriched' :
                    status === 'partial' ? 'Partial' :
                    'Skeleton';
      return <Chip label={label} size="small" color={color} />;
    },
    valueGetter: (params: { row: AssetRow }) => params.row.enrichmentStatus || 'skeleton',
    sortable: true,
  });

  // Date columns (not for users/groups)
  if (assetType !== 'user' && assetType !== 'group') {
    columns.push({
      id: 'lastModified',
      label: 'Last Modified',
      width: 140,
      visible: true,
      sortable: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        return renderDateCell(params.row.lastUpdatedTime);
      },
      valueGetter: (params: { row: AssetRow }) => {
        const date = params.row.lastUpdatedTime;
        return date ? new Date(date).getTime() : 0;
      },
    });

    columns.push({
      id: 'createdTime',
      label: 'Created',
      width: 140,
      visible: true,
      sortable: true,
      renderCell: (params) => renderDateCell(params.row.createdTime),
      valueGetter: (params: { row: AssetRow }) => {
        return params.row.createdTime ? new Date(params.row.createdTime).getTime() : 0;
      },
    });
  }

  // Permissions column (not for groups)
  if (assetType !== 'group') {
    columns.push({
      id: 'permissions',
      label: 'Permissions',
      width: 140,
      visible: true,
      renderCell: (params: { row: AssetRow; value: any }) => {
        const rawPermissions = params.row.permissions || [];
        const permissions = rawPermissions.map((p: any) => ({
          principal: p.Principal || p.principal,
          principalType: p.PrincipalType || p.principalType || 'USER',
          actions: p.Actions || p.actions || []
        }));
        
        return (
          <PermissionsCell
            permissions={permissions}
            onClick={handlers.onPermissionsClick ? () => handlers.onPermissionsClick!(params.row) : undefined}
          />
        );
      },
      valueGetter: (params: { row: AssetRow }) => {
        const permissions = params.row.permissions || [];
        const userCount = permissions.filter((p: any) => 
          (p.PrincipalType || p.principalType) === 'USER'
        ).length;
        const groupCount = permissions.filter((p: any) => 
          (p.PrincipalType || p.principalType) === 'GROUP'
        ).length;
        return `${userCount} users ${groupCount} groups`;
      },
    });
  }

  // Tags column
  columns.push({
    id: 'tags',
    label: 'Tags',
    width: 180,
    visible: true,
    renderCell: (params) => (
      <TagsCell
        tags={params.row.tags || []}
        onClick={() => handlers.onTagsClick?.(params.row)}
      />
    ),
    valueGetter: (params: { row: AssetRow }) => {
      const tags = params.row.tags || [];
      return tags.map((t: any) => `${t.Key}:${t.Value}`).join(' ');
    },
  });

  // Folders column (for certain asset types)
  if (['dashboard', 'analysis', 'dataset', 'datasource'].includes(assetType)) {
    columns.push({
      id: 'folders',
      label: 'Folders',
      width: 100,
      visible: true,
      sortable: true,
      renderCell: (params: { row: AssetRow }) => (
        <FoldersCell
          folders={params.row.folders || []}
          folderCount={params.row.folderCount}
          onClick={() => handlers.onFoldersClick?.(params.row)}
        />
      ),
      valueGetter: (params: { row: AssetRow }) => {
        return params.row.folderCount || 0;
      },
    });
  }

  return columns;
}