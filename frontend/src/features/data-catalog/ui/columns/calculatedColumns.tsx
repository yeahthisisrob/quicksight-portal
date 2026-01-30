import {
  Functions as CalculatedIcon,
  Warning as WarningIcon,
  AccountTree as DependencyIcon,
  Comment as CommentIcon,
  Code as CodeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Box, Chip, Button, Tooltip, Typography, IconButton } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

import { FieldUsageBadges } from '@/entities/field';

import { CountCell } from '@/shared/ui/DataGrid/cells';

import type {
  CalculatedFieldRow,
  CalculatedColumnsCallbacks,
} from '../../types';

export function createCalculatedColumns({
  onShowExpression,
  onShowDetails,
  onShowVariants,
}: CalculatedColumnsCallbacks): GridColDef<CalculatedFieldRow>[] {
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
              '&:hover': { textDecoration: 'underline' },
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
        const expressionCount = params.row.expressions?.length ?? 0;
        const hasVariants = params.row.hasVariants && expressionCount > 1;

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
                {expressionCount} variants
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
        const getColor = (): 'success' | 'warning' | 'error' => {
          if (length < 100) return 'success';
          if (length < 500) return 'warning';
          return 'error';
        };
        const color = getColor();

        return (
          <Chip
            label={length.toLocaleString()}
            size="small"
            sx={{
              backgroundColor: (theme) =>
                `${theme.palette[color].main}15`,
              color: (theme) => theme.palette[color].main,
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
      renderCell: (params) => <CountCell value={params.value || 0} />,
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
      renderCell: (params) => (
        <FieldUsageBadges sources={params.value || []} />
      ),
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
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Expression">
            <IconButton size="small" onClick={() => onShowExpression(params.row)}>
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => onShowDetails(params.row)}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];
}
