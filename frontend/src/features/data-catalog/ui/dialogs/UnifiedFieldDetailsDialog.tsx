/**
 * Refactored UnifiedFieldDetailsDialog with reduced complexity
 */
import {
  Close as CloseIcon,
  Functions as FunctionIcon,
  TableChart as FieldIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import ExpressionGraphDialog from './ExpressionGraphDialog';
import { DependenciesTab } from './field-details/DependenciesTab';
import { ExpressionTab } from './field-details/ExpressionTab';
import { OverviewTab } from './field-details/OverviewTab';
import { UsageTab } from './field-details/UsageTab';

interface UnifiedFieldDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  field: any;
  allCalculatedFields?: any[];
  onFieldUpdate?: (fieldName: string, metadata: any) => void;
  viewMode?: 'physical' | 'visual-fields' | 'calculated';
}

/**
 * Extract field references from expression
 */
function extractFieldReferences(expression: string): string[] {
  const fieldReferences: string[] = [];
  const fieldPattern = /\{([^}]+)\}/g;
  let match;
  
  while ((match = fieldPattern.exec(expression)) !== null) {
    const fieldName = match[1].trim();
    if (fieldName && !fieldReferences.includes(fieldName)) {
      fieldReferences.push(fieldName);
    }
  }
  
  return fieldReferences;
}

/**
 * Group sources by asset type
 */
function groupSourcesByType(sources: any[] = []) {
  return sources.reduce((acc: any, source: any) => {
    const type = source.assetType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(source);
    return acc;
  }, {});
}

/**
 * Define available tabs based on field properties
 */
function getAvailableTabs(field: any, viewMode: string) {
  return [
    { label: 'Overview', enabled: true },
    { label: 'Expression', enabled: field?.isCalculated || false },
    { label: 'Dependencies', enabled: field?.isCalculated || false },
    { label: 'Usage', enabled: true },
    { label: 'Visual Details', enabled: viewMode === 'visual-fields' || field?.visualData || false },
  ];
}

export default function UnifiedFieldDetailsDialog({
  open,
  onClose,
  field,
  allCalculatedFields = [],
  viewMode = 'physical',
}: UnifiedFieldDetailsDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [showExpressionGraph, setShowExpressionGraph] = useState(false);

  const allTabs = getAvailableTabs(field, viewMode);

  // Reset state when field changes
  useEffect(() => {
    if (field) {
      setSelectedTab(0);
      setSelectedVariant(0);
    }
  }, [field]);

  if (!field) return null;

  const hasVariants = field.hasVariants && (field.expressions?.length > 1 || field.variants?.length > 1);
  const currentExpression = hasVariants && field.expressions
    ? field.expressions[selectedVariant]?.expression 
    : field.expression;
  const fieldReferences = currentExpression ? extractFieldReferences(currentExpression) : [];
  const groupedSources = groupSourcesByType(field.sources);

  const handleCopyExpression = () => {
    navigator.clipboard.writeText(currentExpression || '');
    enqueueSnackbar('Expression copied to clipboard', { variant: 'success' });
  };

  const getCurrentTabContent = () => {
    const tabLabel = allTabs[selectedTab]?.label;
    
    switch (tabLabel) {
      case 'Overview':
        return (
          <OverviewTab 
            field={field} 
            hasVariants={hasVariants} 
            groupedSources={groupedSources}
          />
        );
        
      case 'Expression':
        return (
          <ExpressionTab
            field={field}
            hasVariants={hasVariants}
            currentExpression={currentExpression}
            onCopyExpression={handleCopyExpression}
            onShowGraph={() => setShowExpressionGraph(true)}
          />
        );
        
      case 'Dependencies':
        return (
          <DependenciesTab
            fieldReferences={fieldReferences}
            allCalculatedFields={allCalculatedFields}
          />
        );
        
      case 'Usage':
        return <UsageTab groupedSources={groupedSources} />;
        
      case 'Visual Details':
        return (
          <Typography color="text.secondary">
            Visual details not yet implemented
          </Typography>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {field?.isCalculated ? (
                <FunctionIcon sx={{ fontSize: 24, color: 'primary.main' }} />
              ) : (
                <FieldIcon sx={{ fontSize: 24, color: 'primary.main' }} />
              )}
              <Typography variant="h6" fontWeight={600}>
                {field.fieldName}
              </Typography>
              {field?.isCalculated && (
                <Chip label="Calculated" size="small" color="primary" variant="outlined" />
              )}
              {hasVariants && (
                <Chip
                  label={`${field.expressions?.length || field.variants?.length} variants`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<WarningIcon sx={{ fontSize: 16 }} />}
                />
              )}
            </Stack>
            
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
          >
            {allTabs.map((tab, index) => (
              <Tab 
                key={index} 
                label={tab.label} 
                disabled={!tab.enabled}
                sx={{
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                    opacity: 0.5
                  }
                }}
              />
            ))}
          </Tabs>

          <Box sx={{ p: 3, height: 'calc(100% - 48px)', overflow: 'auto' }}>
            {getCurrentTabContent()}
          </Box>
        </DialogContent>

        <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Expression Graph Dialog */}
      <ExpressionGraphDialog
        open={showExpressionGraph}
        onClose={() => setShowExpressionGraph(false)}
        field={field}
        allFields={allCalculatedFields}
      />
    </>
  );
}