/**
 * Layout constants for consistent spacing and sizing across the application
 * These values should be used instead of hardcoded values for maintainability
 */

export const LAYOUT = {
  header: {
    height: 64,
    mobileHeight: 56,
  },
  sidebar: {
    width: 240,
    collapsedWidth: 64,
  },
  footer: {
    height: 48,
  },
  pageMargin: {
    top: 24,
    bottom: 24,
    horizontal: 32,
  },
  table: {
    minHeight: 400,
    maxHeightVh: 90, // Increased from 80
    headerOffset: 160, // Reduced from 240 - accounts for header (64) + page margins + some padding
    scrollbar: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
  },
} as const;

/**
 * Breakpoint-aware spacing
 */
export const RESPONSIVE_SPACING = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Z-index layers for consistent stacking
 */
export const Z_INDEX = {
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
} as const;