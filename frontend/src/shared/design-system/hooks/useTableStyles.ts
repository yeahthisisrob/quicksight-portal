import { alpha } from '@mui/material';
import { useMemo } from 'react';

import { LAYOUT } from '../constants/layout';
import { TABLE_CONFIG } from '../constants/table';
import { colors, spacing } from '../theme';

export interface TableStyleOptions {
  variant?: 'default' | 'striped' | 'bordered' | 'hover';
  density?: 'compact' | 'comfortable' | 'spacious';
  stickyHeader?: boolean;
  height?: string | number;
  fullHeight?: boolean;
}

/**
 * Hook to generate consistent table styles based on design system
 */
export const useTableStyles = (options: TableStyleOptions = {}) => {
  const {
    variant = 'default',
    density = 'comfortable',
    stickyHeader = false,
    height,
    fullHeight = true,
  } = options;

  return useMemo(() => {
    const densityConfig = TABLE_CONFIG.density[density];
    
    // Calculate dynamic height if fullHeight is true
    // This leaves minimal space at the bottom for better space utilization
    const calculatedHeight = fullHeight
      ? `calc(100vh - ${LAYOUT.table.headerOffset}px)`
      : height || 'auto';

    return {
      container: {
        borderRadius: `${spacing.md / 8}px`,
        overflow: 'hidden',
        boxShadow: `0 1px 3px ${alpha(colors.neutral[900], 0.05)}, 0 1px 2px ${alpha(colors.neutral[900], 0.1)}`,
        border: `1px solid ${colors.neutral[200]}`,
        bgcolor: 'white',
        height: calculatedHeight,
        minHeight: LAYOUT.table.minHeight,
        maxHeight: `${LAYOUT.table.maxHeightVh}vh`,
        display: 'flex',
        flexDirection: 'column' as const,
      },
      
      dataGrid: {
        border: 'none',
        flex: 1,
        height: '100%',
        
        '& .MuiDataGrid-main': {
          borderRadius: 0,
          overflow: 'hidden',
        },
        
        '& .MuiDataGrid-cell': {
          borderBottom: `1px solid ${colors.neutral[100]}`,
          py: densityConfig.padding / 8,
          fontSize: densityConfig.fontSize,
        },
        
        '& .MuiDataGrid-columnHeaders': {
          backgroundColor: colors.neutral[50],
          borderBottom: `2px solid ${colors.neutral[200]}`,
          borderRadius: 0,
          minWidth: 'max-content',
          ...(stickyHeader && {
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }),
        },
        
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 600,
          color: colors.neutral[700],
        },
        
        '& .MuiDataGrid-row': {
          display: 'flex !important',
          minHeight: densityConfig.rowHeight,
          
          ...(variant === 'hover' && {
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.04),
            },
          }),
          
          ...(variant === 'striped' && {
            '&:nth-of-type(even)': {
              backgroundColor: colors.neutral[50],
            },
          }),
          
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.main, 0.08),
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.12),
            },
          },
        },
        
        '& .MuiDataGrid-virtualScroller': {
          overflowX: 'auto',
          overflowY: 'auto',
          
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: LAYOUT.table.scrollbar.width,
            height: LAYOUT.table.scrollbar.height,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: colors.neutral[50],
            borderRadius: LAYOUT.table.scrollbar.borderRadius,
            border: `1px solid ${colors.neutral[200]}`,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: colors.neutral[400],
            borderRadius: LAYOUT.table.scrollbar.borderRadius,
            border: `2px solid ${colors.neutral[50]}`,
            '&:hover': {
              backgroundColor: colors.neutral[500],
            },
            '&:active': {
              backgroundColor: colors.neutral[600],
            },
          },
          '&::-webkit-scrollbar-corner': {
            backgroundColor: colors.neutral[50],
          },
          
          // Firefox scrollbar styling
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.neutral[400]} ${colors.neutral[50]}`,
        },
        
        '& .MuiDataGrid-virtualScrollerContent': {
          minWidth: 'max-content',
        },
        
        '& .MuiDataGrid-virtualScrollerRenderZone': {
          minWidth: '100%',
        },
        
        '& .MuiDataGrid-footerContainer': {
          borderTop: `1px solid ${colors.neutral[200]}`,
          backgroundColor: colors.neutral[50],
        },
      },
    };
  }, [variant, density, stickyHeader, height, fullHeight]);
};