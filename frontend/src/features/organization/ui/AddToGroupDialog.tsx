import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';

import { JobFailureList } from '@/entities/job';
import { resolveUserName, type UserLike } from '@/entities/user';

import { assetsApi } from '@/shared/api';
import { assetIcons } from '@/shared/ui/icons';

import { type MembershipOutcome, useGroupMembershipJob } from '../lib/useGroupMembershipJob';

const GroupIcon = assetIcons.group;
const UserIcon = assetIcons.user;

const MAX_USER_CHIPS = 10;

interface AddToGroupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Users-grid rows (name/id) or legacy { userName } selections - both work */
  selectedUsers: ReadonlyArray<UserLike>;
  /** Fired when at least one user was added, so the caller can refresh */
  onComplete: () => void;
}

interface Group {
  name: string;
  description?: string;
  memberCount?: number;
}

const pluralUsers = (n: number): string => `${n} user${n === 1 ? '' : 's'}`;

export default function AddToGroupDialog({
  open,
  onClose,
  selectedUsers,
  onComplete,
}: AddToGroupDialogProps) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(false);

  const closeAndReset = useCallback(() => {
    setSelectedGroup('');
    onClose();
  }, [onClose]);

  const handleSettled = useCallback(
    (settled: MembershipOutcome) => {
      if (settled.succeeded > 0) {
        onComplete();
      }
      // Partial / total failure keeps the dialog open so the reasons stay visible
      if (settled.ok) {
        closeAndReset();
      }
    },
    [onComplete, closeAndReset]
  );

  const { run, reset, isRunning, jobStatus, outcome } = useGroupMembershipJob({
    onSettled: handleSettled,
  });

  const handleClose = useCallback(() => {
    if (isRunning) return;
    reset();
    closeAndReset();
  }, [isRunning, reset, closeAndReset]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await assetsApi.getGroupsPaginated({ pageSize: 100 });
      setGroups(response.groups || []);
    } catch (_error) {
      enqueueSnackbar('Failed to load groups', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (open) {
      fetchGroups();
      setSelectedGroup('');
      reset();
    }
  }, [open, fetchGroups, reset]);

  const handleSubmit = () => {
    if (!selectedGroup) {
      enqueueSnackbar('Please select a group', { variant: 'error' });
      return;
    }
    void run('add', selectedGroup, selectedUsers);
  };

  if (!selectedUsers || selectedUsers.length === 0) {
    return null;
  }

  const showFailures = outcome !== null && !outcome.ok;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6">Add Users to Group</Typography>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {isRunning && jobStatus && (
            <Alert severity="info">
              <AlertTitle>Operation in Progress</AlertTitle>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Job ID: {jobStatus.jobId}
              </Typography>
              {jobStatus.progress !== undefined && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={jobStatus.progress}
                    sx={{ mb: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {jobStatus.progress}% complete
                  </Typography>
                </Box>
              )}
              {jobStatus.message && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  {jobStatus.message}
                </Typography>
              )}
            </Alert>
          )}

          {showFailures && (
            <JobFailureList
              title={`${pluralUsers(outcome.failed)} could not be added to ${outcome.groupName}`}
              failures={outcome.failures}
              summary={outcome.error}
            />
          )}

          {!isRunning && (
            <>
              <Alert severity="info" icon={<UserIcon />}>
                <AlertTitle>Adding {pluralUsers(selectedUsers.length)} to group</AlertTitle>
                Select a group below to add the selected users as members.
              </Alert>

              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 1,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                >
                  Selected Users
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    p: 2,
                    bgcolor: theme.palette.grey[50],
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {selectedUsers.slice(0, MAX_USER_CHIPS).map((user) => {
                    const userName = resolveUserName(user);
                    return (
                      <Chip
                        key={userName || user.email || 'unknown'}
                        icon={<UserIcon />}
                        color={userName ? 'default' : 'error'}
                        label={
                          <Box>
                            <Typography variant="body2" component="span">
                              {userName || 'No QuickSight user name'}
                            </Typography>
                            {user.email && (
                              <Typography
                                variant="caption"
                                component="span"
                                sx={{
                                  display: 'block',
                                  color: theme.palette.text.secondary,
                                }}
                              >
                                {user.email}
                              </Typography>
                            )}
                          </Box>
                        }
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 'auto',
                          '& .MuiChip-label': {
                            display: 'block',
                            whiteSpace: 'normal',
                            py: 0.5,
                          },
                        }}
                      />
                    );
                  })}
                  {selectedUsers.length > MAX_USER_CHIPS && (
                    <Chip
                      label={`+${selectedUsers.length - MAX_USER_CHIPS} more`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>
              </Box>

              <FormControl fullWidth>
                <InputLabel id="group-select-label">Select Group</InputLabel>
                <Select
                  labelId="group-select-label"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  label="Select Group"
                  disabled={loading}
                  sx={{
                    '& .MuiSelect-select': {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    },
                  }}
                >
                  {loading ? (
                    <MenuItem disabled>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={20} />
                        <Typography>Loading groups...</Typography>
                      </Box>
                    </MenuItem>
                  ) : groups.length === 0 ? (
                    <MenuItem disabled>
                      <Typography color="text.secondary">No groups available</Typography>
                    </MenuItem>
                  ) : (
                    groups.map((group) => (
                      <MenuItem key={group.name} value={group.name}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <GroupIcon sx={{ mr: 1, color: theme.palette.text.secondary }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body1">{group.name}</Typography>
                            {group.description && (
                              <Typography variant="caption" color="text.secondary">
                                {group.description}
                              </Typography>
                            )}
                          </Box>
                          {group.memberCount !== undefined && (
                            <Chip
                              label={`${group.memberCount} member${group.memberCount !== 1 ? 's' : ''}`}
                              size="small"
                              variant="outlined"
                              sx={{ ml: 2 }}
                            />
                          )}
                        </Box>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </>
          )}
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={isRunning} sx={{ minWidth: 100 }}>
          {showFailures ? 'Close' : 'Cancel'}
        </Button>
        {!isRunning && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!selectedGroup || groups.length === 0}
            startIcon={<GroupIcon />}
            sx={{ minWidth: 120 }}
          >
            {showFailures ? 'Retry' : 'Add to Group'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
