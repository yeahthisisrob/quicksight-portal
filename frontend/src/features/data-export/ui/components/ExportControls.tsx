import { Alert, Box, Stack, Typography } from '@mui/material';

import { SegmentedControl } from '@/shared/design-system';

import type { ExportMode } from '../../model/types';

interface ExportControlsProps {
  exportMode: ExportMode;
  onModeChange: (mode: ExportMode) => void;
  disabled?: boolean;
}

const EXPORT_MODES: Array<{ value: ExportMode; label: string; description: string }> = [
  {
    value: 'smart',
    label: 'Smart sync',
    description:
      'Exports only assets that changed since the last run. If the cache is missing it is first restored from the existing export files, with no extra API calls.',
  },
  {
    value: 'force',
    label: 'Force refresh',
    description:
      'Re-exports every selected asset from QuickSight regardless of the cache. The most expensive mode.',
  },
  {
    value: 'rebuild',
    label: 'Rebuild cache',
    description:
      'Re-parses the existing export files into fresh caches for every asset type. No QuickSight API calls; job history and activity data are kept.',
  },
  {
    value: 'permissions',
    label: 'Permissions',
    description: 'Updates permissions only, leaving definitions and tags untouched.',
  },
  {
    value: 'tags',
    label: 'Tags',
    description: 'Updates tags only, leaving definitions and permissions untouched.',
  },
];

/** What the run button says for a mode. */
export function startButtonLabel(exportMode: ExportMode): string {
  if (exportMode === 'rebuild') return 'Rebuild cache';
  return exportMode === 'force' ? 'Start force export' : 'Start export';
}

/** What a run would cover, in a line: "3 asset types · Smart sync". */
export function selectionSummary(exportMode: ExportMode, selectedTypesCount: number): string {
  const mode = EXPORT_MODES.find((m) => m.value === exportMode);
  if (exportMode === 'rebuild') {
    return `All asset types · ${mode?.label}`;
  }
  if (selectedTypesCount === 0) {
    return 'No asset types selected';
  }
  return `${selectedTypesCount} asset type${selectedTypesCount > 1 ? 's' : ''} · ${mode?.label}`;
}

/**
 * The export mode, with what it means. Layout only: the state and the run
 * button live in the export view, which puts the button in its card's header.
 */
export default function ExportControls({
  exportMode,
  onModeChange,
  disabled = false,
}: ExportControlsProps) {
  const selectedMode = EXPORT_MODES.find((m) => m.value === exportMode);

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Mode
        </Typography>
        <SegmentedControl
          ariaLabel="Export mode"
          value={exportMode}
          onChange={onModeChange}
          options={EXPORT_MODES.map((mode) => ({
            value: mode.value,
            label: mode.label,
            disabled,
          }))}
        />
        {selectedMode && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {selectedMode.description}
          </Typography>
        )}
      </Box>

      {exportMode === 'force' && (
        <Alert severity="warning">
          Force mode re-exports every selected asset regardless of the cache.
        </Alert>
      )}
      {exportMode === 'rebuild' && (
        <Alert severity="info">
          Rebuilds every cache from the existing export files. Asset type selection is ignored, and
          large accounts can take a few minutes.
        </Alert>
      )}
    </Stack>
  );
}
