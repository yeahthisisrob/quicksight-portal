/**
 * The organisation's visual templates: visuals by column name, each shown
 * as what it draws. The assistant and the builder add them to analyses on
 * any dataset with those columns.
 */
import { Add, BarChart, Delete, Edit } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { visualLibrary } from '@/entities/template';

import { getApiErrorMessage } from '@/shared/api';
import type { VisualTemplate } from '@/shared/api/modules/data-catalog';
import { EmptyState, pal } from '@/shared/design-system';

import { VisualTemplateDialog } from './VisualTemplateDialog';
import { describeVisual, visualTypeName } from './visualSummary';

export function VisualTemplates() {
  const { enqueueSnackbar } = useSnackbar();
  const list = visualLibrary.useList();
  const remove = visualLibrary.useRemove();
  const [editing, setEditing] = useState<VisualTemplate | 'new' | null>(null);

  const handleDelete = async (template: VisualTemplate) => {
    if (
      !window.confirm(
        `Delete the visual template "${template.name}"? Analyses already built keep their visuals.`
      )
    ) {
      return;
    }
    try {
      await remove.mutateAsync(template.id);
      enqueueSnackbar(`Deleted "${template.name}"`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'The visual template could not be deleted'), {
        variant: 'error',
      });
    }
  };

  return (
    <Stack spacing={1.5}>
      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={() => setEditing('new')}
        >
          New visual template
        </Button>
      </Box>
      {list.isLoading ? (
        <Skeleton variant="rounded" height={72} />
      ) : list.isError ? (
        <Alert severity="error">
          {getApiErrorMessage(list.error, 'The visual templates could not be loaded')}
        </Alert>
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState
          compact
          title="No visual templates yet"
          description="Save the visuals your analyses keep repeating, by column name: Revenue trend, Orders by region. The assistant adds them to any dataset with those columns."
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {list.data?.map((template) => (
            <Box
              key={template.id}
              sx={(theme) => ({
                p: 1.5,
                border: `1px solid ${pal(theme).line.divider}`,
                borderRadius: `${theme.shape.borderRadius}px`,
                minWidth: 0,
              })}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <BarChart fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {template.name}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={visualTypeName(template.visual.type)}
                />
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => setEditing(template)}
                    aria-label={`Edit ${template.name}`}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => void handleDelete(template)}
                    aria-label={`Delete ${template.name}`}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {describeVisual(template.visual)}
              </Typography>
              {template.description && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {template.description}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
      {editing && (
        <VisualTemplateDialog
          open
          onClose={() => setEditing(null)}
          template={editing === 'new' ? undefined : editing}
        />
      )}
    </Stack>
  );
}
