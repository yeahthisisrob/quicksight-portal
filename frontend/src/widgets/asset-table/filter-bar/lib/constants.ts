import type {
  ActivityFilterState,
  DateFieldOption,
  DateFilterState,
  DateRangeOption,
  ErrorFilterState,
  ImportModeFilterState,
  SmusFilterState,
} from './types';

export const DATE_FIELD_OPTIONS: Array<{ value: DateFieldOption; label: string }> = [
  { value: 'lastUpdatedTime', label: 'Last Modified' },
  { value: 'createdTime', label: 'Created' },
  { value: 'lastActivity', label: 'Last Activity' },
];

export const DATE_RANGE_OPTIONS: Array<{ value: DateRangeOption; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export const DEFAULT_DATE_FILTER: DateFilterState = {
  field: 'lastUpdatedTime',
  range: 'all',
};

export const DEFAULT_ERROR_FILTER: ErrorFilterState = 'all';

export const DEFAULT_ACTIVITY_FILTER: ActivityFilterState = 'all';

export const DEFAULT_SMUS_FILTER: SmusFilterState = 'all';

export const DEFAULT_IMPORT_MODE_FILTER: ImportModeFilterState = 'all';
