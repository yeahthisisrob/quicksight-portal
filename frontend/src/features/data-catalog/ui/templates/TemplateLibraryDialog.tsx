import { Close, Delete, Edit } from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { getApiErrorMessage } from '@/shared/api';
import type { CalculatedFieldTemplate } from '@/shared/api/modules/data-catalog';
import { EmptyState, pal } from '@/shared/design-system';

import { useDeleteTemplate, useTemplates } from '../../lib/useTemplates';
import { SaveTemplateDialog } from './SaveTemplateDialog';

interface TemplateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: CalculatedFieldTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: pal(theme).surface.container,
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
              {template.name}
            </Typography>
            {template.dataType && (
              <Chip size="small" variant="outlined" label={template.dataType} />
            )}
            {template.tags?.map((t) => (
              <Chip key={t} size="small" label={t} />
            ))}
          </Stack>
          {template.description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {template.description}
            </Typography>
          )}
          <Typography
            component="pre"
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              mt: 1,
              mb: 0,
            }}
          >
            {template.expression}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {template.source?.datasetName ? `From ${template.source.datasetName}. ` : ''}
            Updated {new Date(template.updatedAt).toLocaleDateString()}
            {template.createdBy ? ` by ${template.createdBy}` : ''}
          </Typography>
        </Box>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={onEdit} aria-label={`Edit ${template.name}`}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={onDelete} aria-label={`Delete ${template.name}`}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

/** The saved calculated-field templates, with edit and delete. */
export function TemplateLibraryDialog({ open, onClose }: TemplateLibraryDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const templates = useTemplates();
  const remove = useDeleteTemplate();
  const [editing, setEditing] = useState<CalculatedFieldTemplate | null>(null);

  const handleDelete = async (template: CalculatedFieldTemplate) => {
    if (!window.confirm(`Delete the template "${template.name}"? Fields keep their expressions.`)) {
      return;
    }
    try {
      await remove.mutateAsync(template.id);
      enqueueSnackbar(`Deleted "${template.name}"`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'The template could not be deleted'), {
        variant: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Template library
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Calculated-field expressions saved for reuse. The portal keeps these; SMUS has no home for
          them.
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {templates.isLoading ? (
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={88} />
            <Skeleton variant="rounded" height={88} />
          </Stack>
        ) : templates.isError ? (
          <Alert severity="error">
            {getApiErrorMessage(templates.error, 'The library could not be loaded')}
          </Alert>
        ) : (templates.data?.length ?? 0) === 0 ? (
          <EmptyState
            compact
            title="No templates yet"
            description='Open a calculated field in the catalog and choose "Save as template".'
          />
        ) : (
          <Stack spacing={1.5}>
            {templates.data?.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onEdit={() => setEditing(template)}
                onDelete={() => handleDelete(template)}
              />
            ))}
          </Stack>
        )}
      </DialogContent>

      {editing && (
        <SaveTemplateDialog
          open
          onClose={() => setEditing(null)}
          templateId={editing.id}
          initial={{
            name: editing.name,
            expression: editing.expression,
            dataType: editing.dataType,
            description: editing.description,
            tags: editing.tags,
            source: editing.source,
          }}
        />
      )}
    </Dialog>
  );
}
