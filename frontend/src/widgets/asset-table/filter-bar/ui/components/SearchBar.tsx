import { Search as SearchIcon } from '@mui/icons-material';
import { Box, TextField, Chip, Stack, Typography, InputAdornment } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import type { MatchReasonSummary } from '../../lib/types';

interface SearchBarProps {
  searchTerm?: string;
  onSearchChange: (value: string) => void;
  matchReasonSummary?: MatchReasonSummary[];
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  matchReasonSummary,
}) => (
  <Box sx={{ px: 2, pt: 2 }}>
    <TextField
      fullWidth
      size="small"
      placeholder="Search assets..."
      value={searchTerm || ''}
      onChange={(e) => onSearchChange(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: colors.neutral[400] }} />
          </InputAdornment>
        ),
      }}
    />
    {matchReasonSummary && matchReasonSummary.length > 0 && (
      <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Matched by:
        </Typography>
        {matchReasonSummary.map((reason, idx) => (
          <Chip
            key={idx}
            label={`${reason.reason} (${reason.count})`}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        ))}
      </Stack>
    )}
  </Box>
);
