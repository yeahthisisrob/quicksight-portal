import {
  Add as AddIcon,
  Close as CloseIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  alpha,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  Autocomplete,
  Checkbox,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { assetsApi, usersApi } from '@/shared/api';
import { colors, spacing, borderRadius, typography } from '@/shared/design-system/theme';
import { useJobPolling } from '@/shared/hooks/useJobPolling';
import { dataToCSV, downloadCSV, generateCSVFilename, type ExportColumn } from '@/shared/lib/exportUtils';

interface Member {
  memberName: string;
  arn: string;
  email?: string;
}

interface ProcessedMember {
  name: string;
  email?: string;
  arn: string;
  type: 'email' | 'user';
}

interface User {
  name: string;
  id: string;
  email?: string;
  arn?: string;
}

interface GroupMembersDialogProps {
  open: boolean;
  onClose: () => void;
  groupName: string;
  members: Member[];
}

type Order = 'asc' | 'desc';

export default function GroupMembersDialog({
  open,
  onClose,
  groupName,
  members = [],
}: GroupMembersDialogProps) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  
  // State for table sorting and filtering
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<'name' | 'type'>('name');
  const [filterText, setFilterText] = useState('');
  
  // State for add members dialog
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for removing members
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  
  // Job polling for bulk add
  const { startPolling, jobStatus, isPolling, reset } = useJobPolling({
    onComplete: () => {
      enqueueSnackbar('Successfully added users to group', { variant: 'success' });
      handleAddMembersComplete();
    },
    onFailed: (job) => {
      enqueueSnackbar(job.message || 'Failed to add users to group', { variant: 'error' });
    }
  });

  const loadAvailableUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await assetsApi.getUsersPaginated({
        page: 1,
        pageSize: 1000, // Get all users for now
      });
      
      // The API returns data nested under 'users' key based on the backend structure
      const usersData = response?.users || [];
      
      // If there are no members, show all users as available
      if (!members || members.length === 0) {
        const allUsers = (Array.isArray(usersData) ? usersData : []).map((user: any) => ({
          name: user.userName || user.name || user.id,
          id: user.id,
          email: user.email,
          arn: user.arn,
        }));
        setAvailableUsers(allUsers);
        setIsLoadingUsers(false);
        return;
      }
      
      // Filter out users who are already members
      // Member names might be in different formats, so we need to check multiple fields
      const existingMemberNames = new Set(
        members.map(m => {
          // Extract username from memberName or ARN
          const memberName = m.memberName;
          
          // If memberName contains '/', it might be in format 'namespace/username'
          if (memberName && typeof memberName === 'string' && memberName.includes('/')) {
            const extracted = memberName.split('/').pop() || memberName;
            return extracted;
          }
          return memberName;
        })
      );
      
      // usersData already extracted above
      const availableUsersList = (Array.isArray(usersData) ? usersData : []).filter((user: any) => {
        // Check various possible username formats
        const userName = user.userName || user.name || user.id;
        const userNameParts = userName && typeof userName === 'string' && userName.includes('/') ? userName.split('/').pop() : userName;
        
        // Check if this user is already a member
        return !existingMemberNames.has(userName) && 
               !existingMemberNames.has(userNameParts || userName);
      }).map((user: any) => ({
        name: user.userName || user.name || user.id,
        id: user.id,
        email: user.email,
        arn: user.arn,
      }));
      
      setAvailableUsers(availableUsersList);
    } catch (error) {
      console.error('Failed to load users:', error);
      enqueueSnackbar('Failed to load available users', { variant: 'error' });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [members, enqueueSnackbar]);

  // Load available users when add dialog opens
  useEffect(() => {
    if (isAddMembersOpen) {
      loadAvailableUsers();
    }
  }, [isAddMembersOpen, loadAvailableUsers]);

  const handleMemberClick = (memberName: string) => {
    navigate(`/assets/users?search=${encodeURIComponent(memberName)}`);
    onClose();
  };

  const handleRequestSort = (property: 'name' | 'type') => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleAddMembersComplete = () => {
    setIsAddMembersOpen(false);
    setSelectedUsers([]);
    setSearchTerm('');
    reset();
    // Invalidate cache and reload
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    window.location.reload();
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      enqueueSnackbar('Please select users to add', { variant: 'warning' });
      return;
    }

    try {
      const userNames = selectedUsers.map(u => u.name);
      const jobData = await usersApi.addUsersToGroup(groupName, userNames);
      
      if (jobData?.jobId) {
        // Start polling for job status
        startPolling(jobData.jobId);
        enqueueSnackbar(`Adding ${userNames.length} user(s) to group...`, { variant: 'info' });
      } else {
        // Direct response (for small operations)
        enqueueSnackbar(`Successfully added ${userNames.length} user(s) to group`, { variant: 'success' });
        handleAddMembersComplete();
      }
    } catch (error: any) {
      console.error('Failed to add users to group:', error);
      enqueueSnackbar(error.message || 'Failed to add users to group', { variant: 'error' });
    }
  };

  const handleRemoveMember = async (member: ProcessedMember) => {
    const memberName = member.name;
    setRemovingMember(memberName);
    try {
      const result = await usersApi.removeUsersFromGroup(groupName, [memberName]);
      
      // Check if it's a job response
      if (result?.jobId) {
        enqueueSnackbar(`Removing ${memberName} from group...`, { variant: 'info' });
        // For now, just wait a bit and reload - could use job polling here too
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          queryClient.invalidateQueries({ queryKey: ['users'] });
          window.location.reload();
        }, 2000);
      } else {
        enqueueSnackbar(`Removed ${memberName} from group`, { variant: 'success' });
        // Invalidate cache and reload
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      enqueueSnackbar(error.message || 'Failed to remove member from group', { variant: 'error' });
    } finally {
      setRemovingMember(null);
    }
  };

  const handleExportCSV = () => {
    const columns: ExportColumn[] = [
      { id: 'name', label: 'Member Name' },
      { id: 'type', label: 'Type' },
      { id: 'email', label: 'Email' },
      { id: 'arn', label: 'ARN' }
    ];

    const csvContent = dataToCSV(processedMembers, columns);
    const filename = generateCSVFilename(`group-${groupName}-members`);
    downloadCSV(csvContent, filename);
  };

  // Process and filter members
  const processedMembers = useMemo((): ProcessedMember[] => {
    let filtered: ProcessedMember[] = members.map(m => ({
      name: m.memberName,
      email: m.email || (m.memberName && typeof m.memberName === 'string' && m.memberName.includes('@') ? m.memberName : undefined),
      arn: m.arn,
      type: m.email ? 'email' : 'user',
    }));

    // Apply filter
    if (filterText) {
      filtered = filtered.filter(m => 
        (m.name && typeof m.name === 'string' && m.name.toLowerCase().includes(filterText.toLowerCase())) ||
        (m.email && typeof m.email === 'string' && m.email.toLowerCase().includes(filterText.toLowerCase()))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = orderBy === 'name' ? (a.name || '') : (a.type || '');
      let bValue = orderBy === 'name' ? (b.name || '') : (b.type || '');
      
      if (order === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return filtered;
  }, [members, filterText, order, orderBy]);

  // Filter available users based on search
  const filteredAvailableUsers = useMemo(() => {
    if (!searchTerm) return availableUsers;
    
    const term = searchTerm.toLowerCase();
    return availableUsers.filter(user =>
      (user.name && typeof user.name === 'string' && user.name.toLowerCase().includes(term)) ||
      (user.email && typeof user.email === 'string' && user.email.toLowerCase().includes(term))
    );
  }, [availableUsers, searchTerm]);

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: `${borderRadius.lg}px`,
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: spacing.md / 8,
          borderBottom: `1px solid ${alpha(colors.neutral[200], 0.5)}`,
          backgroundColor: alpha(colors.assetTypes.group.light, 0.3),
          backgroundImage: `linear-gradient(to right, ${alpha(colors.assetTypes.group.light, 0.1)}, transparent)`,
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
                backgroundColor: alpha(colors.assetTypes.group.main, 0.1),
                border: `1px solid ${alpha(colors.assetTypes.group.main, 0.2)}`,
              }}>
                <GroupIcon sx={{ 
                  color: colors.assetTypes.group.main,
                  fontSize: 20,
                }} />
              </Box>
              <Box>
                <Typography 
                  variant="h6" 
                  fontWeight={typography.fontWeight.semibold}
                  color="text.primary"
                >
                  Group Members
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs / 8 }}>
                  <Typography variant="caption" color="text.secondary">
                    {groupName}
                  </Typography>
                  <Chip 
                    label={members.length} 
                    size="small" 
                    sx={{ 
                      fontWeight: typography.fontWeight.semibold,
                      backgroundColor: alpha(colors.assetTypes.group.main, 0.1),
                      color: colors.assetTypes.group.main,
                      border: `1px solid ${alpha(colors.assetTypes.group.main, 0.2)}`,
                    }}
                  />
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs / 8 }}>
              {processedMembers.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportCSV}
                  sx={{
                    borderColor: colors.assetTypes.group.main,
                    color: colors.assetTypes.group.main,
                    '&:hover': {
                      borderColor: colors.assetTypes.group.dark,
                      backgroundColor: alpha(colors.assetTypes.group.main, 0.05),
                    },
                  }}
                >
                  Export CSV
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setIsAddMembersOpen(true)}
                sx={{
                  backgroundColor: colors.assetTypes.group.main,
                  '&:hover': {
                    backgroundColor: colors.assetTypes.group.dark,
                  },
                }}
              >
                Add Members
              </Button>
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
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ px: 0, py: 2 }}>
          {members.length === 0 ? (
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
            }}>
              <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No members in this group
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setIsAddMembersOpen(true)}
                sx={{ mt: 2 }}
              >
                Add First Members
              </Button>
            </Box>
          ) : (
            <Box>
              {/* Search/Filter Bar */}
              <Box sx={{ px: 3, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Filter members..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {/* Members Table */}
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 200 }}>
                        <TableSortLabel
                          active={orderBy === 'name'}
                          direction={orderBy === 'name' ? order : 'asc'}
                          onClick={() => handleRequestSort('name')}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <TableSortLabel
                          active={orderBy === 'type'}
                          direction={orderBy === 'type' ? order : 'asc'}
                          onClick={() => handleRequestSort('type')}
                        >
                          Type
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ minWidth: 300 }}>ARN</TableCell>
                      <TableCell align="center" sx={{ width: 80 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processedMembers.map((member) => (
                      <TableRow
                        key={member.arn}
                        hover
                        sx={{ 
                          '&:hover': {
                            backgroundColor: alpha(colors.assetTypes.user.light, 0.1),
                          },
                        }}
                      >
                        <TableCell 
                          onClick={() => handleMemberClick(member.name)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: `${borderRadius.sm}px`,
                              backgroundColor: alpha(colors.assetTypes.user.main, 0.1),
                              border: `1px solid ${alpha(colors.assetTypes.user.main, 0.2)}`,
                            }}>
                              {member.email ? (
                                <EmailIcon sx={{ 
                                  color: colors.assetTypes.user.main,
                                  fontSize: 14,
                                }} />
                              ) : (
                                <PersonIcon sx={{ 
                                  color: colors.assetTypes.user.main,
                                  fontSize: 14,
                                }} />
                              )}
                            </Box>
                            <Typography variant="body2" fontWeight={typography.fontWeight.medium}>
                              {member.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={member.type === 'email' ? 'Email' : 'User'}
                            size="small"
                            sx={{
                              backgroundColor: alpha(colors.assetTypes.user.main, 0.1),
                              color: colors.assetTypes.user.main,
                              fontWeight: typography.fontWeight.medium,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={member.arn} placement="top-start">
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: typography.fontFamily.monospace,
                                fontSize: typography.fontSize.xs,
                                color: 'text.secondary',
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 300,
                              }}
                            >
                              {member.arn}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Remove from group">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(member);
                              }}
                              disabled={removingMember === member.name}
                              sx={{
                                color: 'text.secondary',
                                '&:hover': {
                                  color: 'error.main',
                                  backgroundColor: alpha(colors.status.error, 0.1),
                                },
                              }}
                            >
                              {removingMember === member.name ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {processedMembers.length === 0 && filterText && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No members match "{filterText}"
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog 
        open={isAddMembersOpen} 
        onClose={() => !isPolling && setIsAddMembersOpen(false)}
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: `${borderRadius.lg}px`,
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight={typography.fontWeight.semibold}>
              Add Members to {groupName}
            </Typography>
            <IconButton 
              onClick={() => !isPolling && setIsAddMembersOpen(false)}
              disabled={isPolling}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {isLoadingUsers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : availableUsers.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No available users to add. All existing users may already be members.
              </Alert>
            ) : (
              <Autocomplete
                multiple
                options={filteredAvailableUsers}
                getOptionLabel={(option) => option.email ? `${option.name} (${option.email})` : option.name}
                value={selectedUsers}
                onChange={(_, newValue) => setSelectedUsers(newValue)}
                inputValue={searchTerm}
                onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
                disabled={isPolling}
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <Checkbox
                      icon={<PersonIcon fontSize="small" />}
                      checkedIcon={<CheckIcon fontSize="small" />}
                      style={{ marginRight: 8 }}
                      checked={selected}
                    />
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      {option.email && (
                        <Typography variant="caption" color="text.secondary">
                          {option.email}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search and select users"
                    placeholder="Type to search users..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={{ mb: 2 }}
              />
            )}

            {selectedUsers.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Selected {selectedUsers.length} user(s) to add
              </Alert>
            )}

            {isPolling && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Adding users to group...
                </Typography>
                <CircularProgress size={20} />
              </Box>
            )}

            {jobStatus?.status === 'failed' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {jobStatus.message || 'Failed to add users to group'}
              </Alert>
            )}
          </Box>
        </DialogContent>

        {availableUsers.length > 0 && (
          <Box sx={{ px: 3, pb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setIsAddMembersOpen(false)}
              disabled={isPolling}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAddMembers}
              disabled={selectedUsers.length === 0 || isPolling}
              startIcon={isPolling ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {isPolling ? 'Adding...' : `Add ${selectedUsers.length || ''} User${selectedUsers.length !== 1 ? 's' : ''}`}
            </Button>
          </Box>
        )}
      </Dialog>
    </>
  );
}