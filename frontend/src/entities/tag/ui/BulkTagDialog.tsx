import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Chip,
  Stack,
  IconButton,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { assetsApi } from '@/shared/api';
import { actionIcons } from '@/shared/ui/icons';

const TagIcon = actionIcons.tag;
const AddIcon = actionIcons.add;
const CloseIcon = actionIcons.close;

interface BulkTagDialogProps {
  open: boolean;
  onClose: () => void;
  selectedAssets: Array<{ id: string; name: string; type: string }>;
  onComplete?: () => void;
}

interface Tag {
  key: string;
  value: string;
}

export default function BulkTagDialog({
  open,
  onClose,
  selectedAssets,
  onComplete,
}: BulkTagDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [tags, setTags] = useState<Tag[]>([{ key: '', value: '' }]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleAddTag = () => {
    setTags([...tags, { key: '', value: '' }]);
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleTagChange = (index: number, field: 'key' | 'value', value: string) => {
    const newTags = [...tags];
    newTags[index][field] = value;
    setTags(newTags);
  };

  const handleApplyTags = async () => {
    // Validate tags
    const validTags = tags.filter(tag => tag.key && tag.value);
    if (validTags.length === 0) {
      enqueueSnackbar('Please add at least one valid tag', { variant: 'warning' });
      return;
    }

    setProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setErrors([]);

    try {
      // Group assets by type for bulk operations
      const assetsByType = new Map<string, Array<{ id: string; name: string }>>();
      selectedAssets.forEach(asset => {
        const assets = assetsByType.get(asset.type) || [];
        assets.push({ id: asset.id, name: asset.name });
        assetsByType.set(asset.type, assets);
      });

      let totalProcessed = 0;
      
      // Process each asset type
      for (const [assetType, assets] of assetsByType) {
        try {
          const assetIds = assets.map(a => a.id);
          
          // Use bulk update API with 'add' operation to add/update tags
          const result = await assetsApi.bulkUpdateAssetTags(
            assetType,
            assetIds,
            'add',
            validTags
          );
          
          // Count successes and failures from the bulk operation
          if (result.summary) {
            totalProcessed += result.summary.successful;
            result.results?.forEach((r: any) => {
              if (!r.success) {
                const asset = assets.find(a => a.id === r.assetId);
                setErrors(prev => [...prev, `${asset?.name || r.assetId}: ${r.error || 'Failed to apply tags'}`]);
              }
            });
          }
          
          setProcessedCount(totalProcessed);
          setProgress((totalProcessed / selectedAssets.length) * 100);
        } catch (error: any) {
          // If bulk operation fails entirely, add all assets of this type to errors
          assets.forEach(asset => {
            setErrors(prev => [...prev, `${asset.name}: ${error.message || 'Failed to apply tags'}`]);
          });
        }
      }
    } catch (error: any) {
      enqueueSnackbar(`Failed to apply tags: ${error.message}`, { variant: 'error' });
    }

    // Show completion message
    const successCount = processedCount - errors.length;
    if (successCount > 0) {
      enqueueSnackbar(
        `Successfully tagged ${successCount} asset${successCount !== 1 ? 's' : ''}`,
        { variant: 'success' }
      );
    }
    
    if (errors.length > 0) {
      enqueueSnackbar(
        `Failed to tag ${errors.length} asset${errors.length !== 1 ? 's' : ''}`,
        { variant: 'error' }
      );
    }

    setTimeout(() => {
      onClose();
      onComplete?.();
    }, 1500);
  };

  const handleClose = () => {
    if (!processing) {
      setTags([{ key: '', value: '' }]);
      setErrors([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TagIcon color="primary" />
          <Typography variant="h6">
            Apply Tags to {selectedAssets.length} Asset{selectedAssets.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {processing ? (
          <Box sx={{ py: 2 }}>
            <Typography variant="body1" gutterBottom>
              Applying tags to assets...
            </Typography>
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Processed {processedCount} of {selectedAssets.length}
              </Typography>
            </Box>
            {errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  Errors occurred:
                </Typography>
                {errors.map((error, index) => (
                  <Typography key={index} variant="caption" display="block">
                    • {error}
                  </Typography>
                ))}
              </Alert>
            )}
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Tags will be applied to all selected assets. Existing tags with the same key will be updated.
            </Alert>
            
            <Stack spacing={2}>
              {tags.map((tag, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    label="Key"
                    value={tag.key}
                    onChange={(e) => handleTagChange(index, 'key', e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Value"
                    value={tag.value}
                    onChange={(e) => handleTagChange(index, 'value', e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    onClick={() => handleRemoveTag(index)}
                    disabled={tags.length === 1}
                    size="small"
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddTag}
              sx={{ mt: 2 }}
              variant="outlined"
              size="small"
            >
              Add Another Tag
            </Button>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Preview:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {tags
                  .filter(tag => tag.key && tag.value)
                  .map((tag, index) => (
                    <Chip
                      key={index}
                      label={`${tag.key}: ${tag.value}`}
                      size="small"
                      icon={<TagIcon />}
                    />
                  ))}
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          {processing ? 'Close' : 'Cancel'}
        </Button>
        <Button
          onClick={handleApplyTags}
          variant="contained"
          disabled={processing || !tags.some(tag => tag.key && tag.value)}
          startIcon={<TagIcon />}
        >
          Apply Tags
        </Button>
      </DialogActions>
    </Dialog>
  );
}