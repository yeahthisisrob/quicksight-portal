import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Tooltip,
  Paper,
  IconButton,
  alpha,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { usersApi } from '@/shared/api';
import { colors, spacing, borderRadius, typography } from '@/shared/design-system/theme';

import AddToGroupDialog from './AddToGroupDialog';

interface UserGroupsDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    userName: string;
    email?: string;
    groups?: string[];
  };
  onGroupsChange: () => void;
}

export default function UserGroupsDialog({
  open,
  onClose,
  user,
  onGroupsChange,
}: UserGroupsDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [groups, setGroups] = useState<string[]>(user.groups || []);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);

  const handleRemoveFromGroup = async (groupName: string) => {
    setRemoving(groupName);
    try {
      const response = await usersApi.removeUsersFromGroup(groupName, [user.userName]);

      const { successful } = response;
      
      if (successful.length > 0) {
        enqueueSnackbar(
          `Removed ${user.userName} from ${groupName}`,
          { variant: 'success' }
        );
        setGroups(groups.filter(g => g !== groupName));
        onGroupsChange();
      }
    } catch (_error) {
      enqueueSnackbar('Failed to remove user from group', { variant: 'error' });
    } finally {
      setRemoving(null);
    }
  };

  const handleAddToGroupComplete = () => {
    // Refresh user data
    onGroupsChange();
    // Close the add dialog but keep this dialog open
    setAddGroupOpen(false);
    // Update local groups list (will be refreshed from parent)
    onClose();
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: `${borderRadius.lg}px`,
            maxHeight: '90vh',
            backgroundColor: 'background.paper',
            backgroundImage: 'none',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: spacing.md / 8,
          borderBottom: `1px solid ${alpha(colors.neutral[200], 0.5)}`,
          backgroundColor: alpha(colors.assetTypes.user.light, 0.3),
          backgroundImage: `linear-gradient(to right, ${alpha(colors.assetTypes.user.light, 0.1)}, transparent)`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm / 8 }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: `${borderRadius.sm}px`,
                backgroundColor: alpha(colors.assetTypes.user.main, 0.1),
                border: `1px solid ${alpha(colors.assetTypes.user.main, 0.2)}`,
              }}>
                <GroupIcon sx={{ 
                  color: colors.assetTypes.user.main,
                  fontSize: 20,
                }} />
              </Box>
              <Box>
                <Typography 
                  variant="h6" 
                  fontWeight={typography.fontWeight.semibold}
                  color="text.primary"
                >
                  Group Memberships
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs / 8 }}>
                  <Typography variant="caption" color="text.secondary">
                    {user.userName} {user.email && `(${user.email})`}
                  </Typography>
                  <Chip 
                    label={groups.length} 
                    size="small" 
                    sx={{ 
                      fontWeight: typography.fontWeight.semibold,
                      backgroundColor: alpha(colors.assetTypes.user.main, 0.1),
                      color: colors.assetTypes.user.main,
                      border: `1px solid ${alpha(colors.assetTypes.user.main, 0.2)}`,
                    }}
                  />
                </Box>
              </Box>
            </Box>
            <IconButton 
              onClick={onClose} 
              sx={{
                color: 'action.active',
                transition: 'all 0.2s',
                '&:hover': {
                  color: 'error.main',
                  backgroundColor: alpha(colors.status.error, 0.1),
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ px: 0, py: 2 }}>
          {groups.length === 0 ? (
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
            }}>
              <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                This user is not a member of any groups
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                Add the user to groups to grant permissions and organize access
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setAddGroupOpen(true)}
                variant="contained"
                sx={{
                  backgroundColor: colors.assetTypes.user.main,
                  '&:hover': {
                    backgroundColor: colors.assetTypes.user.dark,
                  }
                }}
              >
                Add to Group
              </Button>
            </Box>
          ) : (
            <Box sx={{ px: 3 }}>
              <Box sx={{ mb: spacing.md / 8 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: spacing.sm / 8 }}>
                  Click the delete button to remove the user from a group.
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm / 8 }}>
                {groups.map((group) => {
                  const isRemoving = removing === group;
                  
                  return (
                    <Paper
                      key={group}
                      variant="outlined"
                      sx={{ 
                        p: spacing.md / 8,
                        border: `1px solid ${alpha(colors.assetTypes.group.main, 0.2)}`,
                        backgroundColor: alpha(colors.assetTypes.group.light, 0.3),
                        borderRadius: `${borderRadius.md}px`,
                        transition: 'all 0.2s',
                        opacity: isRemoving ? 0.5 : 1,
                        '&:hover': {
                          borderColor: alpha(colors.assetTypes.group.main, 0.3),
                          backgroundColor: alpha(colors.assetTypes.group.light, 0.4),
                        },
                      }}
                    >
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm / 8, flex: 1 }}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: `${borderRadius.sm}px`,
                            backgroundColor: alpha(colors.assetTypes.group.main, 0.1),
                            border: `1px solid ${alpha(colors.assetTypes.group.main, 0.2)}`,
                          }}>
                            <GroupIcon sx={{ 
                              color: colors.assetTypes.group.main,
                              fontSize: 16,
                            }} />
                          </Box>
                          <Box sx={{ overflow: 'hidden', flex: 1 }}>
                            <Typography variant="body2" fontWeight={typography.fontWeight.medium} noWrap>
                              {group}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'text.secondary',
                                display: 'block',
                              }}
                            >
                              Group Membership
                            </Typography>
                          </Box>
                        </Box>
                        <Tooltip title="Remove from group">
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFromGroup(group)}
                            disabled={isRemoving}
                            sx={{ 
                              '&:hover': {
                                color: 'error.main',
                                backgroundColor: alpha('#f44336', 0.08),
                              }
                            }}
                          >
                            {isRemoving ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
              
              <Box sx={{ mt: spacing.md / 8, pt: spacing.md / 8, borderTop: `1px solid ${alpha(colors.neutral[200], 0.5)}` }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setAddGroupOpen(true)}
                  variant="contained"
                  fullWidth
                  sx={{
                    backgroundColor: colors.assetTypes.user.main,
                    '&:hover': {
                      backgroundColor: colors.assetTypes.user.dark,
                    }
                  }}
                >
                  Add to Another Group
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Add to Group Dialog */}
      <AddToGroupDialog
        open={addGroupOpen}
        onClose={() => setAddGroupOpen(false)}
        selectedUsers={[{ userName: user.userName, email: user.email }]}
        onComplete={handleAddToGroupComplete}
      />
    </>
  );
}