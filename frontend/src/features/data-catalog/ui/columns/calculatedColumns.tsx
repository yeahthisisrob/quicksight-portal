import {
  Functions as CalculatedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  AccountTree as DependencyIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  Button,
  Tooltip,
  Typography,
  IconButton,
  Stack,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

interface CreateCalculatedColumnsProps {
  onShowExpression: (field: any) => void;
  onShowDetails: (field: any) => void;
  onShowVariants: (field: any) => void;
}

export function createCalculatedColumns({
  onShowExpression,
  onShowDetails,
  onShowVariants,
}: CreateCalculatedColumnsProps): GridColDef[] {
  return [
    {
      field: 'fieldName',
      headerName: 'Field Name',
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalculatedIcon fontSize="small" color="primary" />
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={() => onShowDetails(params.row)}
          >
            {params.value}
          </Typography>
          {params.row.hasVariants && (
            <Tooltip title="This field has different expressions across assets">
              <WarningIcon fontSize="small" color="warning" />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'expression',
      headerName: 'Expression',
      flex: 1,
      minWidth: 300,
      renderCell: (params) => {
        const expression = params.value || '';
        const hasVariants = params.row.hasVariants && params.row.expressions?.length > 1;
        
        return (
          <Box sx={{ width: '100%' }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 1,
                backgroundColor: 'action.hover',
                '&:hover': {
                  backgroundColor: 'action.selected',
                },
                maxHeight: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
              onClick={() => onShowExpression(params.row)}
            >
              {expression}
            </Typography>
            {hasVariants && (
              <Button
                size="small"
                startIcon={<WarningIcon fontSize="small" />}
                onClick={() => onShowVariants(params.row)}
                sx={{ mt: 0.5, fontSize: '0.75rem' }}
              >
                {params.row.expressions.length} variants
              </Button>
            )}
          </Box>
        );
      },
    },
    {
      field: 'expressionLength',
      headerName: 'Expression Length',
      width: 140,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => params.row.expression?.length || 0,
      renderCell: (params) => {
        const length = params.value || 0;
        const getColor = () => {
          if (length < 100) return 'success.main';
          if (length < 500) return 'warning.main';
          return 'error.main';
        };
        
        return (
          <Chip
            label={length.toLocaleString()}
            size="small"
            sx={{
              backgroundColor: theme => `${theme.palette[getColor().split('.')[0]][getColor().split('.')[1]]}15`,
              color: theme => theme.palette[getColor().split('.')[0]][getColor().split('.')[1]],
              fontWeight: 'medium',
            }}
          />
        );
      },
    },
    {
      field: 'usageCount',
      headerName: 'Usage',
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
      field: 'hasComments',
      headerName: 'Comments',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        if (params.value) {
          return (
            <Tooltip title="This expression contains comments">
              <CommentIcon color="success" fontSize="small" />
            </Tooltip>
          );
        }
        return null;
      },
    },
    {
      field: 'sources',
      headerName: 'Sources',
      width: 200,
      renderCell: (params) => {
        const sources = params.value || [];
        const datasetSources = sources.filter((s: any) => s.assetType === 'dataset');
        const analysisSources = sources.filter((s: any) => s.assetType === 'analysis');
        const dashboardSources = sources.filter((s: any) => s.assetType === 'dashboard');

        const getTooltipContent = (items: any[], type: string) => {
          if (items.length === 0) return '';
          const names = items.map((s: any) => s.assetName || s.assetId).join('\n');
          return `${type}:\n${names}`;
        };

        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {datasetSources.length > 0 && (
              <Tooltip
                title={
                  <Box sx={{ whiteSpace: 'pre-line' }}>
                    {getTooltipContent(datasetSources, 'Datasets')}
                  </Box>
                }
                arrow
              >
                <Chip
                  label={`${datasetSources.length} dataset${datasetSources.length > 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  color="success"
                />
              </Tooltip>
            )}
            {analysisSources.length > 0 && (
              <Tooltip
                title={
                  <Box sx={{ whiteSpace: 'pre-line' }}>
                    {getTooltipContent(analysisSources, 'Analyses')}
                  </Box>
                }
                arrow
              >
                <Chip
                  label={`${analysisSources.length} analysis`}
                  size="small"
                  variant="outlined"
                  color="secondary"
                />
              </Tooltip>
            )}
            {dashboardSources.length > 0 && (
              <Tooltip
                title={
                  <Box sx={{ whiteSpace: 'pre-line' }}>
                    {getTooltipContent(dashboardSources, 'Dashboards')}
                  </Box>
                }
                arrow
              >
                <Chip
                  label={`${dashboardSources.length} dashboard${dashboardSources.length > 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  color="error"
                />
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'dependencies',
      headerName: 'Dependencies',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const fieldReferences = params.row.fieldReferences || [];
        const count = fieldReferences.length;
        
        if (count === 0) {
          return (
            <Typography variant="body2" color="text.disabled">
              None
            </Typography>
          );
        }
        
        return (
          <Tooltip title={`References: ${fieldReferences.join(', ')}`}>
            <Button
              size="small"
              startIcon={<DependencyIcon fontSize="small" />}
              onClick={() => onShowExpression(params.row)}
              sx={{ minWidth: 0 }}
            >
              {count}
            </Button>
          </Tooltip>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={() => onShowExpression(params.row)}
            title="View Expression"
          >
            <CodeIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onShowDetails(params.row)}
            title="View Details"
          >
            <InfoIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];
}