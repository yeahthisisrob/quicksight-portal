/**
 * Refactored JobStatusDisplay with reduced complexity
 */
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { CompactView } from './components/CompactView';
import { JobStatsDisplay } from './components/JobStats';
import { formatDuration, getLogLevelColor, getLogLevelIcon, getStatusColor, getStatusIcon } from './utils/jobStatusHelpers';

export interface JobStats {
  totalAssets?: number;
  processedAssets?: number;
  failedAssets?: number;
  apiCalls?: number;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'stopped';
  progress?: number;
  message?: string;
  stats?: JobStats;
  error?: string;
  startTime?: string;
  endTime?: string;
}

export interface JobLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

interface JobStatusDisplayProps {
  jobStatus: JobStatus | null;
  logs?: JobLog[];
  onRefresh?: () => void;
  onStop?: () => void;
  isRefreshing?: boolean;
  showLogs?: boolean;
  compact?: boolean;
}

/**
 * Header component
 */
function JobHeader({ 
  jobStatus, 
  onStop, 
  onRefresh, 
  isRefreshing 
}: { 
  jobStatus: JobStatus;
  onStop?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getStatusIcon(jobStatus.status)}
        <Typography variant="h6">
          Job Status: {jobStatus.jobId}
        </Typography>
        <Chip
          label={jobStatus.status}
          color={getStatusColor(jobStatus.status)}
          size="small"
        />
      </Box>
      <Box>
        {onStop && jobStatus.status === 'processing' && (
          <IconButton onClick={onStop} size="small" color="error">
            <StopIcon />
          </IconButton>
        )}
        {onRefresh && (
          <IconButton 
            onClick={onRefresh} 
            disabled={isRefreshing}
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

/**
 * Progress display component
 */
function ProgressDisplay({ progress }: { progress: number }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2">Progress</Typography>
        <Typography variant="body2">{progress}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={progress} />
    </Box>
  );
}

/**
 * Logs display component
 */
function LogsDisplay({ logs, expanded, onToggle }: { 
  logs: JobLog[]; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  if (logs.length === 0) return null;
  
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">
          Logs ({logs.length})
        </Typography>
        <IconButton onClick={onToggle} size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ 
          maxHeight: 300, 
          overflow: 'auto', 
          bgcolor: 'background.default',
          borderRadius: 1,
          p: 1,
        }}>
          <Stack spacing={0.5}>
            {logs.map((log, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                {getLogLevelIcon(log.level)}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: getLogLevelColor(log.level),
                  }}
                >
                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </>
  );
}

export const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({
  jobStatus,
  logs = [],
  onRefresh,
  onStop,
  isRefreshing = false,
  showLogs = true,
  compact = false,
}) => {
  const [logsExpanded, setLogsExpanded] = useState(false);

  if (!jobStatus) {
    return null;
  }

  if (compact) {
    return <CompactView jobStatus={jobStatus} />;
  }

  const duration = formatDuration(jobStatus.startTime, jobStatus.endTime);
  const showProgress = jobStatus.progress !== undefined && jobStatus.status === 'processing';

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <JobHeader
          jobStatus={jobStatus}
          onStop={onStop}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />

        {jobStatus.message && (
          <Typography variant="body2" color="text.secondary">
            {jobStatus.message}
          </Typography>
        )}

        {showProgress && <ProgressDisplay progress={jobStatus.progress!} />}

        {jobStatus.stats && <JobStatsDisplay stats={jobStatus.stats} />}

        {duration && (
          <Typography variant="body2" color="text.secondary">
            Duration: {duration}
          </Typography>
        )}

        {jobStatus.error && (
          <Alert severity="error">
            {jobStatus.error}
          </Alert>
        )}

        {showLogs && (
          <LogsDisplay 
            logs={logs} 
            expanded={logsExpanded} 
            onToggle={() => setLogsExpanded(!logsExpanded)}
          />
        )}
      </Stack>
    </Paper>
  );
};