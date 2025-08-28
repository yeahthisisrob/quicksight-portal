import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as ConfidenceIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

interface CreateMappingColumnsProps {
  onEditMapping: (mapping: any) => void;
  onDeleteMapping: (mapping: any) => void;
}

export function createMappingColumns({
  onEditMapping,
  onDeleteMapping,
}: CreateMappingColumnsProps): GridColDef[] {
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
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <ConfidenceIcon fontSize="small" color="primary" />
          <LinearProgress
            variant="determinate"
            value={params.value}
            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
            color={params.value >= 80 ? 'success' : params.value >= 50 ? 'warning' : 'error'}
          />
          <Typography variant="caption" sx={{ minWidth: 35 }}>
            {params.value}%
          </Typography>
        </Box>
      ),
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
      renderCell: (params) => {
        const count = params.value || 0;
        return (
          <Typography 
            variant="body2" 
            color={count > 0 ? 'text.primary' : 'text.disabled'}
          >
            {count}
          </Typography>
        );
      },
    },
    {
      field: 'analysesCount',
      headerName: 'Analyses',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const count = params.value || 0;
        return (
          <Typography 
            variant="body2" 
            color={count > 0 ? 'text.primary' : 'text.disabled'}
          >
            {count}
          </Typography>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => onEditMapping(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDeleteMapping(params.row)}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];
}