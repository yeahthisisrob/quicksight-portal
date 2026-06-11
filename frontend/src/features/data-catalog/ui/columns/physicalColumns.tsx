import {
  Functions as CalculatedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { FieldUsageBadges } from '@/entities/field';

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

function uniqueDataTypes(row: PhysicalFieldRow): string[] {
  return row.variants
    ? [...new Set(row.variants.map((v: DataTypeVariant) => v.dataType))].filter(
        (dt) => dt && dt !== 'Unknown'
      )
    : [];
}

export function createPhysicalColumns({
  onShowDetails,
  onShowVariants,
}: CreatePhysicalColumnsProps): GridColDef<PhysicalFieldRow>[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      flex: 1,
      minWidth: 220,
      renderCell: (params) => {
        const row = params.row;
        const hasDataTypeVariants = uniqueDataTypes(row).length > 1;

        return (
          <FieldNameCell
            name={params.value}
            isCalculated={row.isCalculated}
            hasVariants={hasDataTypeVariants}
            calculatedTooltip={
              row.hasExpressionConflict
                ? `Calculated field with ${row.conflictCount ?? 2} conflicting expressions`
                : 'Calculated field'
            }
            variantsTooltip="This field has different data types across assets"
            onClick={() => onShowDetails(row)}
          />
        );
      },
    },
    {
      field: 'kind',
      headerName: 'Kind',
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const row = params.row;
        if (!row.isCalculated) {
          return <Chip label="Physical" size="small" variant="outlined" />;
        }
        if (row.hasExpressionConflict) {
          return (
            <Tooltip title={`${row.conflictCount ?? 2} conflicting expressions across assets`}>
              <Chip
                label="Calculated"
                size="small"
                color="error"
                variant="outlined"
                icon={<WarningIcon sx={{ fontSize: 14 }} />}
                onClick={() => onShowVariants(row)}
              />
            </Tooltip>
          );
        }
        return (
          <Chip
            label="Calculated"
            size="small"
            color="primary"
            variant="outlined"
            icon={<CalculatedIcon sx={{ fontSize: 14 }} />}
          />
        );
      },
    },
    {
      field: 'dataType',
      headerName: 'Data Type',
      width: 150,
      renderCell: (params) => {
        const row = params.row;
        const variants = row.variants;
        const hasRealVariants = uniqueDataTypes(row).length > 1;

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
                sx={{ minWidth: 0, textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}
              >
                <WarningIcon sx={{ fontSize: 14, mr: 0.5 }} />
                {uniqueDataTypes(row).length} types
              </Button>
            </Tooltip>
          );
        }

        const dataType = params.value;
        if (!dataType || dataType === 'Unknown') {
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        }
        return <Chip label={dataType} size="small" variant="outlined" color="default" />;
      },
    },
    {
      field: 'sources',
      headerName: 'Used In',
      width: 240,
      sortable: false,
      renderCell: (params) => {
        const sources = params.row.sources || [];
        if (sources.length === 0) {
          return (
            <Typography variant="body2" color="text.disabled">
              Unused
            </Typography>
          );
        }
        return <FieldUsageBadges sources={sources} />;
      },
    },
    {
      field: 'usageCount',
      headerName: 'Usage',
      width: 110,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => params.row.usageCount || 0,
      renderCell: (params) => (
        <CountCell
          value={params.value || 0}
          tooltipContent={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Total usage: {params.value || 0}
              </Typography>
              <Typography variant="caption" display="block">
                Occurrences across datasets, dashboards{' '}
                {(params.row.analysesCount || 0) > 0 ? 'and analyses' : ''}
              </Typography>
            </Box>
          }
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 70,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
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
