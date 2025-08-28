import {
  Box,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  alpha,
} from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { actionIcons } from '@/shared/ui/icons';

const SearchIcon = actionIcons.search;
const FilterIcon = actionIcons.filter;

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (event: SelectChangeEvent<string>) => void;
  dateRanges: Array<{ value: string; label: string }>;
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  dateRanges,
}: SearchBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: spacing.md / 8,
        p: spacing.md / 8,
        borderBottom: `1px solid ${colors.neutral[200]}`,
        bgcolor: alpha(colors.neutral[50], 0.5),
        backdropFilter: 'blur(10px)',
      }}
    >
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
  );
}