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
import { useCallback, useState } from 'react';

import { JobFailureList } from '@/entities/job';
import { resolveUserName, type UserLike } from '@/entities/user';

import { useGroupMembershipJob, type MembershipOutcome } from '../lib/useGroupMembershipJob';

const MAX_USER_CHIPS = 10;

interface RemoveFromGroupDialogProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: Array<UserLike & { groups: string[] }>;
  /** Fired when at least one user was removed, so the caller can refresh */
  onComplete: () => void;
}

const pluralUsers = (n: number): string => `${n} user${n === 1 ? '' : 's'}`;

export default function RemoveFromGroupDialog({
  open,
  onClose,
  selectedUsers,
  onComplete,
}: RemoveFromGroupDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedGroup, setSelectedGroup] = useState('');

  const closeAndReset = useCallback(() => {
    setSelectedGroup('');
    onClose();
  }, [onClose]);

  const handleSettled = useCallback(
    (outcome: MembershipOutcome) => {
      if (outcome.succeeded > 0) {
        onComplete();
      }
      if (outcome.ok) {
        closeAndReset();
      }
    },
    [onComplete, closeAndReset]
  );

  const { run, reset, isRunning, outcome } = useGroupMembershipJob({ onSettled: handleSettled });

  // Get common groups across all selected users
  const commonGroups = selectedUsers.length > 0
    ? selectedUsers[0].groups.filter(group =>
        selectedUsers.every(user => user.groups.includes(group))
      )
    : [];

  const handleSubmit = () => {
    if (!selectedGroup) {
      enqueueSnackbar('Please select a group', { variant: 'error' });
      return;
    }
    void run('remove', selectedGroup, selectedUsers);
  };

  const handleClose = () => {
    if (isRunning) return;
    reset();
    closeAndReset();
  };

  const showFailures = outcome !== null && !outcome.ok;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Remove Users from Group</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Alert severity="info">
            Removing {pluralUsers(selectedUsers.length)} from a group
          </Alert>

          {showFailures && (
            <JobFailureList
              title={`${pluralUsers(outcome.failed)} could not be removed from ${outcome.groupName}`}
              failures={outcome.failures}
              summary={outcome.error}
            />
          )}

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Selected Users:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedUsers.slice(0, MAX_USER_CHIPS).map((user) => {
                const userName = resolveUserName(user);
                return (
                  <Chip
                    key={userName || user.email || 'unknown'}
                    label={userName || 'No QuickSight user name'}
                    color={userName ? 'default' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                );
              })}
              {selectedUsers.length > MAX_USER_CHIPS && (
                <Chip
                  label={`+${selectedUsers.length - MAX_USER_CHIPS} more`}
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
              disabled={isRunning}
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
        <Button onClick={handleClose} disabled={isRunning}>
          {showFailures ? 'Close' : 'Cancel'}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={!selectedGroup || isRunning || commonGroups.length === 0}
        >
          {isRunning ? <CircularProgress size={24} /> : showFailures ? 'Retry' : 'Remove from Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
