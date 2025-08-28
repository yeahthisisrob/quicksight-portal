import {
  Close as CloseIcon,
  AutoAwesome as SuggestIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState, useEffect } from 'react';

import { semanticApi } from '@/shared/api';

interface SemanticMappingDialogProps {
  open: boolean;
  onClose: () => void;
  field: any;
  terms: any[];
  onSave: () => void;
}

interface MappingSuggestion {
  termId: string;
  reasons: string[];
  score: {
    nameMatch: number;
    descriptionMatch: number;
    dataTypeMatch: number;
    patternMatch: number;
    contextMatch: number;
  };
}

export default function SemanticMappingDialog({
  open,
  onClose,
  field,
  terms,
  onSave,
}: SemanticMappingDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const showSuggestions = true;

  // Get suggestions mutation
  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!field) return [];
      
      const fieldMetadata = {
        dataType: field.dataType,
        description: field.description,
        sampleValues: field.sampleValues,
        context: field.sources?.[0]?.assetName,
      };
      
      return semanticApi.suggestMappings({
        fieldName: field.fieldName,
        ...fieldMetadata,
      });
    },
    onSuccess: (data) => {
      setSuggestions(data || []);
    },
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async () => {
      if (!field || !selectedTermId) throw new Error('Missing required data');
      
      return semanticApi.createMapping({
        fieldId: field.semanticFieldId || field.fieldId,
        termId: selectedTermId,
        mappingType: 'manual',
        reason,
      });
    },
    onSuccess: () => {
      enqueueSnackbar('Mapping created successfully', { variant: 'success' });
      onSave();
      onClose();
    },
    onError: () => {
      enqueueSnackbar('Failed to create mapping', { variant: 'error' });
    },
  });

  useEffect(() => {
    if (open && field) {
      // Reset state
      setSelectedTermId('');
      setReason('');
      setSuggestions([]);
      
      // Load suggestions
      setLoadingSuggestions(true);
      suggestMutation.mutate();
      setLoadingSuggestions(false);
    }
  }, [open, field, suggestMutation]);

  const handleSelectSuggestion = (suggestion: MappingSuggestion) => {
    setSelectedTermId(suggestion.termId);
    setReason(suggestion.reasons.join('; '));
  };

  const handleSubmit = () => {
    if (!selectedTermId) {
      enqueueSnackbar('Please select a semantic term', { variant: 'error' });
      return;
    }
    
    createMappingMutation.mutate();
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const selectedTerm = terms.find(t => t.id === selectedTermId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Map Field to Semantic Term</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {field && (
          <>
            {/* Field Information */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Physical Field
              </Typography>
              <Typography variant="h6">{field.fieldName}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                {field.dataType && (
                  <Chip label={field.dataType} size="small" variant="outlined" />
                )}
                {field.isCalculated && (
                  <Chip label="Calculated" size="small" color="primary" />
                )}
                {field.sources?.[0] && (
                  <Chip 
                    label={`From: ${field.sources[0].assetName}`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
              </Box>
              {field.description && (
                <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                  {field.description}
                </Typography>
              )}
            </Box>

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  <SuggestIcon sx={{ fontSize: 20, verticalAlign: 'middle', mr: 0.5 }} />
                  AI Suggestions
                </Typography>
                {loadingSuggestions ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <List dense>
                    {suggestions.map((suggestion) => {
                      const term = terms.find(t => t.id === suggestion.termId);
                      if (!term) return null;
                      
                      return (
                        <ListItem
                          key={suggestion.termId}
                          button
                          selected={selectedTermId === suggestion.termId}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          sx={{ 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: 1, 
                            mb: 1,
                            '&.Mui-selected': {
                              borderColor: 'primary.main',
                              bgcolor: 'action.selected',
                            }
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2">
                                  {term.businessName}
                                </Typography>
                                <Chip
                                  label="Match"
                                  size="small"
                                  color={getScoreColor(
                                    suggestion.score.nameMatch + suggestion.score.descriptionMatch + 
                                    suggestion.score.dataTypeMatch + suggestion.score.patternMatch + 
                                    suggestion.score.contextMatch
                                  )}
                                />
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="caption" component="div">
                                  Technical: {term.term}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" component="div">
                                  {suggestion.reasons.join(' • ')}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Manual Selection */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Semantic Term</InputLabel>
                <Select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  label="Select Semantic Term"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {terms.map((term) => (
                    <MenuItem key={term.id} value={term.id}>
                      <Box>
                        <Typography variant="body2">{term.businessName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {term.term} {term.category && `• ${term.category}`}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedTerm && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {selectedTerm.businessName}
                  </Typography>
                  {selectedTerm.description && (
                    <Typography variant="caption">
                      {selectedTerm.description}
                    </Typography>
                  )}
                </Alert>
              )}


              <TextField
                fullWidth
                label="Mapping Reason (Optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                multiline
                rows={2}
                helperText="Explain why this mapping is appropriate"
              />
            </Box>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedTermId || createMappingMutation.isPending}
        >
          Create Mapping
        </Button>
      </DialogActions>
    </Dialog>
  );
}