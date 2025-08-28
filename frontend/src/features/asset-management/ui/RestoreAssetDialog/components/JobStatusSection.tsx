/**
 * Job status section component for RestoreAssetDialog
 */
import { Stop } from '@mui/icons-material';
import { Box, Paper, Typography, LinearProgress, Button, Chip } from '@mui/material';

import type { JobStatusSectionProps } from '../types';

export function JobStatusSection({
  jobStatus,
  jobLogs,
  isPolling,
  onStop,
}: JobStatusSectionProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'info';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2">
          Deployment Job Status
        </Typography>
        {isPolling && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<Stop />}
            onClick={onStop}
          >
            Stop
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Chip
          label={jobStatus.status || 'Unknown'}
          color={getStatusColor(jobStatus.status)}
          size="small"
        />
        {jobStatus.message && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {jobStatus.message}
          </Typography>
        )}
      </Box>

      {jobStatus.progress !== undefined && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">Progress</Typography>
            <Typography variant="caption">{jobStatus.progress}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={jobStatus.progress} />
        </Box>
      )}

      {jobLogs && jobLogs.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Job Logs
          </Typography>
          <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflowY: 'auto', bgcolor: 'grey.50' }}>
            {jobLogs.map((log, index) => (
              <Typography key={index} variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                {log.timestamp && `[${new Date(log.timestamp).toLocaleTimeString()}] `}
                {log.message || log}
              </Typography>
            ))}
          </Paper>
        </Box>
      )}
    </Paper>
  );
}