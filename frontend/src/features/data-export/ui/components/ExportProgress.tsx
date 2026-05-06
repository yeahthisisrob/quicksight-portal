import { CheckCircle, Storage, TrendingUp } from '@mui/icons-material';
import { Box, Stack, Typography, alpha } from '@mui/material';

import { JobProgress, type JobPhaseStatus, type JobProgressStep } from '@/entities/job';

import { colors, spacing } from '@/shared/design-system/theme';

import { TwoPhaseExportState } from '../../model/types';

const exportSteps: JobProgressStep[] = [
  {
    key: 'inventory',
    label: 'Asset Inventory',
    description: 'Discovering assets in QuickSight',
    icon: Storage,
  },
  {
    key: 'enrichment',
    label: 'Enrichment',
    description: 'Fetching detailed metadata',
    icon: TrendingUp,
  },
  {
    key: 'completion',
    label: 'Completion',
    description: 'Export finished',
    icon: CheckCircle,
  },
];

interface ExportProgressProps {
  exportState: TwoPhaseExportState;
}

const formatDuration = (ms?: number): string => {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const phaseToStepIndex = (phase: TwoPhaseExportState['phase'], currentStep: number): number => {
  switch (phase) {
    case 'inventory':
      return 0;
    case 'enrichment':
      return 1;
    case 'completed':
      return 2;
    case 'error':
      return currentStep;
    default:
      return -1;
  }
};

const phaseToStatus = (phase: TwoPhaseExportState['phase']): JobPhaseStatus => {
  if (phase === 'idle') return 'idle';
  if (phase === 'completed') return 'completed';
  if (phase === 'error') return 'error';
  return 'running';
};

export default function ExportProgress({ exportState }: ExportProgressProps) {
  if (exportState.phase === 'idle') return null;

  const stepIndex = phaseToStepIndex(exportState.phase, exportState.currentStep);
  const status = phaseToStatus(exportState.phase);
  const progress =
    exportState.totalAssets > 0
      ? (exportState.processedAssets / exportState.totalAssets) * 100
      : 0;

  const elapsedMs = exportState.timing?.startTime
    ? (exportState.timing.endTime || Date.now()) - exportState.timing.startTime
    : null;

  const showProgress =
    exportState.phase === 'inventory' || exportState.phase === 'enrichment';

  // Export shows the success card with a duration line — keep that flourish.
  const completedFooter =
    exportState.phase === 'completed' && exportState.timing?.totalDuration ? (
      <Box
        sx={{
          p: spacing.sm / 8,
          borderRadius: `${spacing.xs / 8}px`,
          background: alpha(colors.status.success, 0.05),
          border: `1px solid ${alpha(colors.status.success, 0.1)}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
          <CheckCircle sx={{ color: colors.status.success, fontSize: 20 }} />
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
            Export completed successfully
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Total duration: {formatDuration(exportState.timing.totalDuration)}
        </Typography>
      </Box>
    ) : undefined;

  return (
    <JobProgress
      title="Export Progress"
      steps={exportSteps}
      currentStepIndex={stepIndex}
      phaseStatus={status}
      progressPercent={showProgress ? progress : undefined}
      progressDetails={
        showProgress
          ? {
              label: 'Processing assets',
              processed: exportState.processedAssets,
              total: exportState.totalAssets,
            }
          : undefined
      }
      elapsedMs={elapsedMs}
      statusLabel={exportState.phase === 'error' ? 'Failed' : exportState.phase}
      footerContent={completedFooter}
    />
  );
}
