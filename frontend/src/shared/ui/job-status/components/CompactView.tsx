/**
 * Compact view for JobStatusDisplay
 */
import { Box, Chip, LinearProgress, Typography } from '@mui/material';

import { getStatusColor, getStatusIcon } from '../utils/jobStatusHelpers';

import type { JobStatus } from '../JobStatusDisplay';

interface CompactViewProps {
  jobStatus: JobStatus;
}

export function CompactView({ jobStatus }: CompactViewProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {getStatusIcon(jobStatus.status)}
      <Chip
        label={jobStatus.status}
        color={getStatusColor(jobStatus.status)}
        size="small"
      />
      {jobStatus.message && (
        <Typography variant="body2" color="text.secondary">
          {jobStatus.message}
        </Typography>
      )}
      {jobStatus.progress !== undefined && jobStatus.status === 'processing' && (
        <Box sx={{ width: 100 }}>
          <LinearProgress variant="determinate" value={jobStatus.progress} />
        </Box>
      )}
    </Box>
  );
}