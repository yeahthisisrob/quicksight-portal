import {
  PlayArrow,
  Stop,
  Autorenew,
  Security,
  Label,
  Cached,
  BuildCircle,
  Analytics,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

import { ExportMode } from '../../model/types';

interface ExportControlsProps {
  exportMode: ExportMode;
  onModeChange: (mode: ExportMode) => void;
  onStartExport: () => void;
  onStopExport: () => void;
  onRefreshActivity: () => void;
  onRefreshStatus: () => void;
  isRunning: boolean;
  isRefreshing: boolean;
  canRefreshActivity: boolean;
  refreshingActivity: boolean;
  selectedTypesCount: number;
}

const EXPORT_MODES = [
  {
    value: 'smart' as ExportMode,
    label: 'Smart Sync',
    description: 'Exports only assets that changed since the last run — skips unchanged ones.',
    icon: Autorenew,
    color: colors.primary.main,
  },
  {
    value: 'force' as ExportMode,
    label: 'Force Refresh',
    description: 'Re-exports every selected asset regardless of cache status.',
    icon: Cached,
    color: colors.status.warning,
  },
  {
    value: 'rebuild' as ExportMode,
    label: 'Rebuild Cache',
    description:
      'Reconstructs the cache from existing S3 files for all asset types — no new API calls.',
    icon: BuildCircle,
    color: colors.status.error,
  },
  {
    value: 'permissions' as ExportMode,
    label: 'Permissions',
    description: 'Updates permissions only, leaving definitions and tags untouched.',
    icon: Security,
    color: colors.status.info,
  },
  {
    value: 'tags' as ExportMode,
    label: 'Tags',
    description: 'Updates tags only, leaving definitions and permissions untouched.',
    icon: Label,
    color: colors.status.success,
  },
];

function startButtonLabel(exportMode: ExportMode): string {
  if (exportMode === 'rebuild') return 'Rebuild Cache';
  return `Start ${exportMode === 'force' ? 'Force ' : ''}Export`;
}

function selectionSummary(exportMode: ExportMode, selectedTypesCount: number): string {
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
 * Export mode picker plus run/stop actions. Rendered inside the Export card
 * on the Export Assets page — layout only, all state lives in the parent.
 */
export default function ExportControls({
  exportMode,
  onModeChange,
  onStartExport,
  onStopExport,
  onRefreshActivity,
  onRefreshStatus: _onRefreshStatus,
  isRunning,
  isRefreshing: _isRefreshing,
  canRefreshActivity,
  refreshingActivity,
  selectedTypesCount,
}: ExportControlsProps) {
  const selectedMode = EXPORT_MODES.find((m) => m.value === exportMode);

  return (
    <Stack spacing={spacing.md / 8}>
      {/* Export Mode */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: spacing.sm / 8 }}>
          Export Mode
        </Typography>
        <ToggleButtonGroup
          value={exportMode}
          exclusive
          onChange={(_, newMode) => newMode && onModeChange(newMode)}
          size="small"
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            '& .MuiToggleButtonGroup-grouped': {
              border: `1px solid ${colors.neutral[300]} !important`,
              borderRadius: `${spacing.md / 8}px !important`,
              ml: '0 !important',
            },
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: spacing.sm / 8 + 0.5,
              py: 0.5,
            },
          }}
        >
          {EXPORT_MODES.map((mode) => (
            <ToggleButton
              key={mode.value}
              value={mode.value}
              disabled={isRunning}
              sx={{
                '&.Mui-selected': {
                  borderColor: `${mode.color} !important`,
                  background: alpha(mode.color, 0.08),
                  color: mode.color,
                  fontWeight: 600,
                  '&:hover': { background: alpha(mode.color, 0.14) },
                },
              }}
            >
              <mode.icon sx={{ fontSize: 18, mr: 0.75, color: mode.color }} />
              {mode.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {selectedMode && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: spacing.xs / 8 }}
          >
            {selectedMode.description}
          </Typography>
        )}
      </Box>

      {/* Mode-specific warnings */}
      {exportMode === 'force' && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Force mode will re-export all selected assets regardless of cache status.
        </Alert>
      )}
      {exportMode === 'rebuild' && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Rebuild cache will reconstruct the cache from existing S3 files without making new API
          calls. Asset type selection is ignored.
        </Alert>
      )}

      {/* Actions */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        {isRunning ? (
          <Button
            variant="contained"
            color="error"
            size="medium"
            startIcon={<Stop />}
            onClick={onStopExport}
            sx={{ minWidth: 180 }}
          >
            Stop Export
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              size="medium"
              startIcon={<PlayArrow />}
              onClick={onStartExport}
              disabled={selectedTypesCount === 0 && exportMode !== 'rebuild'}
              sx={{ minWidth: 180 }}
            >
              {startButtonLabel(exportMode)}
            </Button>

            {canRefreshActivity && (
              <Tooltip title="Fetch CloudTrail activity and dataset ingestion (refresh) history">
                <span>
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<Analytics />}
                    onClick={onRefreshActivity}
                    disabled={refreshingActivity}
                  >
                    {refreshingActivity ? 'Refreshing Activity...' : 'Refresh Activity'}
                  </Button>
                </span>
              </Tooltip>
            )}
          </>
        )}

        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {selectionSummary(exportMode, selectedTypesCount)}
        </Typography>
      </Stack>
    </Stack>
  );
}
