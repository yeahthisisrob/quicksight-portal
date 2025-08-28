import {
  Box,
  Typography,
  TextField,
  CircularProgress,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha,
  Paper,
  Chip,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState, useEffect } from 'react';

import { ModernTagsInput } from '@/entities/tag';

import { tagsApi } from '@/shared/api';
import { actionIcons, specialIcons, statusIcons } from '@/shared/ui/icons';

const ExpandMoreIcon = specialIcons.expandMore;
const InfoIcon = statusIcons.info;
const TagIcon = actionIcons.tag;
const LineageIcon = specialIcons.lineage;
const SaveIcon = specialIcons.save;
const CategoryIcon = specialIcons.category;

interface FieldMetadataContentProps {
  sourceType: 'dataset' | 'analysis' | 'dashboard';
  sourceId: string;
  field: {
    name: string;
    type?: string;
    expression?: string;
  };
  onUpdate?: (metadata: any) => void;
}

interface Tag {
  key: string;
  value: string;
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

export default function FieldMetadataContent({ sourceType, sourceId, field, onUpdate }: FieldMetadataContentProps) {
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

  // Fetch existing metadata
  const { data: metadata, isLoading } = useQuery({
    queryKey: ['field-metadata', sourceType, sourceId, field.name],
    queryFn: () => tagsApi.getFieldMetadata(sourceType, sourceId, field.name),
    enabled: !!sourceId && !!field.name,
  });

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
        fieldId: `${sourceType}::${sourceId}::${field.name}`,
        sourceType,
        [sourceType === 'dataset' ? 'datasetId' : sourceType === 'analysis' ? 'analysisId' : 'dashboardId']: sourceId,
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
      
      
      await tagsApi.updateFieldMetadata(sourceType, sourceId, field.name, updatedMetadata);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['field-metadata', sourceType, sourceId, field.name] });
      queryClient.invalidateQueries({ queryKey: ['field-tag-search'] });
      // Also invalidate data catalog queries if they exist
      queryClient.invalidateQueries({ queryKey: ['data-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['data-catalog-paginated'] });
      
      // Call the onUpdate callback if provided
      if (onUpdate) {
        onUpdate(updatedMetadata);
      }
      
      enqueueSnackbar('Field metadata updated successfully', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('Failed to save field metadata', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: '900px', mx: 'auto' }}>
      {/* Header with Field Info */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {field.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
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
              {sourceType !== 'dataset' && (
                <Chip
                  label={`Calculated Field (${sourceType})`}
                  size="small"
                  sx={{ 
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    color: theme.palette.warning.main,
                  }}
                />
              )}
            </Box>
          </Box>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
            }}
          >
            Save Changes
          </Button>
        </Box>
      </Paper>

      {/* Accordions for different sections */}
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
              size="medium"
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
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
              <TextField
                label="Source System"
                value={sourceSystem}
                onChange={(e) => setSourceSystem(e.target.value)}
                placeholder="e.g., Salesforce, SAP, Custom DB"
                variant="outlined"
              />
              <TextField
                label="Source Table"
                value={sourceTable}
                onChange={(e) => setSourceTable(e.target.value)}
                placeholder="e.g., accounts, transactions"
                variant="outlined"
              />
              <TextField
                label="Source Field"
                value={sourceField}
                onChange={(e) => setSourceField(e.target.value)}
                placeholder="Original field name"
                variant="outlined"
              />
              <TextField
                label="Update Frequency"
                value={updateFrequency}
                onChange={(e) => setUpdateFrequency(e.target.value)}
                placeholder="e.g., Daily, Real-time, Weekly"
                variant="outlined"
              />
              <TextField
                label="Transformation Logic"
                fullWidth
                multiline
                rows={3}
                value={transformationLogic}
                onChange={(e) => setTransformationLogic(e.target.value)}
                placeholder="Describe any transformations applied to this field"
                variant="outlined"
                sx={{ gridColumn: 'span 2' }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
}