/**
 * The organisation's filter bars, each previewed as it sits at the top of a
 * sheet. The default one is applied to every analysis the portal builds.
 */
import { Add, Delete, Edit } from '@mui/icons-material';
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

import { filterBarLibrary } from '@/entities/template';

import { getApiErrorMessage } from '@/shared/api';
import type { FilterBarTemplate } from '@/shared/api/modules/data-catalog';
import { EmptyState, pal } from '@/shared/design-system';

import { FilterBarDialog } from './FilterBarDialog';
import { FilterBarPreview } from './FilterBarPreview';

export function FilterBarTemplates() {
  const { enqueueSnackbar } = useSnackbar();
  const bars = filterBarLibrary.useList();
  const remove = filterBarLibrary.useRemove();
  const [editing, setEditing] = useState<FilterBarTemplate | 'new' | null>(null);

  const handleDelete = async (bar: FilterBarTemplate) => {
    if (
      !window.confirm(
        `Delete the filter bar "${bar.name}"? Analyses already built keep their filters.`
      )
    ) {
      return;
    }
    try {
      await remove.mutateAsync(bar.id);
      enqueueSnackbar(`Deleted "${bar.name}"`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'The filter bar could not be deleted'), {
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
          New filter bar
        </Button>
      </Box>
      {bars.isLoading ? (
        <Skeleton variant="rounded" height={96} />
      ) : bars.isError ? (
        <Alert severity="error">
          {getApiErrorMessage(bars.error, 'The filter bars could not be loaded')}
        </Alert>
      ) : (bars.data?.length ?? 0) === 0 ? (
        <EmptyState
          compact
          title="No filter bars yet"
          description="Save the filters your analyses should always carry, in order: Date, then Region, then Product line. Make one the default and every analysis the portal builds starts with it."
        />
      ) : (
        bars.data?.map((bar) => (
          <Box
            key={bar.id}
            sx={(theme) => ({
              p: 1.5,
              border: `1px solid ${pal(theme).line.divider}`,
              borderRadius: `${theme.shape.borderRadius}px`,
            })}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>
                {bar.name}
              </Typography>
              {bar.isDefault && <Chip size="small" color="primary" label="Default" />}
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => setEditing(bar)}
                  aria-label={`Edit ${bar.name}`}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => void handleDelete(bar)}
                  aria-label={`Delete ${bar.name}`}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {bar.description && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {bar.description}
              </Typography>
            )}
            <FilterBarPreview controls={bar.controls} />
          </Box>
        ))
      )}
      {editing && (
        <FilterBarDialog
          open
          onClose={() => setEditing(null)}
          template={editing === 'new' ? undefined : editing}
        />
      )}
    </Stack>
  );
}
