import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import { assetsApi } from '@/shared/api';

const NAME_MAX_LENGTH = 200;

interface RenameAssetDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the applied name after a successful rename */
  onSuccess: (newName: string) => void;
  assetType: string;
  asset: { id: string; name: string } | null;
}

/**
 * Rename an asset live in QuickSight. Dashboards get a new version published
 * so viewers see the new name immediately; the portal listing updates on
 * success and the exported file refreshes on the next Smart Sync.
 */
export function RenameAssetDialog({
  open,
  onClose,
  onSuccess,
  assetType,
  asset,
}: RenameAssetDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setName(asset.name || '');
      setError(null);
    }
  }, [asset]);

  if (!asset) return null;

  const trimmed = name.trim();
  const unchanged = trimmed === (asset.name || '').trim();
  const invalid = trimmed.length === 0 || trimmed.length > NAME_MAX_LENGTH;

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  const handleRename = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await assetsApi.renameAsset(assetType, asset.id, trimmed);
      enqueueSnackbar(`Renamed to "${result.name}"`, { variant: 'success' });
      onSuccess(result.name);
    } catch (err: any) {
      const message = err.message || 'Failed to rename asset';
      setError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Rename {assetType}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Renames the {assetType} live in QuickSight
          {assetType === 'dashboard' && ' and publishes a new version so viewers see it'}.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          label="Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          error={trimmed.length > NAME_MAX_LENGTH}
          helperText={
            trimmed.length > NAME_MAX_LENGTH
              ? `Name must be at most ${NAME_MAX_LENGTH} characters`
              : `Current name: ${asset.name}`
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !invalid && !unchanged && !loading) {
              handleRename();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleRename}
          variant="contained"
          disabled={loading || invalid || unchanged}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
}
