/**
 * Table-specific design tokens and configuration
 */

export const TABLE_CONFIG = {
  density: {
    compact: {
      rowHeight: 36,
      fontSize: 12,
      padding: 4,
    },
    comfortable: {
      rowHeight: 52,
      fontSize: 14,
      padding: 8,
    },
    spacious: {
      rowHeight: 68,
      fontSize: 14,
      padding: 12,
    },
  },
  pagination: {
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    maxPageSize: 100,
  },
  column: {
    minWidth: 100,
    defaultWidth: 150,
    actionsWidth: 50,
  },
  sorting: {
    defaultDirection: 'asc' as const,
    multiSort: false,
  },
  virtualization: {
    overscan: 3,
    scrollDebounce: 150,
  },
} as const;

export const TABLE_VARIANTS = {
  default: 'default',
  striped: 'striped',
  bordered: 'bordered',
  hover: 'hover',
} as const;

export type TableVariant = keyof typeof TABLE_VARIANTS;
export type TableDensity = keyof typeof TABLE_CONFIG.density;