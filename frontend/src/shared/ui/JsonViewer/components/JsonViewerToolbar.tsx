/**
 * Toolbar for JSON viewer with actions and highlight chips
 */
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';

import TypedChip, { ChipType } from '@/shared/ui/TypedChip';

import { HighlightType } from '../utils/jsonHighlighter';

interface JsonViewerToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  highlightType: HighlightType;
  onHighlightChange: (type: HighlightType) => void;
  onCopy: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onClose: () => void;
}

const highlightChips: Array<{ type: ChipType; highlight: HighlightType; label: string }> = [
  { type: 'FIELDS', highlight: 'FIELDS', label: 'Fields' },
  { type: 'CALCULATED_FIELDS', highlight: 'CALCULATED_FIELDS', label: 'Calculated' },
  { type: 'VISUALS', highlight: 'VISUALS', label: 'Visuals' },
  { type: 'SHEETS', highlight: 'SHEETS', label: 'Sheets' },
  { type: 'DATASET', highlight: 'DATASET', label: 'DataSets' },
  { type: 'DATASOURCE', highlight: 'DATASOURCE', label: 'DataSources' },
  { type: 'FILTERS', highlight: 'FILTERS', label: 'Filters' },
  { type: 'EXPRESSIONS', highlight: 'EXPRESSIONS', label: 'Expressions' },
];

export function JsonViewerToolbar({
  searchTerm,
  onSearchChange,
  highlightType,
  onHighlightChange,
  onCopy,
  onExpandAll,
  onCollapseAll,
  onClose,
}: JsonViewerToolbarProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
      <TextField
        placeholder="Search JSON..."
        variant="outlined"
        size="small"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 200 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      
      <Stack direction="row" spacing={1} sx={{ flex: 1, overflow: 'auto' }}>
        {highlightChips.map(({ type, highlight, label }) => (
          <TypedChip
            key={type}
            type={type}
            customLabel={label}
            size="small"
            variant={highlightType === highlight ? 'filled' : 'outlined'}
            onClick={() => onHighlightChange(highlightType === highlight ? null : highlight)}
            showIcon={true}
          />
        ))}
      </Stack>
      
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={onCopy}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Expand All">
          <IconButton size="small" onClick={onExpandAll}>
            <ExpandIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Collapse All">
          <IconButton size="small" onClick={onCollapseAll}>
            <CollapseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}