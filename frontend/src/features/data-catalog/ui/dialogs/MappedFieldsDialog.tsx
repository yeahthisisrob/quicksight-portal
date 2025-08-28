/**
 * Refactored MappedFieldsDialog with reduced complexity
 */
import {
  Close as CloseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { MappedFieldItem } from './mapped-fields/MappedFieldItem';
import {
  filterMappingsBySearch,
  mapPhysicalFields,
  mapVisualFields,
  processMappings,
} from './mapped-fields/utils';

interface MappedFieldsDialogProps {
  open: boolean;
  onClose: () => void;
  term: any;
  mappings: any[];
  fields: any[];
  visualFields?: any[];
}

/**
 * Header component for the dialog
 */
function DialogHeader({ 
  term, 
  physicalCount, 
  visualCount, 
  onClose 
}: { 
  term: any; 
  physicalCount: number; 
  visualCount: number; 
  onClose: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="h6">
          Mapped Fields for "{term.businessName}"
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {physicalCount} physical field{physicalCount !== 1 ? 's' : ''} and {visualCount} visual field{visualCount !== 1 ? 's' : ''}
        </Typography>
      </Box>
      <IconButton onClick={onClose} size="small">
        <CloseIcon />
      </IconButton>
    </Box>
  );
}

/**
 * Search bar component
 */
function SearchBar({ 
  searchTerm, 
  onSearchChange, 
  activeTab 
}: { 
  searchTerm: string; 
  onSearchChange: (value: string) => void; 
  activeTab: number;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <TextField
        fullWidth
        placeholder={`Search ${activeTab === 0 ? 'physical' : 'visual'} fields...`}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
      No mapped fields found
    </Typography>
  );
}

export default function MappedFieldsDialog({
  open,
  onClose,
  term,
  mappings,
  fields,
  visualFields = [],
}: MappedFieldsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  if (!term) return null;

  // Process mappings
  const { physicalFieldMappings, visualFieldMappings } = processMappings(mappings, term.id);
  
  // Map field data
  const mappedPhysicalFieldsData = mapPhysicalFields(physicalFieldMappings, fields);
  const mappedVisualFieldsData = mapVisualFields(visualFieldMappings, visualFields);

  // Get current data based on active tab
  const currentData = activeTab === 0 ? mappedPhysicalFieldsData : mappedVisualFieldsData;
  
  // Filter by search
  const filteredMappings = filterMappingsBySearch(currentData, searchTerm);

  // Determine if tabs should be shown
  const showTabs = physicalFieldMappings.length > 0 && visualFieldMappings.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <DialogHeader
          term={term}
          physicalCount={physicalFieldMappings.length}
          visualCount={visualFieldMappings.length}
          onClose={onClose}
        />
      </DialogTitle>
      
      <DialogContent>
        {showTabs && (
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label={`Physical Fields (${physicalFieldMappings.length})`} />
            <Tab label={`Visual Fields (${visualFieldMappings.length})`} />
          </Tabs>
        )}
        
        <SearchBar 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeTab={activeTab}
        />

        {filteredMappings.length === 0 ? (
          <EmptyState />
        ) : (
          <List>
            {filteredMappings.map((item, index) => (
              <MappedFieldItem
                key={`${item.id}-${index}`}
                item={item}
                activeTab={activeTab}
                index={index}
              />
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}