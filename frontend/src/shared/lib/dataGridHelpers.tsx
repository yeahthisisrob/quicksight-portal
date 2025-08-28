import { Tooltip, Typography } from '@mui/material';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import React from 'react';

/**
 * Safe date formatting for DataGrid cells
 * Handles null/undefined values and invalid dates gracefully
 */
export const createDateRenderer = (
  dateFormat: string = 'PPpp',
  showRelative: boolean = true,
  emptyValue: string = '-'
) => {
  return (params: GridRenderCellParams) => {
    if (!params.value) {
      return <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{emptyValue}</Typography>;
    }
    
    const date = new Date(params.value);
    if (!isValid(date)) {
      return <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Invalid date</Typography>;
    }
    
    const formattedDate = format(date, dateFormat);
    const relativeDate = showRelative ? formatDistanceToNow(date, { addSuffix: true }) : formattedDate;
    
    return (
      <Tooltip title={formattedDate}>
        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
          {relativeDate}
        </Typography>
      </Tooltip>
    );
  };
};

/**
 * Safe array join for permissions and similar fields
 * Handles null/undefined values and non-array data gracefully
 */
export const createArrayValueGetter = (
  arrayField: string,
  principalField: string = 'principal',
  actionsField: string = 'actions',
  separator: string = ' '
) => {
  return (params: any) => {
    const items = params.row[arrayField] || [];
    return items.map((item: any) => {
      const principal = item[principalField] || 'Unknown';
      const actions = Array.isArray(item[actionsField]) 
        ? item[actionsField].join(separator) 
        : (item[actionsField] || '');
      return `${principal} ${actions}`.trim();
    }).join(' ');
  };
};

/**
 * Safe permissions value getter
 * Handles various permission formats from different AWS services
 */
export const createPermissionsValueGetter = () => {
  return (params: any) => {
    const permissions = params.row.permissions || [];
    return permissions.map((p: any) => {
      // Handle different permission structures
      const principal = p.principal || p.Principal || 'Unknown';
      
      // Handle different action formats
      let actions = '';
      if (Array.isArray(p.actions)) {
        actions = p.actions.join(' ');
      } else if (Array.isArray(p.Actions)) {
        actions = p.Actions.join(' ');
      } else if (p.permission) {
        actions = p.permission;
      } else if (p.Permission) {
        actions = p.Permission;
      }
      
      return `${principal} ${actions}`.trim();
    }).join(' ');
  };
};

/**
 * Safe tags value getter
 * Handles various tag formats
 */
export const createTagsValueGetter = () => {
  return (params: any) => {
    const tags = params.row.tags || [];
    return tags.map((tag: any) => {
      const key = tag.key || tag.Key || '';
      const value = tag.value || tag.Value || '';
      return key && value ? `${key}:${value}` : '';
    }).filter(Boolean).join(' ');
  };
};

/**
 * Creates a safe cell renderer that handles errors gracefully
 */
export const createSafeCellRenderer = (
  renderer: (params: GridRenderCellParams) => React.ReactNode,
  fallback: React.ReactNode = <Typography variant="body2">-</Typography>
) => {
  return (params: GridRenderCellParams) => {
    try {
      return renderer(params);
    } catch (_error) {
      return fallback;
    }
  };
};