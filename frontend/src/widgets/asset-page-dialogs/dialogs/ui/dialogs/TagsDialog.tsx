import {
  Close as CloseIcon,
  LocalOffer as TagIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  VisibilityOff as HiddenIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  alpha,
  TextField,
  Grid,
  Autocomplete,
  Button,
  CircularProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState, useEffect } from 'react';

import { assetsApi } from '@/shared/api';
import { borderRadius, typography, colors, spacing } from '@/shared/design-system/theme';
import { TypedChip } from '@/shared/ui';

import { TagsDialogProps } from '../../model';

interface Tag {
  key: string;
  value: string;
}

// Common tag suggestions for QuickSight assets
const commonTagKeys = [
  'Environment',
  'Owner',
  'Department',
  'Project',
  'CostCenter',
  'DataClassification',
  'BusinessUnit',
  'Application',
  'Team',
  'Purpose',
  'Criticality',
  'Compliance',
  'Region',
  'Version',
  'Status',
];

// Portal exclusion tags
const PORTAL_EXCLUDE_TAGS = {
  EXCLUDE_FROM_CATALOG: 'Portal:ExcludeFromCatalog',
  EXCLUDE_FROM_PORTAL: 'Portal:ExcludeFromPortal',
};

const TagRow = ({ 
  tag, 
  onDelete, 
  editMode, 
  isLast 
}: { 
  tag: Tag; 
  onDelete?: () => void; 
  editMode: boolean;
  isLast: boolean;
}) => {
  const isPortalTag = tag.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_CATALOG || 
                     tag.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL;
  
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          backgroundColor: 'background.paper',
          borderRadius: `${borderRadius.sm}px`,
          transition: 'all 0.2s',
          '&:hover': editMode ? {
            backgroundColor: alpha(colors.neutral[100], 0.5),
          } : {},
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
          <Box sx={{ flex: '0 0 35%', minWidth: 0 }}>
            <Typography 
              variant="body2" 
              fontWeight={typography.fontWeight.medium}
              sx={{ 
                color: isPortalTag ? colors.status.warning : 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tag.key}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tag.value}
            </Typography>
          </Box>
        </Box>
        {editMode && (
          <IconButton
            size="small"
            onClick={onDelete}
            sx={{ 
              ml: 1,
              color: 'text.secondary',
              '&:hover': {
                color: colors.status.error,
                backgroundColor: alpha(colors.status.error, 0.1),
              }
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
      {!isLast && (
        <Box sx={{ height: 1, backgroundColor: 'divider', mx: 1 }} />
      )}
    </>
  );
};

const PortalVisibilityControls = ({ 
  tags, 
  onToggleTag 
}: { 
  tags: Tag[]; 
  onToggleTag: (tagKey: string, value: string) => void;
}) => {
  const hasCatalogExclusion = tags.some(t => t.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_CATALOG);
  const hasPortalExclusion = tags.some(t => t.key === PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL);

  return (
    <Paper
      variant="outlined"
      sx={{ 
        p: spacing.md / 8,
        borderRadius: `${borderRadius.md}px`,
        backgroundColor: alpha(colors.status.warning, 0.05),
        border: `1px solid ${alpha(colors.status.warning, 0.2)}`,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: typography.fontWeight.semibold }}>
        Portal Visibility Controls
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${borderRadius.sm}px`,
              backgroundColor: hasCatalogExclusion ? alpha(colors.status.warning, 0.1) : 'background.paper',
              border: `1px solid ${hasCatalogExclusion ? colors.status.warning : colors.neutral[300]}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: alpha(colors.status.warning, hasCatalogExclusion ? 0.15 : 0.05),
              }
            }}
            onClick={() => onToggleTag(PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_CATALOG, 'true')}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <HiddenIcon sx={{ fontSize: 20, color: colors.status.warning }} />
              <Typography variant="body2" fontWeight={typography.fontWeight.medium}>
                {hasCatalogExclusion ? 'Hidden from Catalog' : 'Hide from Catalog'}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Exclude from data catalog
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${borderRadius.sm}px`,
              backgroundColor: hasPortalExclusion ? alpha(colors.status.error, 0.1) : 'background.paper',
              border: `1px solid ${hasPortalExclusion ? colors.status.error : colors.neutral[300]}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: alpha(colors.status.error, hasPortalExclusion ? 0.15 : 0.05),
              }
            }}
            onClick={() => onToggleTag(PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL, 'true')}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <HiddenIcon sx={{ fontSize: 20, color: colors.status.error }} />
              <Typography variant="body2" fontWeight={typography.fontWeight.medium}>
                {hasPortalExclusion ? 'Hidden from Portal' : 'Hide from Portal'}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Complete portal exclusion
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default function TagsDialog({
  open,
  onClose,
  assetName,
  assetType,
  assetId,
  resourceType,
  initialTags = [],
  onTagsUpdate,
}: TagsDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [editMode, setEditMode] = useState(false);
  const [newTag, setNewTag] = useState({ key: '', value: '' });
  const [saving, setSaving] = useState(false);

  // Update tags when initialTags changes
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const handleAddTag = () => {
    if (!newTag.key || !newTag.value) {
      enqueueSnackbar('Both key and value are required', { variant: 'warning' });
      return;
    }

    if (tags.some(tag => tag.key === newTag.key)) {
      enqueueSnackbar('Tag key already exists', { variant: 'warning' });
      return;
    }

    setTags([...tags, newTag]);
    setNewTag({ key: '', value: '' });
  };

  const handleDeleteTag = (tagKey: string) => {
    setTags(tags.filter(tag => tag.key !== tagKey));
  };

  const handleTogglePortalTag = (tagKey: string, value: string) => {
    const hasTag = tags.some(t => t.key === tagKey);
    if (hasTag) {
      handleDeleteTag(tagKey);
    } else {
      setTags([...tags, { key: tagKey, value }]);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert tags to API format (uppercase Key/Value)
      const apiTags = tags.map(tag => ({
        Key: tag.key,
        Value: tag.value
      }));
      
      // Call the API to update tags
      await assetsApi.updateAssetTags(assetType, assetId, apiTags);
      
      // Call the callback to update local state
      if (onTagsUpdate) {
        onTagsUpdate(tags);
      }
      
      enqueueSnackbar('Tags updated successfully', { variant: 'success' });
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save tags:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to save tags', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.key && newTag.value) {
      handleAddTag();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${borderRadius.lg}px`,
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={typography.fontWeight.semibold} gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={assetType}
                size="small"
                sx={{ 
                  fontWeight: typography.fontWeight.medium,
                  textTransform: 'capitalize',
                }}
              />
              <Typography variant="body1" color="text.secondary">
                {assetName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton 
              size="small" 
              onClick={() => setEditMode(!editMode)}
              disabled={saving}
              sx={{ color: editMode ? 'primary.main' : 'text.secondary' }}
            >
              {editMode ? <ViewIcon /> : <EditIcon />}
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {/* Portal Visibility Controls - Only for Folders */}
        {resourceType === 'folder' && editMode && (
          <Box sx={{ mb: 3 }}>
            <PortalVisibilityControls 
              tags={tags} 
              onToggleTag={handleTogglePortalTag}
            />
          </Box>
        )}

        {/* Tags Display */}
        <Paper
          variant="outlined"
          sx={{ 
            p: spacing.md / 8,
            borderRadius: `${borderRadius.md}px`,
            backgroundColor: tags.length > 0 ? alpha(colors.primary.light, 0.05) : 'transparent',
            border: `1px solid ${tags.length > 0 ? alpha(colors.primary.main, 0.2) : 'transparent'}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: tags.length > 0 ? 1.5 : 0 }}>
            <TagIcon sx={{ fontSize: 20, color: tags.length > 0 ? colors.primary.main : 'text.disabled' }} />
            <Typography 
              variant="subtitle1" 
              fontWeight={typography.fontWeight.semibold}
              color={tags.length > 0 ? 'text.primary' : 'text.disabled'}
            >
              Tags
            </Typography>
            {tags.length > 0 && (
              <TypedChip 
                type="TAG"
                count={tags.length}
                showIcon={false}
                size="small"
              />
            )}
          </Box>
          
          {tags.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No tags defined
            </Typography>
          ) : (
            <Box>
              {/* Headers */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.5,
                  py: 1,
                  borderBottom: `2px solid ${colors.neutral[200]}`,
                  mb: 0.5,
                }}
              >
                <Box sx={{ flex: '0 0 35%' }}>
                  <Typography 
                    variant="caption" 
                    fontWeight={typography.fontWeight.semibold}
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    Key
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="caption" 
                    fontWeight={typography.fontWeight.semibold}
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    Value
                  </Typography>
                </Box>
                {editMode && (
                  <Box sx={{ width: 40 }} />
                )}
              </Box>
              
              {/* Tag Rows */}
              {tags.map((tag, index) => (
                <TagRow
                  key={index}
                  tag={tag}
                  onDelete={() => handleDeleteTag(tag.key)}
                  editMode={editMode}
                  isLast={index === tags.length - 1}
                />
              ))}
            </Box>
          )}
        </Paper>

        {/* Add New Tag Form */}
        {editMode && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: typography.fontWeight.semibold }}>
              Add New Tag
            </Typography>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={5}>
                <Autocomplete
                  freeSolo
                  options={commonTagKeys}
                  value={newTag.key}
                  onChange={(_, value) => setNewTag({ ...newTag, key: value || '' })}
                  onInputChange={(_, value) => setNewTag({ ...newTag, key: value })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Key"
                      size="small"
                      fullWidth
                      onKeyPress={handleKeyPress}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  label="Value"
                  size="small"
                  fullWidth
                  value={newTag.value}
                  onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
                  onKeyPress={handleKeyPress}
                />
              </Grid>
              <Grid item xs={2}>
                <IconButton
                  color="primary"
                  onClick={handleAddTag}
                  disabled={!newTag.key || !newTag.value}
                  sx={{
                    backgroundColor: alpha(colors.primary.main, 0.1),
                    '&:hover': {
                      backgroundColor: alpha(colors.primary.main, 0.2),
                    }
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Save Button */}
        {editMode && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving && <CircularProgress size={16} />}
            >
              Save Changes
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}