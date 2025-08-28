import { alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

export const ACTIONS_WIDTH = 50; // Width for the actions column

export const tableStyles = {
  container: {
    borderRadius: `${spacing.md / 8}px`,
    overflow: 'hidden',
    boxShadow: `0 1px 3px ${alpha(colors.neutral[900], 0.05)}, 0 1px 2px ${alpha(colors.neutral[900], 0.1)}`,
    border: `1px solid ${colors.neutral[200]}`,
    bgcolor: 'white',
  },
  
  dataGrid: {
    border: 'none',
    '& .MuiDataGrid-main': {
      borderRadius: 0,
    },
    '& .MuiDataGrid-cell': {
      borderBottom: `1px solid ${colors.neutral[100]}`,
      py: spacing.md / 8,
    },
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: colors.neutral[50],
      borderBottom: `2px solid ${colors.neutral[200]}`,
      borderRadius: 0,
      minWidth: 'max-content', // Stabilize column layout
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 600,
      color: colors.neutral[700],
    },
    '& .MuiDataGrid-row': {
      display: 'flex !important',  // Enable flex for order property
      '&:hover': {
        backgroundColor: alpha(colors.primary.main, 0.04),
      },
      '&.Mui-selected': {
        backgroundColor: alpha(colors.primary.main, 0.08),
        '&:hover': {
          backgroundColor: alpha(colors.primary.main, 0.12),
        },
      },
    },
    '& .MuiDataGrid-footerContainer': {
      borderTop: `1px solid ${colors.neutral[200]}`,
      backgroundColor: colors.neutral[50],
    },
    '& .MuiDataGrid-selectedRowCount': {
      color: colors.primary.main,
      fontWeight: 600,
    },
    '& .MuiCheckbox-root': {
      color: colors.neutral[400],
      '&.Mui-checked': {
        color: colors.primary.main,
      },
      '&:hover': {
        backgroundColor: alpha(colors.primary.main, 0.08),
      },
    },
    '& .MuiDataGrid-menuIcon': {
      '& .MuiSvgIcon-root': {
        color: colors.neutral[400],
      },
    },
    '& .MuiDataGrid-sortIcon': {
      color: colors.primary.main,
    },
    // Style actions cell and header - position before checkbox
    '& .MuiDataGrid-cell[data-field="actions"]': {
      backgroundColor: colors.neutral[50],
      borderRight: `1px solid ${colors.neutral[200]}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      order: -1, // Move before checkbox
      '&:hover': {
        backgroundColor: colors.neutral[100],
      },
    },
    '& .MuiDataGrid-columnHeader[data-field="actions"]': {
      backgroundColor: colors.neutral[50],
      borderRight: `1px solid ${colors.neutral[200]}`,
      order: -1, // Move before checkbox
      '& .MuiDataGrid-columnSeparator': {
        display: 'none',
      },
      '& .MuiDataGrid-columnHeaderTitleContainer': {
        justifyContent: 'center',
      },
    },
    // Enable flex for column headers to make order property work
    '& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeadersInner > div': {
      display: 'flex !important',
    },
    '& .MuiDataGrid-virtualScrollerContent': {
      minWidth: 'max-content',
    },
    // Ensure horizontal scrolling works properly and scrollbar is always visible
    '& .MuiDataGrid-virtualScroller': {
      overflowX: 'scroll',
      '&::-webkit-scrollbar': {
        width: 8,  // For vertical scrollbar
        height: 8, // For horizontal scrollbar
        backgroundColor: colors.neutral[100],
      },
      '&::-webkit-scrollbar-track': {
        backgroundColor: colors.neutral[100],
        borderRadius: 4,
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: colors.neutral[400],
        borderRadius: 4,
        '&:hover': {
          backgroundColor: colors.neutral[500],
        },
      },
    },
  },
} as const;

export const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];