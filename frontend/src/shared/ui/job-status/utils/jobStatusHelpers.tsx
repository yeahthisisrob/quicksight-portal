/**
 * Helper functions for JobStatusDisplay
 */
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import React from 'react';

import type { JobStatus } from '../JobStatusDisplay';

/**
 * Get status icon based on job status
 */
export function getStatusIcon(status: JobStatus['status']): React.ReactElement {
  const iconMap = {
    completed: <CheckCircleIcon color="success" />,
    failed: <ErrorIcon color="error" />,
    stopped: <WarningIcon color="warning" />,
    processing: <InfoIcon color="info" />,
    pending: <InfoIcon color="info" />,
  };
  
  return iconMap[status] || <InfoIcon color="info" />;
}

/**
 * Get status color for MUI components
 */
export function getStatusColor(status: JobStatus['status']): 'success' | 'error' | 'warning' | 'primary' | 'default' {
  const colorMap = {
    completed: 'success' as const,
    failed: 'error' as const,
    stopped: 'warning' as const,
    processing: 'primary' as const,
    pending: 'default' as const,
  };
  
  return colorMap[status] || 'default';
}

/**
 * Format duration from start and end times
 */
export function formatDuration(startTime?: string, endTime?: string): string {
  if (!startTime) return '';
  
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const duration = Math.floor((end - start) / 1000);
  
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * Get log level icon
 */
export function getLogLevelIcon(level: 'info' | 'warn' | 'error'): React.ReactElement {
  const iconMap = {
    info: <InfoIcon color="info" fontSize="small" />,
    warn: <WarningIcon color="warning" fontSize="small" />,
    error: <ErrorIcon color="error" fontSize="small" />,
  };
  
  return iconMap[level] || <InfoIcon color="info" fontSize="small" />;
}

/**
 * Get log level color
 */
export function getLogLevelColor(level: 'info' | 'warn' | 'error'): string {
  const colorMap = {
    info: 'text.secondary',
    warn: 'warning.main',
    error: 'error.main',
  };
  
  return colorMap[level] || 'text.secondary';
}