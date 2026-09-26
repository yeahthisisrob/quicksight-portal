import { Alert, AlertTitle, Box, List, ListItem, ListItemText, Typography } from '@mui/material';

import type { BulkItemFailure } from '@/shared/api/modules/jobs';
import { typography } from '@/shared/design-system/theme';

interface JobFailureListProps {
  /** Item-level failures from a bulk job record (job.failures) */
  failures: BulkItemFailure[];
  /** Headline, e.g. "2 of 5 users could not be added" */
  title: string;
  /** Job-level reason summary (job.error) shown when there are no item failures */
  summary?: string;
  /** Rows rendered before the list collapses into "+N more". Default 8. */
  maxVisible?: number;
}

const DEFAULT_MAX_VISIBLE = 8;

/**
 * What went wrong in a bulk job, item by item. Renders nothing when there is
 * nothing to report so callers can mount it unconditionally.
 */
export default function JobFailureList({
  failures,
  title,
  summary,
  maxVisible = DEFAULT_MAX_VISIBLE,
}: JobFailureListProps) {
  if (failures.length === 0 && !summary) {
    return null;
  }

  const visible = failures.slice(0, maxVisible);
  const hidden = failures.length - visible.length;

  return (
    <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <AlertTitle>{title}</AlertTitle>
      {visible.length > 0 ? (
        <List dense disablePadding>
          {visible.map((failure, index) => (
            <ListItem key={`${failure.item}-${index}`} disableGutters sx={{ py: 0.25 }}>
              <ListItemText
                primary={failure.item}
                secondary={failure.error}
                slotProps={{
                  primary: {
                    variant: 'body2',
                    sx: {
                      fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily.monospace,
                    },
                  },

                  secondary: { variant: 'caption' },
                }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2">{summary}</Typography>
      )}
      {hidden > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            +{hidden} more - see the job details for the full list
          </Typography>
        </Box>
      )}
    </Alert>
  );
}
