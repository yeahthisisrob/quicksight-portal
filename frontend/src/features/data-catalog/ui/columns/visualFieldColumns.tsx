import {
  Info as InfoIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { FieldUsageBadges } from '@/entities/field';

interface CreateVisualFieldColumnsProps {
  onShowDetails: (field: any) => void;
}

export function createVisualFieldColumns({
  onShowDetails,
}: CreateVisualFieldColumnsProps): GridColDef[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.fieldType === 'CALCULATED_FIELD' && (
            <Tooltip title="Calculated field">
              <CalculateIcon fontSize="small" color="primary" />
            </Tooltip>
          )}
          <Typography 
            variant="body2" 
            sx={{ 
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={() => onShowDetails(params.row)}
          >
            {params.value}
          </Typography>
        </Box>
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
      renderCell: (params) => {
        const count = params.value || 0;
        return (
          <Typography 
            variant="body2" 
            fontWeight={count > 0 ? 'medium' : 'normal'}
            color={count > 0 ? 'text.primary' : 'text.disabled'}
          >
            {count}
          </Typography>
        );
      },
    },
    {
      field: 'visualTypes',
      headerName: 'Visual Types',
      width: 200,
      renderCell: (params) => {
        const types = params.row.visualTypes || [];
        if (types.length === 0) return <Typography variant="body2" color="text.disabled">-</Typography>;
        
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