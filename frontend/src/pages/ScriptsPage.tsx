import { 
  CleaningServices as CleanupIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  Dataset as DatasetIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Badge
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';

import { scriptsApi } from '@/shared/api';

export const ScriptsPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | false>('demo-cleanup');

  // Query to preview demo assets
  const { data: previewData, isLoading: isLoadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['demo-cleanup-preview'],
    queryFn: () => scriptsApi.previewDemoCleanup(),
    retry: false,
  });

  // Mutation to execute demo cleanup
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

  const handleExecuteCleanup = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmCleanup = () => {
    executeCleanup();
  };

  const handleAccordionChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  const totalAssets = previewData ? 
    previewData.datasources.length + 
    previewData.datasets.length + 
    previewData.analyses.length : 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Scripts & Automation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Automated tasks and maintenance scripts for QuickSight assets
        </Typography>
      </Box>

      <Accordion 
        expanded={expandedPanel === 'demo-cleanup'} 
        onChange={handleAccordionChange('demo-cleanup')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <CleanupIcon sx={{ fontSize: 28, mr: 2, color: 'warning.main' }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">
                Delete All QuickSight Demo Assets
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Remove all demo datasources, datasets, and analyses
              </Typography>
            </Box>
            {previewData && totalAssets > 0 && (
              <Badge badgeContent={totalAssets} color="warning" sx={{ mr: 2 }}>
                <Box />
              </Badge>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>

          <Alert severity="info" sx={{ mb: 2 }}>
            This script identifies and deletes all assets that use the AWS QuickSight sample data 
            (spaceneedle-samplefiles bucket) including:
            <ul>
              <li>Demo datasources connected to spaceneedle-samplefiles</li>
              <li>All datasets using those datasources</li>
              <li>Demo analyses: People Overview, Business Review, Sales Pipeline, Web and Social Media Analytics</li>
            </ul>
            Deleted assets will be archived for recovery if needed.
          </Alert>

          {isLoadingPreview ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : previewData && totalAssets > 0 ? (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <StorageIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="subtitle1">
                      Datasources
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="warning.main">
                    {previewData.datasources.length}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <DatasetIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="subtitle1">
                      Datasets
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="warning.main">
                    {previewData.datasets.length}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AnalyticsIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="subtitle1">
                      Analyses
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="warning.main">
                    {previewData.analyses.length}
                  </Typography>
                </Paper>
              </Stack>
              
              {previewData.datasources.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    <StorageIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                    Datasources ({previewData.datasources.length})
                  </Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                    <List dense>
                      {previewData.datasources.map((ds: any) => (
                        <ListItem key={ds.id}>
                          <ListItemText 
                            primary={ds.name}
                            secondary={`ID: ${ds.id} | Bucket: ${ds.bucket}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Box>
              )}

              {previewData.datasets.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    <DatasetIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                    Datasets ({previewData.datasets.length})
                  </Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                    <List dense>
                      {previewData.datasets.map((dataset: any) => (
                        <ListItem key={dataset.id}>
                          <ListItemText 
                            primary={dataset.name}
                            secondary={`ID: ${dataset.id}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Box>
              )}

              {previewData.analyses.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    <AnalyticsIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                    Analyses ({previewData.analyses.length})
                  </Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                    <List dense>
                      {previewData.analyses.map((analysis: any) => (
                        <ListItem key={analysis.id}>
                          <ListItemText 
                            primary={analysis.name}
                            secondary={`ID: ${analysis.id}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="success" icon={<CheckIcon />}>
              No demo assets found. Your QuickSight account is clean!
            </Alert>
          )}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<CleanupIcon />}
              onClick={handleExecuteCleanup}
              disabled={isExecuting || totalAssets === 0}
            >
              {isExecuting ? 'Cleaning up...' : 'Execute Cleanup'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => refetchPreview()}
              disabled={isLoadingPreview}
            >
              Refresh
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {executionResult && (
        <Card sx={{ maxWidth: 800 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cleanup Results
            </Typography>
            
            <Stack spacing={2}>
              <Alert severity="success">
                Successfully deleted {executionResult.deleted.total} assets
              </Alert>
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Deleted:
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label={`Datasources: ${executionResult.deleted.datasources}`} size="small" />
                  <Chip label={`Datasets: ${executionResult.deleted.datasets}`} size="small" />
                  <Chip label={`Analyses: ${executionResult.deleted.analyses}`} size="small" />
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Archived:
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label={`Datasources: ${executionResult.archived.datasources}`} size="small" />
                  <Chip label={`Datasets: ${executionResult.archived.datasets}`} size="small" />
                  <Chip label={`Analyses: ${executionResult.archived.analyses}`} size="small" />
                </Stack>
              </Box>

              {executionResult.errors && executionResult.errors.length > 0 && (
                <Box>
                  <Alert severity="error" sx={{ mb: 1 }}>
                    {executionResult.errors.length} errors occurred during cleanup
                  </Alert>
                  <List dense>
                    {executionResult.errors.map((error: any, index: number) => (
                      <ListItem key={index}>
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
          </CardContent>
        </Card>
      )}

      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
            Confirm Demo Cleanup
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action will permanently delete {totalAssets} demo assets from your QuickSight account.
            The assets will be archived and can be recovered if needed, but they will no longer be 
            available in QuickSight.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmCleanup} 
            color="warning" 
            variant="contained"
            disabled={isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Delete Demo Assets'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};