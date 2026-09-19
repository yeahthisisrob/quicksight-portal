import {
  Analytics as AnalyticsIcon,
  CleaningServices as CleanupIcon,
  Dataset as DatasetIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { scriptsApi } from '@/shared/api';
import { Container, KeyValuePairs, StatusIndicator } from '@/shared/design-system';

function CountTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Container variant="subtle" sx={{ flex: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
        {icon}
        <Typography variant="subtitle2">{label}</Typography>
      </Stack>
      <Typography variant="h2" sx={{ mt: 0.5, color: value > 0 ? 'warning.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Container>
  );
}

function AssetList({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: Array<{ id: string; name: string; bucket?: string }>;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Container header={`${title} (${items.length})`} headingLevel="h3" headerAdornment={icon}>
      <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
        {items.map((item) => (
          <ListItem key={item.id} disableGutters>
            <ListItemText
              primary={item.name}
              secondary={item.bucket ? `ID: ${item.id} | Bucket: ${item.bucket}` : `ID: ${item.id}`}
            />
          </ListItem>
        ))}
      </List>
    </Container>
  );
}

/**
 * Maintenance scripts. Today: delete the AWS-provided QuickSight demo assets.
 * Every script previews what it will touch before it runs.
 */
export function ScriptsPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const {
    data: previewData,
    isLoading: isLoadingPreview,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ['demo-cleanup-preview'],
    queryFn: () => scriptsApi.previewDemoCleanup(),
    retry: false,
  });

  const { mutate: executeCleanup, isPending: isExecuting } = useMutation({
    mutationFn: () => scriptsApi.executeDemoCleanup(),
    onSuccess: (data) => {
      setExecutionResult(data);
      setConfirmDialogOpen(false);
      enqueueSnackbar('Demo cleanup completed successfully', { variant: 'success' });
      refetchPreview();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.message || 'Failed to execute demo cleanup', { variant: 'error' });
      setConfirmDialogOpen(false);
    },
  });

  const totalAssets = previewData
    ? previewData.datasources.length + previewData.datasets.length + previewData.analyses.length
    : 0;

  return (
    <Stack spacing={2}>
      <Container
        header="Delete QuickSight demo assets"
        description="Removes the sample datasources, datasets and analyses AWS ships with a new account. Deleted assets are archived and can be restored."
        headerAdornment={<CleanupIcon sx={{ color: 'warning.main' }} />}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={() => refetchPreview()}
              disabled={isLoadingPreview}
            >
              Refresh preview
            </Button>
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<CleanupIcon />}
              onClick={() => setConfirmDialogOpen(true)}
              disabled={isExecuting || totalAssets === 0}
            >
              {isExecuting ? 'Cleaning up...' : 'Execute cleanup'}
            </Button>
          </Stack>
        }
      >
        <Alert severity="info" sx={{ mb: 2 }}>
          Targets everything that reads the AWS sample bucket (spaceneedle-samplefiles): the demo
          datasources, all datasets on them, and the demo analyses (People Overview, Business
          Review, Sales Pipeline, Web and Social Media Analytics).
        </Alert>

        {isLoadingPreview ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : previewData && totalAssets > 0 ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <CountTile
                icon={<StorageIcon fontSize="small" />}
                label="Datasources"
                value={previewData.datasources.length}
              />
              <CountTile
                icon={<DatasetIcon fontSize="small" />}
                label="Datasets"
                value={previewData.datasets.length}
              />
              <CountTile
                icon={<AnalyticsIcon fontSize="small" />}
                label="Analyses"
                value={previewData.analyses.length}
              />
            </Stack>
            <AssetList
              icon={<StorageIcon fontSize="small" />}
              title="Datasources"
              items={previewData.datasources}
            />
            <AssetList
              icon={<DatasetIcon fontSize="small" />}
              title="Datasets"
              items={previewData.datasets}
            />
            <AssetList
              icon={<AnalyticsIcon fontSize="small" />}
              title="Analyses"
              items={previewData.analyses}
            />
          </Stack>
        ) : (
          <StatusIndicator type="success">
            No demo assets found. The account is clean.
          </StatusIndicator>
        )}
      </Container>

      {executionResult && (
        <Container header="Cleanup results" headingLevel="h3">
          <Stack spacing={2}>
            <Alert severity="success">
              Successfully deleted {executionResult.deleted.total} assets
            </Alert>
            <KeyValuePairs
              columns={2}
              items={[
                {
                  label: 'Deleted',
                  value: (
                    <Stack direction="row" spacing={1}>
                      <Chip
                        label={`Datasources: ${executionResult.deleted.datasources}`}
                        size="small"
                      />
                      <Chip label={`Datasets: ${executionResult.deleted.datasets}`} size="small" />
                      <Chip label={`Analyses: ${executionResult.deleted.analyses}`} size="small" />
                    </Stack>
                  ),
                },
                {
                  label: 'Archived',
                  value: (
                    <Stack direction="row" spacing={1}>
                      <Chip
                        label={`Datasources: ${executionResult.archived.datasources}`}
                        size="small"
                      />
                      <Chip label={`Datasets: ${executionResult.archived.datasets}`} size="small" />
                      <Chip label={`Analyses: ${executionResult.archived.analyses}`} size="small" />
                    </Stack>
                  ),
                },
              ]}
            />
            {executionResult.errors && executionResult.errors.length > 0 && (
              <Box>
                <Alert severity="error" sx={{ mb: 1 }}>
                  {executionResult.errors.length} errors occurred during cleanup
                </Alert>
                <List dense>
                  {executionResult.errors.map((error: any, index: number) => (
                    <ListItem key={`${error.assetType}-${error.assetId}-${index}`}>
                      <ListItemText
                        primary={`${error.assetType}: ${error.assetId}`}
                        secondary={error.error}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        </Container>
      )}

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
            Confirm demo cleanup
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This deletes {totalAssets} demo assets from the QuickSight account. They are archived
            and can be restored, but they will no longer be available in QuickSight.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>Are you sure you want to continue?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => executeCleanup()}
            color="warning"
            variant="contained"
            disabled={isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Delete demo assets'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ScriptsPanel;
