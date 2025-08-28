/**
 * Dialog action buttons component
 */
import { Button, CircularProgress, DialogActions } from '@mui/material';

import { actionIcons } from '@/shared/ui/icons';

const RestoreIcon = actionIcons.restore;
const CloseIcon = actionIcons.close;

interface DialogActionButtonsProps {
  loading: boolean;
  validating: boolean;
  isPolling: boolean;
  canDeploy: boolean;
  hasRequiredFields: boolean;
  jobStatus: any;
  onClose: () => void;
  onValidate: () => void;
  onRestore: () => void;
  onStop: () => void;
}

export function DialogActionButtons({
  loading,
  validating,
  isPolling,
  canDeploy,
  hasRequiredFields,
  jobStatus,
  onClose,
  onValidate,
  onRestore,
  onStop,
}: DialogActionButtonsProps) {
  const isProcessing = isPolling && jobStatus?.status === 'processing';
  
  return (
    <DialogActions>
      <Button onClick={onClose} disabled={loading || validating || isPolling}>
        Cancel
      </Button>
      <Button
        onClick={onValidate}
        disabled={loading || validating || isPolling || !hasRequiredFields}
        startIcon={validating ? <CircularProgress size={16} /> : null}
      >
        {validating ? 'Validating...' : 'Validate'}
      </Button>
      {isProcessing && (
        <Button onClick={onStop} color="error" startIcon={<CloseIcon />}>
          Stop
        </Button>
      )}
      <Button
        onClick={onRestore}
        variant="contained"
        color="primary"
        disabled={loading || validating || isPolling || !canDeploy || !hasRequiredFields}
        startIcon={loading || isPolling ? <CircularProgress size={16} /> : <RestoreIcon />}
      >
        {getRestoreButtonText(isPolling, loading, canDeploy)}
      </Button>
    </DialogActions>
  );
}

function getRestoreButtonText(isPolling: boolean, loading: boolean, canDeploy: boolean): string {
  if (isPolling) return 'Restoring...';
  if (loading) return 'Starting...';
  if (canDeploy) return 'Restore Asset';
  return 'Validate First';
}