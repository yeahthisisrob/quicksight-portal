import { CheckCircle, Error as ErrorIcon, HourglassEmpty } from '@mui/icons-material';
import {
  Box,
  Card,
  Chip,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  alpha,
} from '@mui/material';
import { type ReactNode, type ComponentType } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

export type JobPhaseStatus = 'idle' | 'running' | 'completed' | 'error';

export interface JobProgressStep {
  key: string;
  label: string;
  description: string;
  icon: ComponentType<{ sx?: object }>;
}

export interface JobProgressProps {
  title: string;
  steps: JobProgressStep[];
  /** -1 = no step active (idle); steps.length = all done. */
  currentStepIndex: number;
  phaseStatus: JobPhaseStatus;
  /** Progress percent 0-100 within the active step. Hidden if undefined. */
  progressPercent?: number;
  /** Optional inline progress details rendered above the progress bar. */
  progressDetails?: {
    label: string;
    processed: number;
    total: number;
  };
  /** Elapsed time in ms — rendered as a chip. */
  elapsedMs?: number | null;
  /** Status chip shown next to elapsed time. */
  statusLabel?: string;
  /** Slot rendered below the progress bar (success / error / warning content). */
  footerContent?: ReactNode;
  /** Hides the card entirely when phaseStatus === 'idle'. Default: true. */
  hideWhenIdle?: boolean;
}

const formatDuration = (ms?: number | null): string => {
  if (!ms || ms < 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Step-based job progress card. Reused by export and activity-refresh; drop-in
 * for any future job that wants a stepper + linear-progress visual. Pure
 * presentational — owners pass the current step + percent, this renders.
 */
export default function JobProgress(props: JobProgressProps) {
  const {
    title,
    steps,
    currentStepIndex,
    phaseStatus,
    progressPercent,
    progressDetails,
    elapsedMs,
    statusLabel,
    footerContent,
    hideWhenIdle = true,
  } = props;

  if (hideWhenIdle && phaseStatus === 'idle') {
    return null;
  }

  const isError = phaseStatus === 'error';
  const isCompleted = phaseStatus === 'completed';
  const showProgressBar = phaseStatus === 'running' && typeof progressPercent === 'number';

  return (
    <Card
      sx={{
        borderRadius: `${spacing.sm / 8}px`,
        background: isError
          ? alpha(colors.status.error, 0.02)
          : alpha(colors.primary.main, 0.02),
        border: `1px solid ${
          isError ? alpha(colors.status.error, 0.1) : alpha(colors.primary.main, 0.08)
        }`,
      }}
    >
      <Box sx={{ p: spacing.md / 8 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: spacing.md / 8 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Stack direction="row" spacing={spacing.xs / 8}>
            {elapsedMs !== null && elapsedMs !== undefined && (
              <Chip
                label={`Elapsed: ${formatDuration(elapsedMs)}`}
                size="small"
                variant="outlined"
                icon={<HourglassEmpty />}
              />
            )}
            {statusLabel && (
              <Chip
                label={statusLabel}
                size="small"
                color={isError ? 'error' : 'primary'}
                variant={isCompleted ? 'filled' : 'outlined'}
              />
            )}
          </Stack>
        </Stack>

        <Stepper activeStep={currentStepIndex} orientation="horizontal" sx={{ mb: spacing.md / 8 }}>
          {steps.map((step, index) => (
            <Step key={step.key}>
              <StepLabel
                error={isError && index === currentStepIndex}
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
                    {error ? (
                      <ErrorIcon sx={{ fontSize: 20 }} />
                    ) : (
                      <step.icon sx={{ fontSize: 20 }} />
                    )}
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

        {showProgressBar && (
          <Box>
            {progressDetails && (
              <Stack direction="row" justifyContent="space-between" sx={{ mb: spacing.xs / 8 }}>
                <Typography variant="body2" color="text.secondary">
                  {progressDetails.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {progressDetails.processed.toLocaleString()} /{' '}
                  {progressDetails.total.toLocaleString()}
                </Typography>
              </Stack>
            )}
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, progressPercent ?? 0))}
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
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block' }}
            >
              {Math.round(progressPercent ?? 0)}% complete
            </Typography>
          </Box>
        )}

        {isCompleted && !footerContent && (
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
                {title} completed successfully
              </Typography>
            </Stack>
          </Box>
        )}

        {isError && !footerContent && (
          <Box
            sx={{
              p: spacing.sm / 8,
              borderRadius: `${spacing.xs / 8}px`,
              background: alpha(colors.status.error, 0.05),
              border: `1px solid ${alpha(colors.status.error, 0.1)}`,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
              <ErrorIcon sx={{ color: colors.status.error, fontSize: 20 }} />
              <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                {title} failed
              </Typography>
            </Stack>
          </Box>
        )}

        {footerContent}
      </Box>
    </Card>
  );
}
