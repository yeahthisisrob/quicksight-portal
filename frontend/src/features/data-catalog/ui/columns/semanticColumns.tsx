import {
  Calculate as CalculateIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
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

interface CreateSemanticColumnsProps {
  visualFieldCatalog: any;
  onEditTerm: (term: any) => void;
  onDeleteTerm: (term: any) => void;
  onShowMappedFields: (term: any) => void;
}

export function createSemanticColumns({
  visualFieldCatalog,
  onEditTerm,
  onDeleteTerm,
  onShowMappedFields,
}: CreateSemanticColumnsProps): GridColDef[] {
  return [
    {
      field: 'businessName',
      headerName: 'Business Term',
      flex: 1,
      minWidth: 200,
      sortable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.hasCalculatedFields && (
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <Tooltip title={
                params.row.hasVariants 
                  ? "Includes calculated fields with variants" 
                  : "Includes calculated fields"
              }>
                <CalculateIcon 
                  fontSize="small" 
                  color={params.row.hasVariants ? "warning" : "primary"} 
                />
              </Tooltip>
              {params.row.hasVariants && (
                <Tooltip title="Fields with different expressions across assets">
                  <WarningIcon 
                    sx={{ 
                      position: 'absolute', 
                      fontSize: 12, 
                      bottom: -2, 
                      right: -2,
                      backgroundColor: 'background.paper',
                      borderRadius: '50%',
                      color: 'warning.main'
                    }} 
                  />
                </Tooltip>
              )}
            </Box>
          )}
          <Typography variant="body2">
            {params.value}
          </Typography>
          {params.row.variantFields?.length > 1 && (
            <Tooltip title={`This term maps to ${params.row.variantFields.length} fields with different data types`}>
              <Chip 
                size="small" 
                label={`${params.row.variantFields.length} variants`}
                color="warning"
                sx={{ ml: 0.5, height: 20, fontSize: '0.75rem' }}
              />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1.5,
      minWidth: 300,
      sortable: true,
    },
    {
      field: 'mappedFieldsCount',
      headerName: 'Mapped Fields',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => {
        const count = params.value || 0;
        return count > 0 ? (
          <Button
            size="small"
            variant="text"
            onClick={() => onShowMappedFields(params.row)}
            sx={{ minWidth: 0, fontWeight: 'medium' }}
          >
            {count}
          </Button>
        ) : (
          <Typography variant="body2" color="text.disabled">0</Typography>
        );
      },
    },
    {
      field: 'businessUsageCount',
      headerName: 'Visual Usage',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      renderCell: (params) => {
        const count = params.row.businessUsageCount || 0;
        
        if (!visualFieldCatalog?.termUsageCounts) {
          return (
            <Typography variant="body2" color="text.disabled">
              -
            </Typography>
          );
        }
        
        return (
          <Tooltip 
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  Visual Usage Count: {count}
                </Typography>
                <Typography variant="caption" display="block">
                  Times used in visuals across all dashboards/analyses
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
      field: 'businessDatasetsCount',
      headerName: 'Datasets',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
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
      field: 'businessAnalysesCount',
      headerName: 'Analyses',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
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
      field: 'businessDashboardsCount',
      headerName: 'Dashboards',
      width: 110,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
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
      field: 'source',
      headerName: 'Source',
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'Manual'} 
          size="small" 
          variant="outlined"
        />
      ),
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
            onClick={() => onEditTerm(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDeleteTerm(params.row)}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];
}