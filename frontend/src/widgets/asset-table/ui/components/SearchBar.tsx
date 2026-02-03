import {
  Box,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Typography,
  alpha,
} from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { actionIcons } from '@/shared/ui/icons';
import { SearchMatchChip } from '@/shared/ui/SearchMatchChip';

import type { SearchMatchReason } from '@shared/generated';

const SearchIcon = actionIcons.search;
const FilterIcon = actionIcons.filter;

/**
 * Summary of match reasons found in search results
 */
export interface MatchReasonSummary {
  reason: SearchMatchReason;
  count: number;
}

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (event: SelectChangeEvent<string>) => void;
  dateRanges: Array<{ value: string; label: string }>;
  /** Summary of match reasons found in current search results */
  matchReasonSummary?: MatchReasonSummary[];
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  dateRanges,
  matchReasonSummary,
}: SearchBarProps) {
  const hasMatchReasons = searchTerm && matchReasonSummary && matchReasonSummary.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: hasMatchReasons ? spacing.sm / 8 : 0,
        p: spacing.md / 8,
        borderBottom: `1px solid ${colors.neutral[200]}`,
        bgcolor: alpha(colors.neutral[50], 0.5),
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box sx={{ display: 'flex', gap: spacing.md / 8 }}>
        <TextField
        size="small"
        placeholder="Search assets..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{
          flex: 1,
          '& .MuiOutlinedInput-root': {
            bgcolor: 'white',
            borderRadius: `${spacing.sm / 8}px`,
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: colors.primary.main,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.primary.main,
              },
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(colors.primary.main, 0.1)}`,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.primary.main,
                borderWidth: '1px',
              },
            },
          },
          '& .MuiInputAdornment-root': {
            color: colors.neutral[400],
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
        <Select
          value={dateFilter}
          onChange={onDateFilterChange}
          sx={{
            bgcolor: 'white',
            borderRadius: `${spacing.sm / 8}px`,
            transition: 'all 0.2s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary.main,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary.main,
              borderWidth: '1px',
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(colors.primary.main, 0.1)}`,
            },
            '& .MuiSelect-icon': {
              color: colors.neutral[400],
              transition: 'transform 0.2s ease',
            },
            '&:hover .MuiSelect-icon': {
              color: colors.primary.main,
            },
          }}
          startAdornment={
            <InputAdornment position="start" sx={{ ml: 0.5 }}>
              <FilterIcon sx={{ color: colors.neutral[400] }} />
            </InputAdornment>
          }
        >
          {dateRanges.map((range) => (
            <MenuItem 
              key={range.value} 
              value={range.value}
              sx={{
                '&:hover': {
                  bgcolor: alpha(colors.primary.main, 0.08),
                },
                '&.Mui-selected': {
                  bgcolor: alpha(colors.primary.main, 0.12),
                  '&:hover': {
                    bgcolor: alpha(colors.primary.main, 0.16),
                  },
                },
              }}
            >
              {range.label}
            </MenuItem>
          ))}
          </Select>
        </FormControl>
      </Box>

      {/* Match reasons summary - shown when search is active */}
      {hasMatchReasons && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexWrap: 'wrap',
            px: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Matched by:
          </Typography>
          {matchReasonSummary.map(({ reason, count }) => (
            <SearchMatchChip
              key={reason}
              reason={reason}
              size="small"
              label={`${count}`}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}