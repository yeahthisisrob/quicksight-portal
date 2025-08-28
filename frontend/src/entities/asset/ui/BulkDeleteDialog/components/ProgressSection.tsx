/**
 * Progress section component for BulkDeleteDialog
 */
import { Box, Typography, LinearProgress } from '@mui/material';

interface ProgressSectionProps {
  jobStatus: any;
}

export function ProgressSection({ jobStatus }: ProgressSectionProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {jobStatus.message || 'Processing delete operation...'}
      </Typography>
      <LinearProgress 
        variant={jobStatus.progress ? 'determinate' : 'indeterminate'}
        value={jobStatus.progress || 0}
        sx={{ mb: 1 }}
      />
      {jobStatus.progress && (
        <Typography variant="caption" color="text.secondary">
          Progress: {jobStatus.progress}%
        </Typography>
      )}
    </Box>
  );
}