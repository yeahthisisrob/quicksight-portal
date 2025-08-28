import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState, useEffect } from 'react';

import { groupsApi } from '@/shared/api';

interface UpdateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  group: {
    id: string;
    name: string;
    description?: string;
  } | null;
}

export function UpdateGroupDialog({ open, onClose, onSuccess, group }: UpdateGroupDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (group) {
      setDescription(group.description || '');
    }
  }, [group]);

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  const handleUpdate = async () => {
    if (!group) return;

    setLoading(true);
    setError(null);

    try {
      await groupsApi.updateGroup(group.name, description.trim());
      enqueueSnackbar(`Group "${group.name}" updated successfully`, { variant: 'success' });
      handleClose();
      onSuccess();
    } catch (error: any) {
      setError(error.message || 'Failed to update group');
      enqueueSnackbar(error.message || 'Failed to update group', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!group) return null;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Update Group</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Update the description for the group "{group.name}".
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Group Name"
            fullWidth
            value={group.name}
            margin="normal"
            disabled
            helperText="Group name cannot be changed"
          />

          <TextField
            autoFocus
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            disabled={loading}
            placeholder="e.g., Finance team analysts with access to financial dashboards"
            helperText="Update the description of the group's purpose"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Update Group
        </Button>
      </DialogActions>
    </Dialog>
  );
}