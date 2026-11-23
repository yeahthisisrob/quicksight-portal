import type { Theme } from '@mui/material/styles';

import { components, pal, tint } from '@/shared/design-system';

export const ACTIONS_WIDTH = 50; // Width for the actions column

/**
 * The asset table's look. Every colour is asked of the theme by purpose, so
 * the header, the pinned actions column, the row lines and the footer follow
 * the colour scheme instead of staying light on a dark page.
 */
export const tableStyles = {
  /** The bordered surface the filter bar and the grid sit in. */
  container: (theme: Theme) => ({
    ...components.container,
    border: `1px solid ${pal(theme).line.divider}`,
  }),

  dataGrid: (theme: Theme) => {
    const p = pal(theme);
    return {
      border: 'none',
      '& .MuiDataGrid-main': {
        borderRadius: 0,
      },
      // No padding overrides on cells — density (comfortable/standard/compact)
      // owns row height and cell padding.
      '& .MuiDataGrid-cell': {
        borderBottom: `1px solid ${p.line.divider}`,
      },
      '& .MuiDataGrid-columnHeaders': {
        backgroundColor: p.surface.hover,
        borderBottom: `2px solid ${p.line.divider}`,
        borderRadius: 0,
        minWidth: 'max-content', // Stabilize column layout
      },
      '& .MuiDataGrid-columnHeaderTitle': {
        fontWeight: 600,
        color: p.text.secondary,
      },
      '& .MuiDataGrid-row': {
        display: 'flex !important', // Enable flex for order property
        '&:hover': {
          backgroundColor: tint(p.brand.primary, 4),
        },
        '&.Mui-selected': {
          backgroundColor: tint(p.brand.primary, 8),
          '&:hover': {
            backgroundColor: tint(p.brand.primary, 12),
          },
        },
      },
      '& .MuiDataGrid-footerContainer': {
        borderTop: `1px solid ${p.line.divider}`,
        backgroundColor: p.surface.hover,
      },
      '& .MuiDataGrid-selectedRowCount': {
        color: p.brand.primary,
        fontWeight: 600,
      },
      '& .MuiCheckbox-root': {
        color: p.text.muted,
        '&.Mui-checked': {
          color: p.brand.primary,
        },
        '&:hover': {
          backgroundColor: tint(p.brand.primary, 8),
        },
      },
      '& .MuiDataGrid-menuIcon': {
        '& .MuiSvgIcon-root': {
          color: p.text.muted,
        },
      },
      '& .MuiDataGrid-sortIcon': {
        color: p.brand.primary,
      },
      // Style actions cell and header - position before checkbox
      '& .MuiDataGrid-cell[data-field="actions"]': {
        backgroundColor: p.surface.hover,
        borderRight: `1px solid ${p.line.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        order: -1, // Move before checkbox
        '&:hover': {
          backgroundColor: p.surface.selected,
        },
      },
      '& .MuiDataGrid-columnHeader[data-field="actions"]': {
        backgroundColor: p.surface.hover,
        borderRight: `1px solid ${p.line.divider}`,
        order: -1, // Move before checkbox
        '& .MuiDataGrid-columnSeparator': {
          display: 'none',
        },
        '& .MuiDataGrid-columnHeaderTitleContainer': {
          justifyContent: 'center',
        },
      },
      '& .MuiDataGrid-virtualScrollerContent': {
        minWidth: 'max-content',
      },
      // Ensure horizontal scrolling works properly and scrollbar is always visible
      '& .MuiDataGrid-virtualScroller': {
        overflowX: 'scroll',
        '&::-webkit-scrollbar': {
          width: 8, // For vertical scrollbar
          height: 8, // For horizontal scrollbar
          backgroundColor: p.surface.page,
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: p.surface.page,
          borderRadius: 4,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: p.text.muted,
          borderRadius: 4,
          '&:hover': {
            backgroundColor: p.text.secondary,
          },
        },
      },
    };
  },
};
