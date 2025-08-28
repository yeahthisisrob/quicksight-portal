import { 
  PlayArrow, 
  Stop, 
  Autorenew,
  Security,
  Label,
  Cached,
  BuildCircle,
  Analytics,
  Storage,
  Memory
} from '@mui/icons-material';
import { Box, Button, Card, Stack, Typography, ToggleButton, ToggleButtonGroup, Alert, alpha, Tooltip } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

import { ExportMode } from '../../model/types';

interface ExportControlsProps {
  exportMode: ExportMode;
  onModeChange: (mode: ExportMode) => void;
  onStartExport: () => void;
  onStopExport: () => void;
  onRefreshActivity: () => void;
  onExportIngestions: () => void;
  onClearMemoryCache: () => void;
  onClearStuckJobs: () => void;
  onRefreshStatus: () => void;
  isRunning: boolean;
  isRefreshing: boolean;
  canRefreshActivity: boolean;
  refreshingActivity: boolean;
  exportingIngestions: boolean;
  clearingCache: boolean;
  clearingStuckJobs: boolean;
  selectedTypesCount: number;
}

export default function ExportControls({
  exportMode,
  onModeChange,
  onStartExport,
  onStopExport,
  onRefreshActivity,
  onExportIngestions,
  onClearMemoryCache,
  onClearStuckJobs,
  onRefreshStatus: _onRefreshStatus,
  isRunning,
  isRefreshing: _isRefreshing,
  canRefreshActivity,
  refreshingActivity,
  exportingIngestions,
  clearingCache,
  clearingStuckJobs,
  selectedTypesCount,
}: ExportControlsProps) {

  const exportModes = [
    {
      value: 'smart',
      label: 'Smart Sync',
      description: 'Skip unchanged',
      icon: Autorenew,
      color: colors.primary.main,
    },
    {
      value: 'force',
      label: 'Force Refresh',
      description: 'Re-export all',
      icon: Cached,
      color: colors.status.warning,
    },
    {
      value: 'rebuild',
      label: 'Rebuild Cache',
      description: 'From existing files',
      icon: BuildCircle,
      color: colors.status.error,
    },
    {
      value: 'permissions',
      label: 'Permissions',
      description: 'Update only',
      icon: Security,
      color: colors.status.info,
    },
    {
      value: 'tags',
      label: 'Tags',
      description: 'Update only',
      icon: Label,
      color: colors.status.success,
    },
  ];

  return (
    <Card sx={{ borderRadius: `${spacing.sm / 8}px` }}>
      <Box sx={{ p: spacing.md / 8 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: spacing.md / 8 }}>
          Export Configuration
        </Typography>

        <Stack spacing={spacing.md / 8}>
          {/* Export Mode Selection */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: spacing.sm / 8 }}>
              Export Mode
            </Typography>
            <ToggleButtonGroup
              value={exportMode}
              exclusive
              onChange={(_, newMode) => newMode && onModeChange(newMode)}
              fullWidth
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  borderRadius: `${spacing.xs / 8}px`,
                  border: '1px solid',
                  borderColor: colors.neutral[300],
                  '&.Mui-selected': {
                    borderWidth: 2,
                  },
                },
              }}
            >
              {exportModes.map((mode) => (
                <ToggleButton 
                  key={mode.value} 
                  value={mode.value}
                  sx={{
                    '&.Mui-selected': {
                      borderColor: mode.color,
                      background: alpha(mode.color, 0.05),
                    },
                  }}
                >
                  <Stack spacing={0.5} alignItems="center">
                    <mode.icon sx={{ fontSize: 20, color: mode.color }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                        {mode.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {mode.description}
                      </Typography>
                    </Box>
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Mode-specific warnings */}
          {exportMode === 'force' && (
            <Alert severity="warning" sx={{ py: 1 }}>
              Force mode will re-export all selected assets regardless of cache status
            </Alert>
          )}
          {exportMode === 'rebuild' && (
            <Alert severity="info" sx={{ py: 1 }}>
              Rebuild cache will reconstruct the cache from existing S3 files without making new API calls.
            </Alert>
          )}

          {/* Action Buttons */}
          <Stack spacing={spacing.sm / 8}>
            {isRunning ? (
              <>
                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  size="large"
                  startIcon={<Stop />}
                  onClick={onStopExport}
                  sx={{
                    py: spacing.sm / 8,
                    borderRadius: `${spacing.xs / 8}px`,
                  }}
                >
                  Stop Export
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={onStartExport}
                  disabled={selectedTypesCount === 0}
                  sx={{
                    py: spacing.sm / 8,
                    borderRadius: `${spacing.xs / 8}px`,
                    background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.main} 100%)`,
                    },
                    '&:disabled': {
                      background: colors.neutral[300],
                    },
                  }}
                >
                  {exportMode === 'rebuild' ? 'Rebuild Cache' : `Start ${exportMode === 'force' ? 'Force ' : ''}Export`}
                </Button>

                {canRefreshActivity && (
                  <Button
                    variant="outlined"
                    fullWidth
                    size="medium"
                    startIcon={<Analytics />}
                    onClick={onRefreshActivity}
                    disabled={refreshingActivity}
                    sx={{
                      borderColor: alpha(colors.primary.main, 0.5),
                      color: colors.primary.main,
                      '&:hover': {
                        borderColor: colors.primary.main,
                        background: alpha(colors.primary.main, 0.05),
                      },
                    }}
                  >
                    {refreshingActivity ? 'Refreshing Activity...' : 'Refresh Activity'}
                  </Button>
                )}

                <Tooltip title="Refresh and export all SPICE dataset ingestions to view current ingestion status">
                  <Button
                    variant="outlined"
                    fullWidth
                    size="medium"
                    startIcon={<Storage />}
                    onClick={onExportIngestions}
                    disabled={exportingIngestions || isRunning}
                    sx={{
                      borderColor: alpha(colors.status.info, 0.5),
                      color: colors.status.info,
                      '&:hover': {
                        borderColor: colors.status.info,
                        background: alpha(colors.status.info, 0.05),
                      },
                    }}
                  >
                    {exportingIngestions ? 'Exporting Ingestions...' : 'Export Ingestions'}
                  </Button>
                </Tooltip>

                <Tooltip title="Clear Lambda in-memory cache to force fresh data from S3">
                  <Button
                    variant="outlined"
                    fullWidth
                    size="medium"
                    startIcon={<Memory />}
                    onClick={onClearMemoryCache}
                    disabled={clearingCache || isRunning}
                    sx={{
                      borderColor: alpha(colors.status.warning, 0.5),
                      color: colors.status.warning,
                      '&:hover': {
                        borderColor: colors.status.warning,
                        background: alpha(colors.status.warning, 0.05),
                      },
                    }}
                  >
                    {clearingCache ? 'Clearing Cache...' : 'Clear Memory Cache'}
                  </Button>
                </Tooltip>

                <Tooltip title="Clear all stuck jobs (queued/processing for more than 1 minute)">
                  <Button
                    variant="outlined"
                    fullWidth
                    size="medium"
                    startIcon={<BuildCircle />}
                    onClick={onClearStuckJobs}
                    disabled={clearingStuckJobs}
                    sx={{
                      borderColor: alpha(colors.status.error, 0.5),
                      color: colors.status.error,
                      '&:hover': {
                        borderColor: colors.status.error,
                        background: alpha(colors.status.error, 0.05),
                      },
                    }}
                  >
                    {clearingStuckJobs ? 'Clearing Jobs...' : 'Clear Stuck Jobs'}
                  </Button>
                </Tooltip>
              </>
            )}
          </Stack>

          {/* Selected Types Summary */}
          <Box sx={{ 
            p: spacing.sm / 8, 
            borderRadius: `${spacing.xs / 8}px`,
            background: alpha(colors.primary.main, 0.05),
            border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
          }}>
            <Typography variant="body2" color="text.secondary" align="center">
              {selectedTypesCount === 0 
                ? 'No asset types selected' 
                : `${selectedTypesCount} asset type${selectedTypesCount > 1 ? 's' : ''} selected for export`
              }
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Card>
  );
}