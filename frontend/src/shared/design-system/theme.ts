/**
 * Design System Theme Configuration
 * This file contains all the design tokens used across the application
 */

export const colors = {
  // Primary Colors
  primary: {
    main: '#3B82F6',
    light: '#93C5FD',
    dark: '#1E40AF',
  },
  
  // Asset Type Colors (matching your existing config)
  assetTypes: {
    dashboard: {
      main: '#10B981', // Green
      light: '#D1FAE5',
      dark: '#047857',
    },
    analysis: {
      main: '#8B5CF6', // Purple
      light: '#EDE9FE',
      dark: '#6D28D9',
    },
    dataset: {
      main: '#3B82F6', // Blue
      light: '#DBEAFE',
      dark: '#1D4ED8',
    },
    datasource: {
      main: '#F59E0B', // Amber
      light: '#FEF3C7',
      dark: '#D97706',
    },
    folder: {
      main: '#6B7280', // Gray
      light: '#F3F4F6',
      dark: '#374151',
    },
    user: {
      main: '#EC4899', // Pink
      light: '#FCE7F3',
      dark: '#BE185D',
    },
    group: {
      main: '#14B8A6', // Teal
      light: '#CCFBF1',
      dark: '#0F766E',
    },
    namespace: {
      main: '#9c27b0', // Purple
      light: '#e1bee7',
      dark: '#6a1b9a',
    },
    public: {
      main: '#2196f3', // Blue
      light: '#bbdefb',
      dark: '#1565c0',
    },
  },
  
  // Status Colors
  status: {
    success: '#10B981',
    successLight: '#86EFAC',
    successDark: '#047857',
    warning: '#F59E0B',
    warningLight: '#FCD34D',
    warningDark: '#92400E',
    error: '#EF4444',
    errorLight: '#FCA5A5',
    errorDark: '#991B1B',
    info: '#3B82F6',
    infoLight: '#93C5FD',
    infoDark: '#1E40AF',
  },
  
  // Neutral Colors (grayscale)
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  
  // Background Colors
  background: {
    default: '#FFFFFF',
    paper: '#FAFAFA',
    subtle: '#F5F5F5',
    hover: '#E5E5E5',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  fontFamily: {
    primary: '"Roboto", "Helvetica", "Arial", sans-serif',
    monospace: '"Roboto Mono", "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: '9999px',
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

export const transitions = {
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
};

// Component-specific styles
export const components = {
  dialog: {
    borderRadius: borderRadius.lg,
    maxHeight: '80vh',
  },
  
  chip: {
    height: {
      small: 20,
      medium: 24,
      large: 32,
    },
  },
  
  paper: {
    hover: {
      transform: 'translateX(4px)',
      transition: `all ${transitions.normal} ${transitions.easing.easeInOut}`,
    },
  },
};
