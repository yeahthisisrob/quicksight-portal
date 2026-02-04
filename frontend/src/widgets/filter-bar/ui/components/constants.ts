import {
  Dashboard as DashboardIcon,
  Analytics as AnalysisIcon,
  Storage as DatasetIcon,
} from '@mui/icons-material';

import { colors } from '@/shared/design-system/theme';

import { DATE_FIELD_OPTIONS, DATE_RANGE_OPTIONS } from '../../lib/constants';

import type { DateFilterState } from '../../lib/types';

// ============================================================================
// Constants
// ============================================================================

export const ASSET_KEY = '__ASSET__';

export const ASSET_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  dashboard: { icon: DashboardIcon, color: '#1976d2' },
  analysis: { icon: AnalysisIcon, color: '#9c27b0' },
  dataset: { icon: DatasetIcon, color: '#2e7d32' },
};

export const CHIP_STYLES = {
  small: { height: 18, fontSize: '0.65rem' },
  medium: { height: 20, fontSize: '0.7rem' },
  withIcon: { '& .MuiChip-icon': { marginLeft: '4px' } },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export const getAssetConfig = (type: string) =>
  ASSET_TYPE_CONFIG[type] || { icon: DatasetIcon, color: colors.neutral[500] };

export const truncateText = (text: string, maxLength: number) =>
  text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

export const getDateFilterLabel = (filter: DateFilterState) => {
  const field = DATE_FIELD_OPTIONS.find((f) => f.value === filter.field)?.label || filter.field;
  const range = DATE_RANGE_OPTIONS.find((r) => r.value === filter.range)?.label || filter.range;
  return `${field}: ${range}`;
};
