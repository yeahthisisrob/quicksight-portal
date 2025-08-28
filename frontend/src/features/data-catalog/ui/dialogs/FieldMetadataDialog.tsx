import {
  Close as CloseIcon,
  LocalOffer as TagIcon,
  Info as InfoIcon,
  AccountTree as LineageIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  CircularProgress,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState, useEffect } from 'react';

import { ModernTagsInput } from '@/entities/tag';

import { tagsApi } from '@/shared/api';

interface Tag {
  key: string;
  value: string;
}

interface FieldMetadataDialogProps {
  open: boolean;
  onClose: () => void;
  datasetId: string;
  field: {
    name: string;
    type?: string;
    expression?: string;
  };
  metadata?: any;
  onUpdate?: () => void;
}

const commonFieldTagKeys = [
  'BusinessUnit',
  'DataDomain',
  'DataOwner',
  'DataSteward',
  'SourceSystem',
  'UpdateFrequency',
  'DataCategory',
  'AnalyticsUse',
  'ReportingUse',
  'Critical',
  'Derived',
  'Calculated',
  'Key',
  'Metric',
  'Dimension',
];

export default function FieldMetadataDialog({
  open,
  onClose,
  datasetId,
  field,
  metadata,
  onUpdate,
}: FieldMetadataDialogProps) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('basic');
  
  // Field metadata state
  const [description, setDescription] = useState('');
  const [businessGlossary, setBusinessGlossary] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  
  // Lineage
  const [sourceSystem, setSourceSystem] = useState('');
  const [sourceTable, setSourceTable] = useState('');
  const [sourceField, setSourceField] = useState('');
  const [transformationLogic, setTransformationLogic] = useState('');
  const [updateFrequency, setUpdateFrequency] = useState('');

  useEffect(() => {
    if (metadata) {
      setDescription(metadata.description || '');
      setBusinessGlossary(metadata.businessGlossary || '');
      setTags(metadata.tags || []);
      
      if (metadata.lineage) {
        setSourceSystem(metadata.lineage.sourceSystem || '');
        setSourceTable(metadata.lineage.sourceTable || '');
        setSourceField(metadata.lineage.sourceField || '');
        setTransformationLogic(metadata.lineage.transformationLogic || '');
        setUpdateFrequency(metadata.lineage.updateFrequency || '');
      }
    }
  }, [metadata]);

  const handleAccordionChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedAccordion(isExpanded ? panel : false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatedMetadata = {
        fieldId: `dataset::${datasetId}::${field.name}`,
        sourceType: 'dataset' as const,
        datasetId,
        fieldName: field.name,
        tags,
        description,
        businessGlossary,
        semanticType: metadata?.semanticType,
        lineage: {
          sourceSystem,
          sourceTable,
          sourceField,
          transformationLogic,
          updateFrequency,
        },
        lastUpdated: new Date().toISOString(),
        updatedBy: 'current-user', // In real app, get from auth context
      };
      
      await tagsApi.updateFieldMetadata('dataset', datasetId, field.name, updatedMetadata);
      
      // Invalidate the data catalog cache to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['data-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['data-catalog-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['field-metadata', 'dataset', datasetId, field.name] });
      
      enqueueSnackbar('Field metadata updated successfully', { variant: 'success' });
      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (_error) {
      enqueueSnackbar('Failed to save field metadata', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Field Metadata
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Typography variant="subtitle1" color="text.secondary">
                {field.name}
              </Typography>
              {field.type && (
                <Chip
                  label={field.type}
                  size="small"
                  sx={{ 
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                  }}
                />
              )}
              {metadata?.semanticType && (
                <Chip
                  icon={<CategoryIcon sx={{ fontSize: 16 }} />}
                  label={metadata.semanticType}
                  size="small"
                  sx={{ 
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                  }}
                />
              )}
              {field.expression && (
                <Chip
                  label="Calculated Field"
                  size="small"
                  sx={{ 
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    color: theme.palette.warning.main,
                  }}
                />
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ px: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Basic Information Accordion */}
          <Accordion
            expanded={expandedAccordion === 'basic'}
            onChange={handleAccordionChange('basic')}
            sx={{
              borderRadius: 2,
              '&:before': { display: 'none' },
              boxShadow: theme.shadows[1],
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: alpha(theme.palette.grey[100], 0.5),
                '&:hover': {
                  bgcolor: alpha(theme.palette.grey[200], 0.5),
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Basic Information
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this field represents and how it should be used"
                  variant="outlined"
                />
                <TextField
                  label="Business Glossary"
                  fullWidth
                  multiline
                  rows={3}
                  value={businessGlossary}
                  onChange={(e) => setBusinessGlossary(e.target.value)}
                  placeholder="Business context and terminology related to this field"
                  variant="outlined"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Tags Accordion */}
          <Accordion
            expanded={expandedAccordion === 'tags'}
            onChange={handleAccordionChange('tags')}
            sx={{
              borderRadius: 2,
              '&:before': { display: 'none' },
              boxShadow: theme.shadows[1],
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: alpha(theme.palette.grey[100], 0.5),
                '&:hover': {
                  bgcolor: alpha(theme.palette.grey[200], 0.5),
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TagIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Tags
                </Typography>
                {tags.length > 0 && (
                  <Chip
                    label={tags.length}
                    size="small"
                    sx={{
                      ml: 1,
                      height: 20,
                      bgcolor: theme.palette.primary.main,
                      color: 'white',
                    }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 3 }}>
              <ModernTagsInput
                tags={tags}
                onChange={setTags}
                commonTagKeys={commonFieldTagKeys}
                placeholder="Start typing to add a tag"
                size="small"
              />
            </AccordionDetails>
          </Accordion>

          {/* Lineage Accordion */}
          <Accordion
            expanded={expandedAccordion === 'lineage'}
            onChange={handleAccordionChange('lineage')}
            sx={{
              borderRadius: 2,
              '&:before': { display: 'none' },
              boxShadow: theme.shadows[1],
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: alpha(theme.palette.grey[100], 0.5),
                '&:hover': {
                  bgcolor: alpha(theme.palette.grey[200], 0.5),
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LineageIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Lineage & Source Information
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <TextField
                  label="Source System"
                  value={sourceSystem}
                  onChange={(e) => setSourceSystem(e.target.value)}
                  placeholder="e.g., Salesforce, SAP"
                  variant="outlined"
                  size="small"
                />
                <TextField
                  label="Source Table"
                  value={sourceTable}
                  onChange={(e) => setSourceTable(e.target.value)}
                  placeholder="e.g., accounts, transactions"
                  variant="outlined"
                  size="small"
                />
                <TextField
                  label="Source Field"
                  value={sourceField}
                  onChange={(e) => setSourceField(e.target.value)}
                  placeholder="Original field name"
                  variant="outlined"
                  size="small"
                />
                <TextField
                  label="Update Frequency"
                  value={updateFrequency}
                  onChange={(e) => setUpdateFrequency(e.target.value)}
                  placeholder="e.g., Daily, Real-time"
                  variant="outlined"
                  size="small"
                />
                <TextField
                  label="Transformation Logic"
                  fullWidth
                  multiline
                  rows={2}
                  value={transformationLogic}
                  onChange={(e) => setTransformationLogic(e.target.value)}
                  placeholder="Describe any transformations applied"
                  variant="outlined"
                  size="small"
                  sx={{ gridColumn: 'span 2' }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}