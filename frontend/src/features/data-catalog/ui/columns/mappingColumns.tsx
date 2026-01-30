import {
  TrendingUp as ConfidenceIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Box, Chip, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { CountCell } from '@/shared/ui/DataGrid/cells';

import type { MappingRow, MappingColumnsCallbacks } from '../../types';

export function createMappingColumns({
  onEditMapping,
  onDeleteMapping,
}: MappingColumnsCallbacks): GridColDef<MappingRow>[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'termName',
      headerName: 'Business Term',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'confidence',
      headerName: 'Confidence',
      width: 150,
      renderCell: (params) => {
        const value = params.value || 0;
        const getColor = (): 'success' | 'warning' | 'error' => {
          if (value >= 80) return 'success';
          if (value >= 50) return 'warning';
          return 'error';
        };

        return (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}
          >
            <ConfidenceIcon fontSize="small" color="primary" />
            <LinearProgress
              variant="determinate"
              value={value}
              sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
              color={getColor()}
            />
            <Typography variant="caption" sx={{ minWidth: 35 }}>
              {value}%
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'method',
      headerName: 'Method',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'manual' ? 'primary' : 'default'}
          variant={params.value === 'manual' ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'dataType',
      headerName: 'Data Type',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value || 'Unknown'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'datasetsCount',
      headerName: 'Datasets',
      width: 100,
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
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEditMapping(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDeleteMapping(params.row)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];
}
