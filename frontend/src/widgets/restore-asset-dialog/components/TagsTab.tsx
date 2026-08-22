/**
 * Tags tab component for RestoreAssetDialog
 */
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { actionIcons } from '@/shared/ui/icons';

const AddIcon = actionIcons.add;

interface TagsTabProps {
  tags: Array<{ key: string; value: string }>;
  onTagsChange: (tags: Array<{ key: string; value: string }>) => void;
}

export function TagsTab({ tags, onTagsChange }: TagsTabProps) {
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');

  const handleAddTag = () => {
    if (newTagKey && newTagValue) {
      onTagsChange([...tags, { key: newTagKey, value: newTagValue }]);
      setNewTagKey('');
      setNewTagValue('');
    }
  };

  const handleRemoveTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Tags
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          {tags.map((tag, index) => (
            <Chip
              key={index}
              label={`${tag.key}: ${tag.value}`}
              onDelete={() => handleRemoveTag(index)}
              size="small"
            />
          ))}
          {tags.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No tags defined
            </Typography>
          )}
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Add New Tag
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Key"
            value={newTagKey}
            onChange={(e) => setNewTagKey(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Value"
            value={newTagValue}
            onChange={(e) => setNewTagValue(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            onClick={handleAddTag}
            disabled={!newTagKey || !newTagValue}
            startIcon={<AddIcon />}
          >
            Add
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}