import { Warning as WarningIcon, Info as InfoIcon } from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { CountCell, FieldNameCell } from '@/shared/ui/DataGrid/cells';

import type {
  PhysicalFieldRow,
  PhysicalColumnsCallbacks,
  DataTypeVariant,
} from '../../types';

interface CreatePhysicalColumnsProps extends Partial<PhysicalColumnsCallbacks> {
  terms?: unknown[];
  onShowDetails: PhysicalColumnsCallbacks['onShowDetails'];
  onShowVariants: PhysicalColumnsCallbacks['onShowVariants'];
}

export function createPhysicalColumns({
  onShowDetails,
  onShowVariants,
}: CreatePhysicalColumnsProps): GridColDef<PhysicalFieldRow>[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      width: 250,
      renderCell: (params) => {
        const row = params.row;
        const uniqueDataTypes = row.variants
          ? [
              ...new Set(row.variants.map((v: DataTypeVariant) => v.dataType)),
            ].filter((dt) => dt && dt !== 'Unknown')
          : [];
        const hasDataTypeVariants = uniqueDataTypes.length > 1;

        return (
          <FieldNameCell
            name={params.value}
            isCalculated={row.isCalculated}
            hasVariants={hasDataTypeVariants}
            calculatedTooltip={
              row.hasVariants
                ? 'Calculated field with different expressions'
                : 'Calculated field'
            }
            variantsTooltip="This field has different data types across assets"
            onClick={() => onShowDetails(row)}
          />
        );
      },
    },
    {
      field: 'dataType',
      headerName: 'Data Type',
      width: 120,
      renderCell: (params) => {
        const row = params.row;
        const variants = row.variants;

        // Get unique data types, excluding Unknown
        const uniqueDataTypes = variants
          ? [...new Set(variants.map((v: DataTypeVariant) => v.dataType))].filter(
              (dt) => dt && dt !== 'Unknown'
            )
          : [];
        const hasRealVariants = uniqueDataTypes.length > 1;

        // Show variant button when multiple data types exist
        if (hasRealVariants && variants) {
          return (
            <Tooltip
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Data Type Variants ({variants.length}):
                  </Typography>
                  {variants.map((variant: DataTypeVariant, idx: number) => (
                    <Box key={idx} sx={{ mb: 0.5 }}>
                      <Typography variant="caption">
                        {variant.dataType}: {variant.count} source
                        {variant.count > 1 ? 's' : ''}
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
                onClick={() => onShowVariants(row)}
                sx={{
                  minWidth: 0,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                }}
              >
                <WarningIcon sx={{ fontSize: 14, mr: 0.5 }} />
                {variants.length} types
              </Button>
            </Tooltip>
          );
        }

        // Show calculated field chip with expression variants
        if (row.isCalculated && row.hasVariants && row.expressions && row.expressions.length > 1) {
          return (
            <Tooltip
              title={`Calculated field with ${row.expressions.length} different expressions`}
            >
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

        // Show simple data type chip
        const dataType = params.value;
        if (!dataType || dataType === 'Unknown') {
          return null;
        }

        return <Chip label={dataType} size="small" variant="outlined" color="primary" />;
      },
    },
    {
      field: 'usageCount',
      headerName: 'Total Usage',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => params.row.usageCount || 0,
      renderCell: (params) => (
        <CountCell
          value={params.value || 0}
          tooltipContent={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Total Usage: {params.value || 0}
              </Typography>
              <Typography variant="caption" display="block">
                Count of actual usage in:
              </Typography>
              <Typography variant="caption" display="block">
                Visuals (charts, tables, etc.)
              </Typography>
              <Typography variant="caption" display="block">
                Calculated field expressions
              </Typography>
            </Box>
          }
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton size="small" onClick={() => onShowDetails(params.row)}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];
}
