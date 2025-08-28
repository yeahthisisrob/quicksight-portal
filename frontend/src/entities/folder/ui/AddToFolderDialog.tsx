import {
  Folder as FolderIcon,
  Search as SearchIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  CircularProgress,
  Box,
  Typography,
  LinearProgress,
  Checkbox,
  Chip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState, useEffect, useCallback } from 'react';

import { useFolders } from '@/entities/folder';
import { folderApi } from '@/entities/folder/api';

import { assetsApi } from '@/shared/api';
import { useJobPolling } from '@/shared/hooks/useJobPolling';

import type { BulkAssetReference } from '@/shared/types/bulk';

interface AddToFolderDialogProps {
  open: boolean;
  onClose: () => void;
  selectedAssets: Array<{ id: string; name: string; type: string }>;
  onComplete?: () => void;
}

export default function AddToFolderDialog({
  open,
  onClose,
  selectedAssets,
  onComplete,
}: AddToFolderDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { handleBulkOperationComplete } = useFolders();
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  
  // Memoize callbacks for job polling
  const handleJobComplete = useCallback(async () => {
    enqueueSnackbar('Assets successfully added to folders', { variant: 'success' });
    await handleBulkOperationComplete();
    
    // Close dialog after a short delay
    setTimeout(() => {
      onClose();
      onComplete?.();
    }, 2000);
  }, [enqueueSnackbar, handleBulkOperationComplete, onClose, onComplete]);

  const handleJobFailed = useCallback((job: any) => {
    enqueueSnackbar(job.error || 'Failed to add assets to folders', { variant: 'error' });
    setProcessing(false);
  }, [enqueueSnackbar]);

  // Set up job polling
  const { jobStatus, isPolling, startPolling, reset: resetJob } = useJobPolling({
    onComplete: handleJobComplete,
    onFailed: handleJobFailed,
  });

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await assetsApi.getFoldersPaginated({ pageSize: 100 });
      setFolders(response.folders || []);
    } catch (_error) {
      enqueueSnackbar('Failed to load folders', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (open) {
      loadFolders();
      // Reset state when dialog opens
      setSelectedFolders([]);
      setProcessing(false);
      resetJob();
    }
  }, [open, resetJob, loadFolders]);

  const filteredFolders = folders.filter(folder =>
    folder.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolders(prev => {
      if (prev.includes(folderId)) {
        return prev.filter(id => id !== folderId);
      }
      return [...prev, folderId];
    });
  };

  const handleAddToFolders = async () => {
    if (selectedFolders.length === 0) {
      enqueueSnackbar('Please select at least one folder', { variant: 'warning' });
      return;
    }

    setProcessing(true);

    try {
      // Convert selected assets to BulkAssetReference format
      const bulkAssets: BulkAssetReference[] = selectedAssets.map(asset => ({
        type: asset.type as any,
        id: asset.id,
        name: asset.name,
      }));

      // For now, we'll call the API for each folder until backend supports multiple folders in one call
      // In the future, this could be a single call with multiple folder IDs
      if (selectedFolders.length === 1) {
        // Single folder - use bulk API
        const response = await folderApi.bulkAddAssets(selectedFolders[0], bulkAssets);
        
        if (response.data?.jobId) {
          enqueueSnackbar(`Bulk operation started (Job ID: ${response.data.jobId})`, { variant: 'info' });
          startPolling(response.data.jobId);
        }
      } else {
        // Multiple folders - create multiple jobs
        // This is a temporary approach until backend supports multiple folders
        enqueueSnackbar(`Adding assets to ${selectedFolders.length} folders...`, { variant: 'info' });
        
        let successCount = 0;
        let failCount = 0;
        let lastJobId: string | null = null;
        
        for (const folderId of selectedFolders) {
          try {
            const response = await folderApi.bulkAddAssets(folderId, bulkAssets);
            if (response.data?.jobId) {
              successCount++;
              // Track the last job ID for polling
              lastJobId = response.data.jobId;
            }
          } catch (error) {
            failCount++;
            console.error(`Failed to add assets to folder ${folderId}:`, error);
          }
        }
        
        if (successCount > 0) {
          enqueueSnackbar(`Started ${successCount} bulk operations`, { variant: 'success' });
          
          // For the last job, start polling
          if (lastJobId) {
            startPolling(lastJobId);
          }
        }
        
        if (failCount > 0) {
          enqueueSnackbar(`Failed to start ${failCount} operations`, { variant: 'error' });
        }
      }
    } catch (error: any) {
      enqueueSnackbar(error.message || 'Failed to add assets to folders', { variant: 'error' });
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing && !isPolling) {
      onClose();
    }
  };


  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add {selectedAssets.length} Asset{selectedAssets.length !== 1 ? 's' : ''} to Folder{selectedFolders.length > 1 ? 's' : ''}
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : processing ? (
          <Box sx={{ py: 2 }}>
            {jobStatus ? (
              <>
                <Typography variant="h6" gutterBottom>
                  Job Status: {jobStatus.status}
                </Typography>
                {jobStatus.progress !== undefined && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress variant="determinate" value={jobStatus.progress || 0} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Progress: {jobStatus.progress}%
                    </Typography>
                  </Box>
                )}
                {jobStatus.message && (
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    {jobStatus.message}
                  </Typography>
                )}
                {jobStatus?.jobId && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Job ID: {jobStatus.jobId}
                  </Typography>
                )}
              </>
            ) : (
              <>
                <Typography variant="body1" gutterBottom>
                  Starting bulk operation...
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                </Box>
              </>
            )}
          </Box>
        ) : (
          <>
            <TextField
              fullWidth
              placeholder="Search folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            
            {selectedFolders.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography variant="body2" sx={{ width: '100%', mb: 1 }}>
                  Selected folders ({selectedFolders.length}):
                </Typography>
                {selectedFolders.map(folderId => {
                  const folder = folders.find(f => f.id === folderId);
                  return folder ? (
                    <Chip
                      key={folderId}
                      label={folder.name}
                      size="small"
                      onDelete={() => toggleFolderSelection(folderId)}
                    />
                  ) : null;
                })}
              </Box>
            )}
            
            {filteredFolders.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                No folders found
              </Typography>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {filteredFolders.map((folder) => {
                  const folderId = folder.id;
                  const isSelected = selectedFolders.includes(folderId);
                  
                  return (
                    <ListItem key={folderId} disablePadding>
                      <ListItemButton
                        onClick={() => toggleFolderSelection(folderId)}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={isSelected}
                            tabIndex={-1}
                            disableRipple
                            icon={<CheckBoxOutlineBlankIcon />}
                            checkedIcon={<CheckBoxIcon />}
                          />
                        </ListItemIcon>
                        <ListItemIcon>
                          <FolderIcon color={isSelected ? 'primary' : 'inherit'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body1">{folder.name}</Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              Path: {folder.path}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Tip: You can select multiple folders to add assets to all of them at once
            </Typography>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          {processing ? 'Processing...' : 'Cancel'}
        </Button>
        {!processing && (
          <Button
            onClick={handleAddToFolders}
            variant="contained"
            disabled={selectedFolders.length === 0}
          >
            Add to {selectedFolders.length} Folder{selectedFolders.length !== 1 ? 's' : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}