import {
  Close as CloseIcon,
  Search as SearchIcon,
  Warning as UnmappedIcon,
  AutoAwesome as SuggestIcon,
  TrendingUp as UsageIcon,
  DataObject as FieldIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Alert,
  Badge,
  Tabs,
  Tab,
} from '@mui/material';
import { useState } from 'react';

interface UnmappedFieldsDialogProps {
  open: boolean;
  onClose: () => void;
  unmappedFields: any[];
  onMapField: (field: any) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`unmapped-tabpanel-${index}`}
      aria-labelledby={`unmapped-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function UnmappedFieldsDialog({
  open,
  onClose,
  unmappedFields,
  onMapField,
}: UnmappedFieldsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedDataType, setSelectedDataType] = useState<string>('all');

  // Filter fields based on search and data type
  const filteredFields = unmappedFields.filter(field => {
    const matchesSearch = !searchTerm || 
      field.fieldName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.sourceName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDataType = selectedDataType === 'all' || 
      field.dataType === selectedDataType;
    
    return matchesSearch && matchesDataType;
  });

  // Group fields by source
  const fieldsBySource = filteredFields.reduce((acc, field) => {
    const key = `${field.sourceType}-${field.sourceId}`;
    if (!acc[key]) {
      acc[key] = {
        sourceType: field.sourceType,
        sourceName: field.sourceName,
        fields: [],
      };
    }
    acc[key].fields.push(field);
    return acc;
  }, {} as Record<string, any>);

  // Get most used fields
  const mostUsedFields = [...filteredFields]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  // Get fields with suggestions
  const fieldsWithSuggestions = filteredFields.filter(
    field => field.suggestions && field.suggestions.length > 0
  );

  // Get unique data types
  const dataTypes = Array.from(new Set(unmappedFields.map(f => f.dataType).filter(Boolean)));

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'dataset':
        return <Chip label="Dataset" size="small" color="primary" />;
      case 'analysis':
        return <Chip label="Analysis" size="small" color="secondary" />;
      case 'dashboard':
        return <Chip label="Dashboard" size="small" color="success" />;
      default:
        return null;
    }
  };

  const renderFieldItem = (field: any, showSource = true) => (
    <ListItem
      key={field.fieldId}
      sx={{ 
        border: 1, 
        borderColor: 'divider', 
        borderRadius: 1, 
        mb: 1 
      }}
    >
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FieldIcon fontSize="small" color="action" />
            <Typography variant="subtitle2">{field.fieldName}</Typography>
            {field.dataType && (
              <Chip label={field.dataType} size="small" variant="outlined" />
            )}
            {field.occurrences > 1 && (
              <Badge badgeContent={field.occurrences} color="primary" max={99}>
                <UsageIcon fontSize="small" color="action" />
              </Badge>
            )}
          </Box>
        }
        secondary={
          <Box>
            {showSource && (
              <Typography variant="caption" component="div">
                From: {field.sourceName} ({field.sourceType})
              </Typography>
            )}
            {field.description && (
              <Typography variant="caption" color="text.secondary" component="div">
                {field.description}
              </Typography>
            )}
            {field.suggestions && field.suggestions.length > 0 && (
              <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SuggestIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="primary">
                  {field.suggestions.length} suggestion{field.suggestions.length > 1 ? 's' : ''} available
                </Typography>
              </Box>
            )}
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onMapField(field)}
        >
          Map
        </Button>
      </ListItemSecondaryAction>
    </ListItem>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UnmappedIcon color="warning" />
            <Typography variant="h6">
              Unmapped Fields ({unmappedFields.length})
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {unmappedFields.length === 0 ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Great! All fields are mapped to semantic terms.
          </Alert>
        ) : (
          <>
            {/* Search and Filter */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                label="Data Type"
                value={selectedDataType}
                onChange={(e) => setSelectedDataType(e.target.value)}
                size="small"
                sx={{ minWidth: 150 }}
                SelectProps={{
                  native: true,
                }}
              >
                <option value="all">All Types</option>
                {dataTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </TextField>
            </Box>

            {/* Tabs */}
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label={`All Fields (${filteredFields.length})`} />
              <Tab label={`Most Used (${mostUsedFields.length})`} />
              <Tab label={`With Suggestions (${fieldsWithSuggestions.length})`} />
              <Tab label="By Source" />
            </Tabs>

            {/* All Fields */}
            <TabPanel value={selectedTab} index={0}>
              <List dense>
                {filteredFields.map(field => renderFieldItem(field))}
              </List>
            </TabPanel>

            {/* Most Used */}
            <TabPanel value={selectedTab} index={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Fields sorted by usage frequency across assets
              </Typography>
              <List dense>
                {mostUsedFields.map(field => renderFieldItem(field))}
              </List>
            </TabPanel>

            {/* With Suggestions */}
            <TabPanel value={selectedTab} index={2}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Fields with AI-powered mapping suggestions
              </Typography>
              <List dense>
                {fieldsWithSuggestions.map(field => renderFieldItem(field))}
              </List>
            </TabPanel>

            {/* By Source */}
            <TabPanel value={selectedTab} index={3}>
              {Object.entries(fieldsBySource).map(([key, source]: [string, any]) => (
                <Box key={key} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getSourceIcon(source.sourceType)}
                    <Typography variant="subtitle1">
                      {source.sourceName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({source.fields.length} fields)
                    </Typography>
                  </Box>
                  <List dense>
                    {source.fields.map((field: any) => renderFieldItem(field, false))}
                  </List>
                </Box>
              ))}
            </TabPanel>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}