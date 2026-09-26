import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';

import { useDatasetSourceDraft } from '../model/useDatasetSourceDraft';
import { DatasetSourceTables } from './DatasetSourceTables';

interface DatasetSourceDialogProps {
  open: boolean;
  onClose: () => void;
  dataset: { id: string; name: string } | null;
  /** Called after a successful save so the caller can refresh its listing. */
  onSaved?: () => void;
}

/** Where a dataset reads from, edited in a dialog from an asset list. */
export default function DatasetSourceDialog({
  open,
  onClose,
  dataset,
  onSaved,
}: DatasetSourceDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const draft = useDatasetSourceDraft(dataset?.id ?? null, {
    enabled: open,
    onSaved: (name) => {
      enqueueSnackbar(`Updated ${name}`, { variant: 'success' });
      onSaved?.();
    },
  });

  const handleSave = async () => {
    if (await draft.save()) onClose();
  };

  return (
    <Dialog open={open} onClose={draft.saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Edit dataset source
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          {dataset?.name}
        </Typography>
      </DialogTitle>
      <Divider />

      <DialogContent>
        {draft.loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {draft.loadError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>Cannot edit this dataset</AlertTitle>
            {draft.loadError}
          </Alert>
        )}

        {!draft.loading && !draft.loadError && (
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Dataset name"
              value={draft.name}
              onChange={(e) => draft.setName(e.target.value)}
              fullWidth
              size="small"
              disabled={draft.saving}
            />
            <Alert severity="info">
              Column definitions are kept exactly as they are. This changes only where the data
              comes from. If the new table or query does not produce those columns, QuickSight
              rejects the save and says so.
            </Alert>
            <DatasetSourceTables draft={draft} />
          </Stack>
        )}

        {draft.saveError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>QuickSight rejected the change</AlertTitle>
            {draft.saveError}
          </Alert>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={draft.saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={!draft.hasChanges || draft.saving || draft.loading || Boolean(draft.loadError)}
          startIcon={draft.saving ? <CircularProgress size={16} /> : undefined}
        >
          {draft.saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
