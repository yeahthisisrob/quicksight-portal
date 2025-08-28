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
import { useState } from 'react';

import { groupsApi } from '@/shared/api';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGroupDialog({ open, onClose, onSuccess }: CreateGroupDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!loading) {
      setGroupName('');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await groupsApi.createGroup(groupName.trim(), description.trim() || undefined);
      enqueueSnackbar(`Group "${groupName}" created successfully`, { variant: 'success' });
      handleClose();
      onSuccess();
    } catch (error: any) {
      setError(error.message || 'Failed to create group');
      enqueueSnackbar(error.message || 'Failed to create group', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create New Group</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Create a new QuickSight group to organize users and manage permissions.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            margin="normal"
            required
            disabled={loading}
            placeholder="e.g., Finance-Analysts"
            helperText="Enter a unique name for the group"
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            disabled={loading}
            placeholder="e.g., Finance team analysts with access to financial dashboards"
            helperText="Optional description of the group's purpose"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading || !groupName.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Create Group
        </Button>
      </DialogActions>
    </Dialog>
  );
}