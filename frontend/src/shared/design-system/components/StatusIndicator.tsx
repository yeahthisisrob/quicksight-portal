import {
  Error as ErrorIcon,
  Info as InfoIcon,
  Schedule as PendingIcon,
  Cancel as StoppedIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Box, CircularProgress, type SxProps, type Theme, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { pal } from '../createAppTheme';

export type StatusType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'pending'
  | 'stopped'
  | 'in-progress'
  | 'loading';

interface StatusIndicatorProps {
  type: StatusType;
  children?: ReactNode;
  /** Icon only; the text becomes the accessible label. */
  iconOnly?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

const TONE: Record<StatusType, 'success' | 'error' | 'warning' | 'info' | 'pending' | 'stopped'> = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  pending: 'pending',
  stopped: 'stopped',
  'in-progress': 'info',
  loading: 'pending',
};

function StatusIcon({ type, size }: { type: StatusType; size: number }) {
  const sx = { fontSize: size };
  switch (type) {
    case 'success':
      return <SuccessIcon sx={sx} />;
    case 'error':
      return <ErrorIcon sx={sx} />;
    case 'warning':
      return <WarningIcon sx={sx} />;
    case 'info':
      return <InfoIcon sx={sx} />;
    case 'pending':
      return <PendingIcon sx={sx} />;
    case 'stopped':
      return <StoppedIcon sx={sx} />;
    default:
      return <CircularProgress size={size - 2} color="inherit" thickness={5} />;
  }
}

/**
 * Icon + text for a state: "Succeeded", "3 errors", "Waiting for approval".
 * Colour carries the meaning and the icon carries it for anyone who cannot
 * see colour, so never pass one without the other.
 */
export function StatusIndicator({
  type,
  children,
  iconOnly = false,
  size = 'medium',
  sx,
}: StatusIndicatorProps) {
  const iconSize = size === 'small' ? 14 : 16;
  return (
    <Box
      component="span"
      role={iconOnly ? 'img' : undefined}
      aria-label={iconOnly && typeof children === 'string' ? children : undefined}
      sx={[
        (theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          color: pal(theme).tone[TONE[type]].text,
          fontWeight: 600,
          lineHeight: 1,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <StatusIcon type={type} size={iconSize} />
      {!iconOnly && children && (
        <Typography
          component="span"
          variant={size === 'small' ? 'body2' : 'body1'}
          sx={{ fontWeight: 'inherit', color: 'inherit' }}
        >
          {children}
        </Typography>
      )}
    </Box>
  );
}
