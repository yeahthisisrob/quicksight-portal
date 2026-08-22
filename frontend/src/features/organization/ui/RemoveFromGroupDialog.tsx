import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { usersApi } from '@/shared/api';
import { useJobPolling } from '@/shared/hooks/useJobPolling';

interface RemoveFromGroupDialogProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: Array<{ 
    userName: string; 
    email?: string;
    groups: string[];
  }>;
  onComplete: () => void;
}

export default function RemoveFromGroupDialog({
  open,
  onClose,
  selectedUsers,
  onComplete,
}: RemoveFromGroupDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedGroup, setSelectedGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Membership mutations are queued bulk jobs - poll to completion so the
  // caller's refresh sees the post-mutation state
  const { startPolling } = useJobPolling({
    onComplete: () => {
      enqueueSnackbar(
        `Removed ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} from ${selectedGroup}`,
        { variant: 'success' }
      );
      setSubmitting(false);
      onComplete();
      handleClose();
    },
    onFailed: (job) => {
      enqueueSnackbar(job.message || 'Failed to remove users from group', { variant: 'error' });
      setSubmitting(false);
    },
  });

  // Get common groups across all selected users
  const commonGroups = selectedUsers.length > 0
    ? selectedUsers[0].groups.filter(group =>
        selectedUsers.every(user => user.groups.includes(group))
      )
    : [];

  const handleSubmit = async () => {
    if (!selectedGroup) {
      enqueueSnackbar('Please select a group', { variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await usersApi.removeUsersFromGroup(
        selectedGroup,
        selectedUsers.map(u => u.userName)
      );
      // Always a queued job; keep the dialog in the submitting state until
      // the job completes (onComplete/onFailed above close it out)
      enqueueSnackbar('Removing users from group...', { variant: 'info' });
      startPolling(response.jobId);
    } catch (_error) {
      enqueueSnackbar('Failed to remove users from group', { variant: 'error' });
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedGroup('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Remove Users from Group</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Alert severity="info">
            Removing {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} from a group
          </Alert>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Selected Users:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedUsers.slice(0, 10).map((user) => (
                <Chip
                  key={user.userName}
                  label={user.userName}
                  size="small"
                  variant="outlined"
                />
              ))}
              {selectedUsers.length > 10 && (
                <Chip
                  label={`+${selectedUsers.length - 10} more`}
                  size="small"
                  color="primary"
                />
              )}
            </Box>
          </Box>

          <FormControl fullWidth>
            <InputLabel>Select Group to Remove From</InputLabel>
            <Select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              label="Select Group to Remove From"
              disabled={submitting}
            >
              {commonGroups.length === 0 ? (
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    No common groups found
                  </Typography>
                </MenuItem>
              ) : (
                commonGroups.map((group) => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {commonGroups.length === 0 && (
            <Alert severity="warning">
              The selected users don't share any common groups.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={!selectedGroup || submitting || commonGroups.length === 0}
        >
          {submitting ? <CircularProgress size={24} /> : 'Remove from Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}