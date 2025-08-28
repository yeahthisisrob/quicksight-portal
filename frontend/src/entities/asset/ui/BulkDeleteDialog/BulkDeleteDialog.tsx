/**
 * Refactored BulkDeleteDialog component with reduced complexity
 * Follows FSD architecture and DRY principles
 */
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Chip,
  Stack,
  Divider,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState, useCallback, useMemo } from 'react';

import { assetsApi } from '@/shared/api';
import { spacing } from '@/shared/design-system/theme';
import { useJobPolling } from '@/shared/hooks/useJobPolling';
import { actionIcons } from '@/shared/ui/icons';

// Import component parts
import { AssetsList } from './components/AssetsList';
import { ConfirmationSection } from './components/ConfirmationSection';
import { ProgressSection } from './components/ProgressSection';
import { RestorationInfo } from './components/RestorationInfo';
import { WarningsSection } from './components/WarningsSection';

import type { BulkDeleteDialogProps, Asset } from './types';

const DeleteIcon = actionIcons.delete;

// Helper functions
function groupAssetsByType(assets: Asset[]): Record<string, Asset[]> {
  return assets.reduce((acc, asset) => {
    if (!acc[asset.type]) {
      acc[asset.type] = [];
    }
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>);
}

function getAssetsWithDependents(assets: Asset[]): Asset[] {
  return assets.filter(asset => asset.usedBy && asset.usedBy.length > 0);
}

function hasNonRestorableAssets(assets: Asset[]): boolean {
  return assets.some(asset => asset.type !== 'analysis');
}

export function BulkDeleteDialog({
  open,
  onClose,
  assets,
  onComplete,
}: BulkDeleteDialogProps) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  
  // State
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [processing, setProcessing] = useState(false);

  // Computed values
  const assetsByType = useMemo(() => groupAssetsByType(assets), [assets]);
  const assetsWithDependents = useMemo(() => getAssetsWithDependents(assets), [assets]);
  const hasNonRestorable = useMemo(() => hasNonRestorableAssets(assets), [assets]);
  const expectedConfirmText = `DELETE ${assets.length} ASSETS`;

  // Job polling callbacks
  const handleJobComplete = useCallback(async () => {
    enqueueSnackbar('Assets successfully deleted and archived', { variant: 'success' });
    setTimeout(() => {
      onClose();
      onComplete?.();
    }, 2000);
  }, [enqueueSnackbar, onClose, onComplete]);

  const handleJobFailed = useCallback((job: any) => {
    enqueueSnackbar(job.error || 'Failed to delete assets', { variant: 'error' });
    setProcessing(false);
  }, [enqueueSnackbar]);

  // Set up job polling
  const { jobStatus, isPolling, startPolling } = useJobPolling({
    onComplete: handleJobComplete,
    onFailed: handleJobFailed,
  });

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (confirmText !== expectedConfirmText || !reason.trim()) {
      return;
    }

    setProcessing(true);

    try {
      const assetsToDelete = assets.map(asset => ({
        type: asset.type,
        id: asset.id,
        name: asset.name,
      }));
      
      const result = await assetsApi.bulkDelete(assetsToDelete, reason.trim());
      const jobId = result?.jobId || result?.data?.jobId;
      
      if (jobId) {
        enqueueSnackbar(`Bulk delete operation started (Job ID: ${jobId})`, { variant: 'info' });
        startPolling(jobId);
      } else {
        enqueueSnackbar('Delete operation completed', { variant: 'success' });
        setTimeout(() => {
          onClose();
          onComplete?.();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Failed to delete assets:', error);
      enqueueSnackbar(error.message || 'Failed to delete assets', { variant: 'error' });
      setProcessing(false);
    }
  }, [confirmText, expectedConfirmText, reason, assets, enqueueSnackbar, startPolling, onClose, onComplete]);

  // Check if confirm button should be enabled
  const isConfirmEnabled = 
    confirmText === expectedConfirmText && 
    reason.trim().length > 0 && 
    !processing && 
    !isPolling;

  return (
    <Dialog
      open={open}
      onClose={!processing && !isPolling ? onClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: spacing.sm / 8,
          boxShadow: theme.shadows[24],
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
        }}
      >
        <DeleteIcon sx={{ color: theme.palette.error.main }} />
        <Typography variant="h6" component="span" fontWeight={600}>
          Confirm Bulk Delete
        </Typography>
        <Chip
          label={`${assets.length} assets`}
          size="small"
          color="error"
          variant="outlined"
          sx={{ ml: 'auto' }}
        />
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* Progress section when job is running */}
          {isPolling && jobStatus && (
            <ProgressSection jobStatus={jobStatus} />
          )}

          {/* Main content when not processing */}
          {!isPolling && (
            <>
              <WarningsSection 
                hasNonRestorableAssets={hasNonRestorable}
                assetsWithDependents={assetsWithDependents}
              />
              
              <RestorationInfo assetsByType={assetsByType} />
              
              <Divider />
              
              <AssetsList assets={assets} />
              
              <Divider />
              
              <ConfirmationSection
                reason={reason}
                setReason={setReason}
                confirmText={confirmText}
                setConfirmText={setConfirmText}
                expectedConfirmText={expectedConfirmText}
              />
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={processing || isPolling}
          sx={{ minWidth: 100 }}
        >
          Cancel
        </Button>
        {!isPolling && (
          <Button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            variant="contained"
            color="error"
            startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{
              minWidth: 120,
              background: isConfirmEnabled
                ? `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`
                : undefined,
              '&:hover': {
                background: isConfirmEnabled
                  ? `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`
                  : undefined,
              },
            }}
          >
            {processing ? 'Starting...' : 'Delete Assets'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}