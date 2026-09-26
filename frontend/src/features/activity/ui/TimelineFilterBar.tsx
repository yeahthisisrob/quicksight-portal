/**
 * The feed's controls: the window, what kind of thing, what kind of change,
 * and where the change came from. "Made by agents" is the one-click answer
 * to the question people ask most.
 */
import { SmartToy as AgentIcon } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Switch,
} from '@mui/material';
import { subDays } from 'date-fns';

import { pal, SegmentedControl } from '@/shared/design-system';

import type { TimelineFilters } from '../hooks/useActivityTimeline';
import { AGENT_ORIGINS, ORIGIN_OPTIONS } from '../lib/actorDisplay';

export type TimelineDateRange = '24h' | '7d' | '30d' | '90d' | 'all';

const DATE_RANGE_OPTIONS: Array<{ value: TimelineDateRange; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

const DAYS: Record<Exclude<TimelineDateRange, 'all'>, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const RESOURCE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'datasource', label: 'Data source' },
  { value: 'folder', label: 'Folder' },
  { value: 'group', label: 'Group' },
  { value: 'user', label: 'User' },
  { value: 'other', label: 'Other (settings, templates, themes)' },
];

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

const SELECT_MIN_WIDTH = 180;

/** Translate a TimelineDateRange into startDate ISO for the query. */
export function dateRangeToStartDate(range: TimelineDateRange): string | undefined {
  return range === 'all' ? undefined : subDays(new Date(), DAYS[range]).toISOString();
}

function sameSet(a: string[] | undefined, b: string[]): boolean {
  return a !== undefined && a.length === b.length && b.every((v) => a.includes(v));
}

interface TimelineFilterBarProps {
  filters: TimelineFilters;
  onChange: (next: TimelineFilters) => void;
  /** Per-asset pages: the resource type is fixed. */
  hideResourceTypes?: boolean;
  dateRange: TimelineDateRange;
  onDateRangeChange: (next: TimelineDateRange) => void;
  showIngestions?: boolean;
  onShowIngestionsChange?: (next: boolean) => void;
}

function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[] | undefined) => void;
}) {
  const handle = (e: SelectChangeEvent<string[]>) => {
    const next = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
    onChange(next.length > 0 ? next : undefined);
  };
  return (
    <FormControl size="small" sx={{ minWidth: SELECT_MIN_WIDTH }}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        label={label}
        multiple
        value={value}
        onChange={handle}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(selected as string[]).map((v) => (
              <Chip key={v} size="small" label={options.find((o) => o.value === v)?.label ?? v} />
            ))}
          </Box>
        )}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function TimelineFilterBar({
  filters,
  onChange,
  hideResourceTypes = false,
  dateRange,
  onDateRangeChange,
  showIngestions = false,
  onShowIngestionsChange,
}: TimelineFilterBarProps) {
  const agentsOnly = sameSet(filters.origins, AGENT_ORIGINS);

  return (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      sx={(theme) => ({
        alignItems: 'center',
        flexWrap: 'wrap',
        px: 2,
        py: 1.5,
        borderBottom: `1px solid ${pal(theme).line.divider}`,
        backgroundColor: pal(theme).surface.container,
      })}
    >
      <SegmentedControl
        ariaLabel="Date range"
        size="small"
        options={DATE_RANGE_OPTIONS}
        value={dateRange}
        onChange={(range) => {
          onDateRangeChange(range);
          onChange({ ...filters, startDate: dateRangeToStartDate(range) });
        }}
      />

      {!hideResourceTypes && (
        <MultiSelect
          id="timeline-resource-types"
          label="Resource type"
          options={RESOURCE_TYPE_OPTIONS}
          value={filters.resourceTypes ?? []}
          onChange={(resourceTypes) => onChange({ ...filters, resourceTypes })}
        />
      )}

      <MultiSelect
        id="timeline-actions"
        label="Action"
        options={ACTION_OPTIONS}
        value={filters.actions ?? []}
        onChange={(actions) => onChange({ ...filters, actions })}
      />

      <MultiSelect
        id="timeline-origins"
        label="Origin"
        options={ORIGIN_OPTIONS}
        value={filters.origins ?? []}
        onChange={(origins) => onChange({ ...filters, origins })}
      />

      <Chip
        icon={<AgentIcon />}
        label="Made by agents"
        size="small"
        color={agentsOnly ? 'success' : 'default'}
        variant={agentsOnly ? 'filled' : 'outlined'}
        onClick={() =>
          onChange({ ...filters, origins: agentsOnly ? undefined : [...AGENT_ORIGINS] })
        }
        aria-pressed={agentsOnly}
      />

      {onShowIngestionsChange && (
        <FormControlLabel
          sx={{ ml: 'auto', mr: 0 }}
          control={
            <Switch
              size="small"
              checked={showIngestions}
              onChange={(e) => onShowIngestionsChange(e.target.checked)}
            />
          }
          label="Show ingestions"
        />
      )}
    </Stack>
  );
}
