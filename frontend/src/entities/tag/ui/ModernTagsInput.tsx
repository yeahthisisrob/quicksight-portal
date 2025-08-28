import {
  Box,
  Chip,
  TextField,
  IconButton,
  Paper,
  Typography,
  Autocomplete,
  createFilterOptions,
  Fade,
  useTheme,
  alpha,
} from '@mui/material';
import { useState, KeyboardEvent, useRef, useEffect } from 'react';

import { actionIcons } from '@/shared/ui/icons';

const TagIcon = actionIcons.tag;
const AddIcon = actionIcons.add;
const CloseIcon = actionIcons.close;

interface Tag {
  key: string;
  value: string;
}

interface ModernTagsInputProps {
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
  commonTagKeys?: string[];
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

const filter = createFilterOptions<string>();

export default function ModernTagsInput({
  tags,
  onChange,
  commonTagKeys = [],
  placeholder = 'Add tags',
  maxTags,
  disabled = false,
  size = 'medium',
}: ModernTagsInputProps) {
  const theme = useTheme();
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [keyInputError, setKeyInputError] = useState('');
  const [valueInputError, setValueInputError] = useState('');
  const [showValueInput, setShowValueInput] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showValueInput && valueInputRef.current) {
      valueInputRef.current.focus();
    }
  }, [showValueInput]);

  const handleAddTag = () => {
    // Validate
    if (!newTagKey.trim()) {
      setKeyInputError('Tag key is required');
      return;
    }
    if (showValueInput && !newTagValue.trim()) {
      setValueInputError('Tag value is required');
      return;
    }

    // Check for duplicates
    if (tags.some(tag => tag.key === newTagKey.trim())) {
      setKeyInputError('This tag key already exists');
      return;
    }

    // Check max tags
    if (maxTags && tags.length >= maxTags) {
      setKeyInputError(`Maximum ${maxTags} tags allowed`);
      return;
    }

    // Add the tag
    onChange([...tags, { key: newTagKey.trim(), value: newTagValue.trim() || newTagKey.trim() }]);
    
    // Reset inputs
    setNewTagKey('');
    setNewTagValue('');
    setShowValueInput(false);
    setKeyInputError('');
    setValueInputError('');
  };

  const handleKeyChange = (value: string | null) => {
    setNewTagKey(value || '');
    setKeyInputError('');
    if (value) {
      setShowValueInput(true);
    }
  };

  const handleValueKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagKey: string) => {
    onChange(tags.filter(tag => tag.key !== tagKey));
  };

  const chipColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.info.main,
    theme.palette.warning.main,
  ];

  const getChipColor = (index: number) => {
    return chipColors[index % chipColors.length];
  };

  return (
    <Box>
      {/* Tags Display */}
      {tags.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1, display: 'block' }}>
            {tags.length} tag{tags.length !== 1 ? 's' : ''} applied
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {tags.map((tag, index) => (
              <Fade in key={tag.key}>
                <Chip
                  icon={<TagIcon sx={{ fontSize: 16 }} />}
                  label={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <strong>{tag.key}</strong>
                      {tag.value !== tag.key && (
                        <>
                          <span style={{ opacity: 0.7 }}>:</span>
                          <span>{tag.value}</span>
                        </>
                      )}
                    </Box>
                  }
                  onDelete={disabled ? undefined : () => handleRemoveTag(tag.key)}
                  deleteIcon={<CloseIcon sx={{ fontSize: 16 }} />}
                  size={size}
                  sx={{
                    bgcolor: alpha(getChipColor(index), 0.08),
                    color: getChipColor(index),
                    borderColor: alpha(getChipColor(index), 0.3),
                    border: 1,
                    '& .MuiChip-deleteIcon': {
                      color: getChipColor(index),
                      opacity: 0.7,
                      '&:hover': {
                        opacity: 1,
                      },
                    },
                    '&:hover': {
                      bgcolor: alpha(getChipColor(index), 0.12),
                    },
                  }}
                />
              </Fade>
            ))}
          </Box>
        </Box>
      )}

      {/* Add New Tag */}
      {(!maxTags || tags.length < maxTags) && !disabled && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            borderColor: alpha(theme.palette.divider, 0.3),
            borderStyle: 'dashed',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Autocomplete
              size={size}
              freeSolo
              options={commonTagKeys}
              value={newTagKey}
              onChange={(_, value) => handleKeyChange(value)}
              onInputChange={(_, value) => handleKeyChange(value)}
              filterOptions={(options, params) => {
                const filtered = filter(options, params);
                const { inputValue } = params;
                // Suggest creating a new value
                const isExisting = options.some((option) => inputValue === option);
                if (inputValue !== '' && !isExisting) {
                  filtered.push(inputValue);
                }
                return filtered;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tag Key"
                  placeholder={placeholder}
                  error={!!keyInputError}
                  helperText={keyInputError}
                  sx={{ minWidth: 200 }}
                />
              )}
            />

            <Fade in={showValueInput}>
              <TextField
                inputRef={valueInputRef}
                size={size}
                label="Tag Value"
                placeholder="Enter value (optional)"
                value={newTagValue}
                onChange={(e) => {
                  setNewTagValue(e.target.value);
                  setValueInputError('');
                }}
                onKeyPress={handleValueKeyPress}
                error={!!valueInputError}
                helperText={valueInputError}
                sx={{ minWidth: 200 }}
              />
            </Fade>

            <Fade in={showValueInput}>
              <IconButton
                color="primary"
                onClick={handleAddTag}
                disabled={!newTagKey.trim()}
                sx={{
                  mt: size === 'small' ? 0.5 : 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                <AddIcon />
              </IconButton>
            </Fade>
          </Box>

          {!showValueInput && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Type or select a tag key to get started
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}