/**
 * Individual mapped field item component
 */
import {
  Analytics as AnalysisIcon,
  Calculate as CalculatedIcon,
  Dashboard as DashboardIcon,
  Storage as DatasetIcon,
  TableChart as VisualFieldIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  ListItem,
  Tooltip,
  Typography,
} from '@mui/material';

interface MappedFieldItemProps {
  item: any;
  activeTab: number;
  index: number;
}

/**
 * Render field icon based on type
 */
function FieldIcon({ field, activeTab }: { field: any; activeTab: number }) {
  if (activeTab === 1) {
    return (
      <Tooltip title="Visual field">
        <VisualFieldIcon color="action" fontSize="small" />
      </Tooltip>
    );
  }
  
  if (!field?.isCalculated) {
    return null;
  }
  
  const hasVariants = field.hasVariants || (field.expressions && field.expressions.length > 1);
  
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <Tooltip title="Calculated field">
        <CalculatedIcon color="primary" fontSize="small" />
      </Tooltip>
      {hasVariants && (
        <Tooltip title="Has different expressions across assets">
          <WarningIcon 
            sx={{ 
              position: 'absolute', 
              fontSize: 12, 
              right: -6, 
              top: -6, 
              bgcolor: 'background.paper',
              borderRadius: '50%',
              color: 'warning.main'
            }} 
          />
        </Tooltip>
      )}
    </Box>
  );
}

/**
 * Render field name based on tab
 */
function FieldName({ field, activeTab }: { field: any; activeTab: number }) {
  const name = activeTab === 0 
    ? (field?.fieldName || 'Unknown Field')
    : (field?.displayName || field?.fieldName || 'Unknown Visual Field');
    
  return <Typography variant="subtitle2">{name}</Typography>;
}

/**
 * Render field type chip
 */
function FieldTypeChip({ field, activeTab }: { field: any; activeTab: number }) {
  if (activeTab === 0 && field?.dataType) {
    return <Chip label={field.dataType} size="small" variant="outlined" />;
  }
  
  if (activeTab === 1 && field?.visualType) {
    return <Chip label={field.visualType} size="small" variant="outlined" />;
  }
  
  return null;
}

/**
 * Render source information
 */
function SourceInfo({ field, activeTab }: { field: any; activeTab: number }) {
  if (activeTab === 0) {
    return (
      <>
        <DatasetIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
        From: {field?.sources?.[0]?.assetName || 'Unknown source'}
        {field?.sources?.[0]?.assetType && ` (${field.sources[0].assetType})`}
      </>
    );
  }
  
  const AssetIcon = field?.sources?.[0]?.assetType === 'dashboard' 
    ? DashboardIcon 
    : AnalysisIcon;
    
  return (
    <>
      <AssetIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
      From: {field?.sources?.[0]?.assetName || 'Unknown visual'}
      {field?.fieldName && field.fieldName !== field.displayName && (
        <> (Dataset field: {field.fieldName})</>
      )}
    </>
  );
}

export function MappedFieldItem({ item, activeTab, index }: MappedFieldItemProps) {
  return (
    <ListItem
      key={`${item.id}-${index}`}
      sx={{ 
        border: 1, 
        borderColor: 'divider', 
        borderRadius: 1, 
        mb: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FieldIcon field={item.field} activeTab={activeTab} />
          <FieldName field={item.field} activeTab={activeTab} />
          <FieldTypeChip field={item.field} activeTab={activeTab} />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            label={item.mappingType}
            size="small"
            color={item.mappingType === 'manual' ? 'primary' : 'secondary'}
            variant="outlined"
          />
        </Box>
      </Box>
      
      <Box sx={{ mt: 1, width: '100%' }}>
        <Typography variant="caption" color="text.secondary">
          <SourceInfo field={item.field} activeTab={activeTab} />
        </Typography>
        
        {item.reason && (
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
            Mapping reason: {item.reason}
          </Typography>
        )}
        
        {item.field?.usageCount !== undefined && (
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
            Usage count: {item.field.usageCount} time{item.field.usageCount !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>
    </ListItem>
  );
}