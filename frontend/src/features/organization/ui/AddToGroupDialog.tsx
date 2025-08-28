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
  AlertTitle,
  Box,
  Typography,
  Chip,
  Stack,
  Divider,
  useTheme,
  LinearProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState, useEffect, useCallback } from 'react';

import { usersApi, assetsApi } from '@/shared/api';
import { useJobPolling } from '@/shared/hooks/useJobPolling';
import { assetIcons } from '@/shared/ui/icons';

import type { JobMetadata } from '@/shared/api/modules/jobs';

const GroupIcon = assetIcons.group;
const UserIcon = assetIcons.user;

interface AddToGroupDialogProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: Array<{ userName: string; email?: string }>;
  onComplete: () => void;
}

interface Group {
  name: string;
  description?: string;
  memberCount?: number;
}

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
  const [submitting, setSubmitting] = useState(false);

  // Set up job polling first to get resetJob
  const { jobStatus, isPolling, startPolling, reset: resetJob } = useJobPolling({
    onComplete: (job: JobMetadata) => handleJobComplete(job),
    onFailed: (job: JobMetadata) => handleJobFailed(job),
  });

  // Handle close dialog
  const handleClose = useCallback(() => {
    if (!isPolling) {
      setSelectedGroup('');
      resetJob();
      onClose();
    }
  }, [isPolling, resetJob, onClose]);

  // Handle job completion
  const handleJobComplete = useCallback((job: JobMetadata) => {
    const stats = job.stats || {};
    const processed = stats.processedAssets || 0;
    const failed = stats.failedAssets || 0;
    
    if (processed > 0) {
      enqueueSnackbar(
        `Successfully added ${processed} user${processed !== 1 ? 's' : ''} to ${selectedGroup}`,
        { variant: 'success' }
      );
    }
    
    if (failed > 0) {
      enqueueSnackbar(
        `Failed to add ${failed} user${failed !== 1 ? 's' : ''}. Check job details for more information.`,
        { variant: 'error' }
      );
    }
    
    setSubmitting(false);
    onComplete();
    handleClose();
  }, [enqueueSnackbar, selectedGroup, onComplete, handleClose]);

  const handleJobFailed = useCallback((job: JobMetadata) => {
    enqueueSnackbar(job.error || 'Failed to add users to group', { variant: 'error' });
    setSubmitting(false);
  }, [enqueueSnackbar]);

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
      // Reset state when dialog opens
      setSelectedGroup('');
      resetJob();
    }
  }, [open, fetchGroups, resetJob]);

  const handleSubmit = async () => {
    if (!selectedGroup) {
      enqueueSnackbar('Please select a group', { variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await usersApi.addUsersToGroup(
        selectedGroup,
        selectedUsers.map(u => u.userName)
      );

      // Handle job response
      if (response?.jobId) {
        enqueueSnackbar(
          `Adding ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} to ${selectedGroup}. This operation will complete in the background.`,
          { variant: 'info' }
        );
        startPolling(response.jobId);
      } else {
        // Shouldn't happen with new API, but handle gracefully
        enqueueSnackbar('Operation completed', { variant: 'success' });
        setSubmitting(false);
        onComplete();
        handleClose();
      }
    } catch (error: any) {
      console.error('Failed to add users to group:', error);
      enqueueSnackbar(error.message || 'Failed to add users to group', { variant: 'error' });
      setSubmitting(false);
    }
  };

  // Don't render if no users selected
  if (!selectedUsers || selectedUsers.length === 0) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
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
          {/* Show job progress if polling */}
          {isPolling && jobStatus && (
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
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  {jobStatus.message}
                </Typography>
              )}
            </Alert>
          )}

          {/* Summary Alert */}
          {!isPolling && (
            <>
              <Alert severity="info" icon={<UserIcon />}>
                <AlertTitle>
                  Adding {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} to group
                </AlertTitle>
                Select a group below to add the selected users as members.
              </Alert>

              {/* Selected Users Section */}
              <Box>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 1,
                    color: theme.palette.text.secondary,
                    fontWeight: 600 
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
                  {selectedUsers.slice(0, 10).map((user) => (
                    <Chip
                      key={user.userName}
                      icon={<UserIcon />}
                      label={
                        <Box>
                          <Typography variant="body2" component="span">
                            {user.userName}
                          </Typography>
                          {user.email && (
                            <Typography 
                              variant="caption" 
                              component="span"
                              sx={{ 
                                display: 'block',
                                color: theme.palette.text.secondary 
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
                        }
                      }}
                    />
                  ))}
                  {selectedUsers.length > 10 && (
                    <Chip
                      label={`+${selectedUsers.length - 10} more`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>
              </Box>

              {/* Group Selection */}
              <FormControl fullWidth>
                <InputLabel id="group-select-label">Select Group</InputLabel>
                <Select
                  labelId="group-select-label"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  label="Select Group"
                  disabled={loading || submitting}
                  sx={{
                    '& .MuiSelect-select': {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }
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
                            <Typography variant="body1">
                              {group.name}
                            </Typography>
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
        <Button 
          onClick={handleClose} 
          disabled={isPolling}
          sx={{ minWidth: 100 }}
        >
          {isPolling ? 'Close' : 'Cancel'}
        </Button>
        {!isPolling && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!selectedGroup || submitting || groups.length === 0}
            startIcon={submitting ? <CircularProgress size={20} /> : <GroupIcon />}
            sx={{ minWidth: 120 }}
          >
            {submitting ? 'Adding...' : 'Add to Group'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}