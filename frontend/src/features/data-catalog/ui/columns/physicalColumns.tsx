import { Box, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import {
  ActionButtonsCell,
  CountCell,
  DataTypeChip,
  FieldNameCell,
} from '@/shared/ui/DataGrid/cells';

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
        return (
          <DataTypeChip
            dataType={params.value}
            variants={row.variants}
            onVariantsClick={() => onShowVariants(row)}
            isCalculated={row.isCalculated}
            expressionVariantCount={
              row.hasVariants ? row.expressions?.length : undefined
            }
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
      renderCell: (params) => (
        <ActionButtonsCell
          actions={[
            {
              icon: 'info',
              onClick: () => onShowDetails(params.row),
            },
          ]}
        />
      ),
    },
  ];
}
