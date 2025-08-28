import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  Chip,
  Box,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState, useEffect } from 'react';

import { semanticApi } from '@/shared/api';

interface SemanticTermDialogProps {
  open: boolean;
  onClose: () => void;
  term?: any;
  onSave: () => void;
}

export default function SemanticTermDialog({
  open,
  onClose,
  term,
  onSave,
}: SemanticTermDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [synonymInput, setSynonymInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  
  const [formData, setFormData] = useState({
    term: '',
    businessName: '',
    description: '',
    category: '',
    dataType: '',
    format: '',
    example: '',
    synonyms: [] as string[],
    tags: [] as string[],
    owner: '',
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['semantic-categories'],
    queryFn: semanticApi.getCategories,
    enabled: open,
  });

  useEffect(() => {
    if (term) {
      setFormData({
        term: term.term || '',
        businessName: term.businessName || '',
        description: term.description || '',
        category: term.category || '',
        dataType: term.dataType || '',
        format: term.format || '',
        example: term.example || '',
        synonyms: term.synonyms || [],
        tags: term.tags || [],
        owner: term.owner || '',
      });
    } else {
      setFormData({
        term: '',
        businessName: '',
        description: '',
        category: '',
        dataType: '',
        format: '',
        example: '',
        synonyms: [],
        tags: [],
        owner: '',
      });
    }
  }, [term]);

  const handleSubmit = async () => {
    if (!formData.term || !formData.businessName) {
      enqueueSnackbar('Technical term and business name are required', { variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (term?.id) {
        await semanticApi.updateTerm(term.id, formData);
        enqueueSnackbar('Term updated successfully', { variant: 'success' });
      } else {
        await semanticApi.createTerm(formData);
        enqueueSnackbar('Term created successfully', { variant: 'success' });
      }
      onSave();
      onClose();
    } catch (_error) {
      enqueueSnackbar('Failed to save term', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSynonym = () => {
    if (synonymInput.trim() && !formData.synonyms.includes(synonymInput.trim())) {
      setFormData({
        ...formData,
        synonyms: [...formData.synonyms, synonymInput.trim()],
      });
      setSynonymInput('');
    }
  };

  const handleRemoveSynonym = (synonym: string) => {
    setFormData({
      ...formData,
      synonyms: formData.synonyms.filter(s => s !== synonym),
    });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag),
    });
  };

  const dataTypes = [
    'String',
    'Number',
    'Integer',
    'Decimal',
    'Date',
    'DateTime',
    'Boolean',
    'JSON',
    'Array',
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {term ? 'Edit Semantic Term' : 'Create Semantic Term'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Technical Term"
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              required
              helperText="The technical field name or identifier"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Business Name"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              required
              helperText="User-friendly business name"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              helperText="Detailed description of what this term represents"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {categories?.map((cat: any) => (
                <MenuItem key={cat.id} value={cat.name}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Data Type"
              value={formData.dataType}
              onChange={(e) => setFormData({ ...formData, dataType: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {dataTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Format/Pattern"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value })}
              helperText="e.g., YYYY-MM-DD, ###-##-####"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Example Value"
              value={formData.example}
              onChange={(e) => setFormData({ ...formData, example: e.target.value })}
              helperText="Sample value for reference"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Add Synonym"
              value={synonymInput}
              onChange={(e) => setSynonymInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSynonym()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleAddSynonym} edge="end">
                      <AddIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText="Alternative names for this term"
            />
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {formData.synonyms.map((synonym) => (
                <Chip
                  key={synonym}
                  label={synonym}
                  size="small"
                  onDelete={() => handleRemoveSynonym(synonym)}
                />
              ))}
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Add Tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleAddTag} edge="end">
                      <AddIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText="Tags for categorization and search"
            />
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {formData.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
                />
              ))}
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Owner"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              helperText="Business owner or steward"
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {term ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}