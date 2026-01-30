import { Box, Chip, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { FieldUsageBadges } from '@/entities/field';

import {
  ActionButtonsCell,
  CountCell,
  FieldNameCell,
} from '@/shared/ui/DataGrid/cells';

import type { VisualFieldRow, VisualFieldColumnsCallbacks } from '../../types';

interface CreateVisualFieldColumnsProps {
  onShowDetails: VisualFieldColumnsCallbacks['onShowDetails'];
}

export function createVisualFieldColumns({
  onShowDetails,
}: CreateVisualFieldColumnsProps): GridColDef<VisualFieldRow>[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <FieldNameCell
          name={params.value}
          isCalculated={params.row.fieldType === 'CALCULATED_FIELD'}
          calculatedTooltip="Calculated field"
          onClick={() => onShowDetails(params.row)}
        />
      ),
    },
    {
      field: 'datasetName',
      headerName: 'Dataset',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'visualsCount',
      headerName: 'Visuals',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => <CountCell value={params.value || 0} />,
    },
    {
      field: 'visualTypes',
      headerName: 'Visual Types',
      width: 200,
      renderCell: (params) => {
        const types = params.row.visualTypes || [];
        if (types.length === 0) {
          return (
            <Typography variant="body2" color="text.disabled">
              -
            </Typography>
          );
        }

        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {types.slice(0, 3).map((type: string, index: number) => (
              <Chip
                key={index}
                label={type.replace(/_/g, ' ')}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
            {types.length > 3 && (
              <Chip
                label={`+${types.length - 3}`}
                size="small"
                variant="filled"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'usageTypes',
      headerName: 'Usage',
      width: 180,
      renderCell: (params) => (
        <FieldUsageBadges sources={params.row.sources || []} />
      ),
    },
    {
      field: 'dashboardsCount',
      headerName: 'Dashboards',
      width: 110,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => <CountCell value={params.value || 0} />,
    },
    {
      field: 'analysesCount',
      headerName: 'Analyses',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => <CountCell value={params.value || 0} />,
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
