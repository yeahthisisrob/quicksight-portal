/**
 * Job stats display component
 */
import { Box, Chip } from '@mui/material';

import type { JobStats } from '../JobStatusDisplay';

interface JobStatsProps {
  stats: JobStats;
}

export function JobStatsDisplay({ stats }: JobStatsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {stats.totalAssets !== undefined && (
        <Chip
          label={`Total: ${stats.totalAssets}`}
          size="small"
          variant="outlined"
        />
      )}
      {stats.processedAssets !== undefined && (
        <Chip
          label={`Processed: ${stats.processedAssets}`}
          size="small"
          variant="outlined"
          color="success"
        />
      )}
      {stats.failedAssets !== undefined && stats.failedAssets > 0 && (
        <Chip
          label={`Failed: ${stats.failedAssets}`}
          size="small"
          variant="outlined"
          color="error"
        />
      )}
      {stats.apiCalls !== undefined && (
        <Chip
          label={`API Calls: ${stats.apiCalls}`}
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );
}