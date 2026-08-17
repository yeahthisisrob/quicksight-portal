import { Alert, Box, Dialog, DialogContent, DialogTitle, Skeleton } from '@mui/material';

import { useDatasetActivity } from '@/features/activity';

import { spacing } from '@/shared/design-system/theme';

import { DatasetActivityContent } from './DatasetActivityContent';

interface DatasetActivityDialogProps {
  open: boolean;
  onClose: () => void;
  datasetName: string;
  datasetId: string;
}

/**
 * Activity dialog for a dataset: refresh (ingestion) history plus the
 * view/update activity of dashboards & analyses that use it.
 */
export function DatasetActivityDialog({
  open,
  onClose,
  datasetName,
  datasetId,
}: DatasetActivityDialogProps) {
  const { data: activity, isLoading, error } = useDatasetActivity(datasetId, open);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Activity - {datasetName}</DialogTitle>

      <DialogContent>
        <Box sx={{ pt: spacing.sm / 8 }}>
          {isLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md / 8 }}>
              <Skeleton variant="rectangular" height={100} />
              <Skeleton variant="rectangular" height={200} />
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ my: spacing.md / 8 }}>
              {error instanceof Error ? error.message : 'Failed to load dataset activity'}
            </Alert>
          )}
          {activity && <DatasetActivityContent activity={activity} />}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
