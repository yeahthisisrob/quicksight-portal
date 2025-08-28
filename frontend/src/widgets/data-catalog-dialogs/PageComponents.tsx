/**
 * Page components for DataCatalogPage
 */
import { Search as SearchIcon } from '@mui/icons-material';
import { Box, InputAdornment, TextField } from '@mui/material';

import {
  CalculatedView,
  MappingView,
  PhysicalView,
  SemanticView,
  VisualFieldsView,
} from '@/features/data-catalog';

import { colors } from '@/shared/design-system/theme';

/**
 * Search bar component
 */
export function SearchBar({ 
  searchTerm, 
  onSearchChange 
}: { 
  searchTerm: string; 
  onSearchChange: (value: string) => void;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <TextField
        fullWidth
        placeholder="Search fields, terms, or descriptions..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        variant="outlined"
        size="medium"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: 1,
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: colors.primary.main,
            },
          },
        }}
      />
    </Box>
  );
}

/**
 * Main content view switcher
 */
export function ContentView({ 
  viewMode,
  rows,
  totalRows,
  loading,
  page,
  pageSize,
  sortModel,
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  dialogHandlers,
  additionalData
}: any) {
  const viewProps = {
    data: rows,
    totalItems: totalRows,
    loading,
    page,
    pageSize,
    sortModel,
    onPageChange,
    onPageSizeChange,
    onSortModelChange,
    ...dialogHandlers,
    ...additionalData,
  };
  
  switch (viewMode) {
    case 'physical':
      return <PhysicalView {...viewProps} onShowDetails={viewProps.onFieldClick} />;
    case 'semantic':
      return <SemanticView {...viewProps} />;
    case 'mapping':
      return <MappingView {...viewProps} />;
    case 'visual-fields':
      return <VisualFieldsView {...viewProps} />;
    case 'calculated':
      return <CalculatedView {...viewProps} onShowDetails={viewProps.onFieldClick} />;
    default:
      return null;
  }
}