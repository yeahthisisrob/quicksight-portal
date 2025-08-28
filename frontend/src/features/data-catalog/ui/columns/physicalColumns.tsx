import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  Button,
  Tooltip,
  Typography,
  IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

interface CreatePhysicalColumnsProps {
  terms?: any[];
  onMapField?: (field: any) => void;
  onShowDetails: (field: any) => void;
  onShowVariants: (field: any) => void;
  onShowAssets?: (field: any, assetType: string, assets: any[]) => void;
}

export function createPhysicalColumns({
  onShowDetails,
  onShowVariants,
}: CreatePhysicalColumnsProps): GridColDef[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.isCalculated && (
            <Tooltip title={params.row.hasVariants ? "Calculated field with different expressions" : "Calculated field"}>
              <CalculateIcon 
                fontSize="small" 
                color="primary" 
              />
            </Tooltip>
          )}
          {params.row.hasVariants && params.row.variants && [...new Set(params.row.variants.map((v: any) => v.dataType))].filter(dt => dt && dt !== 'Unknown').length > 1 && (
            <Tooltip title="This field has different data types across assets">
              <WarningIcon fontSize="small" color="warning" />
            </Tooltip>
          )}
          <Typography 
            variant="body2" 
            sx={{ cursor: 'pointer' }}
            onClick={() => onShowDetails(params.row)}
          >
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'dataType',
      headerName: 'Data Type',
      width: 120,
      renderCell: (params) => {
        const variants = params.row.variants;
        // Only consider it a variant if there are actually different data types
        const uniqueDataTypes = variants ? [...new Set(variants.map((v: any) => v.dataType))].filter(dt => dt && dt !== 'Unknown') : [];
        const hasRealVariants = uniqueDataTypes.length > 1;
        
        if (hasRealVariants) {
          return (
            <Tooltip
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Data Type Variants ({variants.length}):
                  </Typography>
                  {variants.map((variant: any, idx: number) => (
                    <Box key={idx} sx={{ mb: 0.5 }}>
                      <Typography variant="caption">
                        • {variant.dataType}: {variant.count} source{variant.count > 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              }
              arrow
            >
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => onShowVariants(params.row)}
                sx={{ 
                  minWidth: 0,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                }}>
                <WarningIcon sx={{ fontSize: 14, mr: 0.5 }} />
                {variants.length} types
              </Button>
            </Tooltip>
          );
        }
        
        if (params.row.isCalculated && params.row.hasVariants && params.row.expressions?.length > 1) {
          return (
            <Tooltip title={`Calculated field with ${params.row.expressions.length} different expressions`}>
              <Chip 
                label="Calculated" 
                size="small" 
                variant="outlined"
                color="primary"
                icon={<WarningIcon sx={{ fontSize: 14 }} />}
              />
            </Tooltip>
          );
        }
        
        const dataType = params.value;
        if (!dataType || dataType === 'Unknown') {
          return null;
        }
        
        return (
          <Chip 
            label={dataType} 
            size="small" 
            variant="outlined"
            color="primary"
          />
        );
      },
    },
    {
      field: 'usageCount',
      headerName: 'Total Usage',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => params.row.usageCount || 0,
      renderCell: (params) => {
        const count = params.value || 0;
        return (
          <Tooltip 
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  Total Usage: {count}
                </Typography>
                <Typography variant="caption" display="block">
                  Count of actual usage in:
                </Typography>
                <Typography variant="caption" display="block">
                  • Visuals (charts, tables, etc.)
                </Typography>
                <Typography variant="caption" display="block">
                  • Calculated field expressions
                </Typography>
              </Box>
            }
            arrow
          >
            <Typography 
              variant="body2" 
              fontWeight={count > 0 ? 'medium' : 'normal'}
              color={count > 0 ? 'text.primary' : 'text.disabled'}
              sx={{ cursor: 'help' }}
            >
              {count}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => onShowDetails(params.row)}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];
}