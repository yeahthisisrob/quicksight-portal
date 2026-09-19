/**
 * Design system public API.
 *
 *   tokens/      the source of truth (colours by purpose, space, radius, type)
 *   createAppTheme  the MUI theme built from the tokens, light and dark
 *   components/  primitives: Container, PageHeader, StatusIndicator,
 *                KeyValuePairs, EmptyState, SegmentedControl, TabBar
 *   theme.ts     deprecated aliases kept so older code keeps working
 *
 * See README.md in this folder for the standard.
 */

// Components
export * from './components/Container';
export * from './components/EmptyState';
export * from './components/KeyValuePairs';
export * from './components/PageHeader';
export * from './components/SegmentedControl';
export * from './components/StatusIndicator';
export * from './components/TabBar';
export * from './components/TableContainer';
// Constants
export * from './constants/layout';
export * from './constants/table';
// Theme
export { createAppTheme, pal, tint } from './createAppTheme';
export * from './hooks/useAvailableHeight';
// Hooks
export * from './hooks/useTableStyles';
export type { TableConfigContextValue } from './providers/TableConfigContext';
export { useTableConfig } from './providers/TableConfigContext';
// Providers
export { TableConfigProvider } from './providers/TableConfigProvider';
// Deprecated aliases (light scheme only) - see theme.ts
export * from './theme';
// Tokens
export * as tokens from './tokens';
