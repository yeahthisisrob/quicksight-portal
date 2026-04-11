import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  type SelectChangeEvent,
} from '@mui/material';
import { subDays } from 'date-fns';

import type { TimelineFilters } from '../hooks/useActivityTimeline';

/**
 * Timeline date range options — locally defined so this feature slice doesn't
 * import from `widgets/filter-bar` (FSD forbids features → widgets). Kept
 * compatible with the naming used in DATE_RANGE_OPTIONS elsewhere so a future
 * shared constant can drop in without a type change.
 */
export type TimelineDateRange = '24h' | '7d' | '30d' | '90d' | 'all';

const DATE_RANGE_OPTIONS: Array<{ value: TimelineDateRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

/** Resource type options — matches backend TimelineResourceType. */
const RESOURCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'datasource', label: 'Data source' },
  { value: 'folder', label: 'Folder' },
  { value: 'group', label: 'Group' },
  { value: 'user', label: 'User' },
  { value: 'other', label: 'Other (settings, templates, themes...)' },
];

/** Action category options — matches backend ActionCategory. */
const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'publish', label: 'Publish' },
  { value: 'grant', label: 'Grant permissions' },
  { value: 'revoke', label: 'Revoke permissions' },
  { value: 'member', label: 'Membership' },
  { value: 'tag', label: 'Tag' },
  { value: 'job', label: 'Job' },
  { value: 'batch', label: 'Batch' },
];

/** Translate a TimelineDateRange into startDate ISO for the query. */
function dateRangeToStartDate(range: TimelineDateRange): string | undefined {
  const now = new Date();
  switch (range) {
    case '24h':
      return subDays(now, 1).toISOString();
    case '7d':
      return subDays(now, 7).toISOString();
    case '30d':
      return subDays(now, 30).toISOString();
    case '90d':
      return subDays(now, 90).toISOString();
    case 'all':
    default:
      return undefined;
  }
}

export interface TimelineFilterBarProps {
  filters: TimelineFilters;
  onChange: (next: TimelineFilters) => void;
  /** When true, hide the resource-type filter (used on per-asset drill-down pages). */
  hideResourceTypes?: boolean;
  /** Current date range selection (stored outside filters to keep filters serializable). */
  dateRange: TimelineDateRange;
  onDateRangeChange: (next: TimelineDateRange) => void;
}

/**
 * Lightweight filter bar for the activity timeline — lives alongside (not
 * extracted from) the main FilterControls widget on purpose. The main
 * FilterControls is DataGrid-coupled; this one is feed-coupled.
 */
export function TimelineFilterBar({
  filters,
  onChange,
  hideResourceTypes = false,
  dateRange,
  onDateRangeChange,
}: TimelineFilterBarProps) {
  const handleResourceTypes = (e: SelectChangeEvent<string[]>) => {
    const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
    onChange({ ...filters, resourceTypes: value.length > 0 ? value : undefined });
  };

  const handleActions = (e: SelectChangeEvent<string[]>) => {
    const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
    onChange({ ...filters, actions: value.length > 0 ? value : undefined });
  };

  const handleDateRange = (e: SelectChangeEvent<string>) => {
    const range = e.target.value as TimelineDateRange;
    onDateRangeChange(range);
    onChange({ ...filters, startDate: dateRangeToStartDate(range) });
  };

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      flexWrap="wrap"
      sx={{ py: 1.5, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="timeline-date-range-label">Date range</InputLabel>
        <Select
          labelId="timeline-date-range-label"
          label="Date range"
          value={dateRange}
          onChange={handleDateRange}
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!hideResourceTypes && (
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="timeline-resource-types-label">Resource type</InputLabel>
          <Select
            labelId="timeline-resource-types-label"
            label="Resource type"
            multiple
            value={filters.resourceTypes ?? []}
            onChange={handleResourceTypes}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((v) => {
                  const opt = RESOURCE_TYPE_OPTIONS.find((o) => o.value === v);
                  return <Chip key={v} size="small" label={opt?.label ?? v} />;
                })}
              </Box>
            )}
          >
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="timeline-actions-label">Action</InputLabel>
        <Select
          labelId="timeline-actions-label"
          label="Action"
          multiple
          value={filters.actions ?? []}
          onChange={handleActions}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((v) => {
                const opt = ACTION_OPTIONS.find((o) => o.value === v);
                return <Chip key={v} size="small" label={opt?.label ?? v} />;
              })}
            </Box>
          )}
        >
          {ACTION_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
