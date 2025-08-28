import { Storage, TrendingUp, CheckCircle, Error, HourglassEmpty } from '@mui/icons-material';
import { Box, Card, Stepper, Step, StepLabel, Typography, LinearProgress, Stack, Chip, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

import { TwoPhaseExportState } from '../../model/types';

const exportSteps = [
  {
    label: 'Asset Inventory',
    description: 'Discovering assets in QuickSight',
    icon: Storage,
  },
  {
    label: 'Enrichment',
    description: 'Fetching detailed metadata',
    icon: TrendingUp,
  },
  {
    label: 'Completion',
    description: 'Export finished',
    icon: CheckCircle,
  },
];

interface ExportProgressProps {
  exportState: TwoPhaseExportState;
}

export default function ExportProgress({ exportState }: ExportProgressProps) {

  const getStepFromPhase = (phase: string): number => {
    switch (phase) {
      case 'inventory': return 0;
      case 'enrichment': return 1;
      case 'completed': return 2;
      case 'error': return exportState.currentStep;
      default: return -1;
    }
  };

  const currentStep = getStepFromPhase(exportState.phase);
  const progress = exportState.totalAssets > 0 
    ? (exportState.processedAssets / exportState.totalAssets) * 100 
    : 0;

  const formatDuration = (ms?: number) => {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getElapsedTime = () => {
    if (!exportState.timing?.startTime) return null;
    const endTime = exportState.timing.endTime || Date.now();
    return endTime - exportState.timing.startTime;
  };

  const elapsedTime = getElapsedTime();

  if (exportState.phase === 'idle') return null;

  return (
    <Card sx={{ 
      borderRadius: `${spacing.sm / 8}px`,
      background: exportState.phase === 'error' 
        ? alpha(colors.status.error, 0.02)
        : alpha(colors.primary.main, 0.02),
      border: `1px solid ${
        exportState.phase === 'error' 
          ? alpha(colors.status.error, 0.1)
          : alpha(colors.primary.main, 0.08)
      }`,
    }}>
      <Box sx={{ p: spacing.md / 8 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: spacing.md / 8 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Export Progress
          </Typography>
          <Stack direction="row" spacing={spacing.xs / 8}>
            {elapsedTime && (
              <Chip 
                label={`Elapsed: ${formatDuration(elapsedTime)}`}
                size="small"
                variant="outlined"
                icon={<HourglassEmpty />}
              />
            )}
            <Chip 
              label={exportState.phase === 'error' ? 'Failed' : exportState.phase}
              size="small"
              color={exportState.phase === 'error' ? 'error' : 'primary'}
              variant={exportState.phase === 'completed' ? 'filled' : 'outlined'}
            />
          </Stack>
        </Stack>

        <Stepper activeStep={currentStep} orientation="horizontal" sx={{ mb: spacing.md / 8 }}>
          {exportSteps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                error={exportState.phase === 'error' && index === currentStep}
                StepIconComponent={({ active, completed, error }) => (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: error
                        ? colors.status.error
                        : completed
                        ? colors.status.success
                        : active
                        ? `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`
                        : colors.neutral[300],
                      color: 'white',
                      boxShadow: active ? `0 0 0 4px ${alpha(colors.primary.main, 0.2)}` : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {error ? <Error sx={{ fontSize: 20 }} /> : <step.icon sx={{ fontSize: 20 }} />}
                  </Box>
                )}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {step.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {(exportState.phase === 'inventory' || exportState.phase === 'enrichment') && (
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: spacing.xs / 8 }}>
              <Typography variant="body2" color="text.secondary">
                Processing assets
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {exportState.processedAssets.toLocaleString()} / {exportState.totalAssets.toLocaleString()}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: spacing.xs / 8,
                backgroundColor: alpha(colors.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: spacing.xs / 8,
                  background: `linear-gradient(90deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {Math.round(progress)}% complete
            </Typography>
          </Box>
        )}

        {exportState.phase === 'completed' && (
          <Box sx={{ 
            p: spacing.sm / 8, 
            borderRadius: `${spacing.xs / 8}px`,
            background: alpha(colors.status.success, 0.05),
            border: `1px solid ${alpha(colors.status.success, 0.1)}`,
          }}>
            <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
              <CheckCircle sx={{ color: colors.status.success, fontSize: 20 }} />
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                Export completed successfully
              </Typography>
            </Stack>
            {exportState.timing?.totalDuration && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Total duration: {formatDuration(exportState.timing.totalDuration)}
              </Typography>
            )}
          </Box>
        )}

        {exportState.phase === 'error' && (
          <Box sx={{ 
            p: spacing.sm / 8, 
            borderRadius: `${spacing.xs / 8}px`,
            background: alpha(colors.status.error, 0.05),
            border: `1px solid ${alpha(colors.status.error, 0.1)}`,
          }}>
            <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
              <Error sx={{ color: colors.status.error, fontSize: 20 }} />
              <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                Export failed
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>
    </Card>
  );
}