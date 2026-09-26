import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { getApiErrorMessage } from '@/shared/api';
import type {
  CalculatedFieldTemplate,
  CalculatedFieldTemplateInput,
} from '@/shared/api/modules/data-catalog';

import { useSaveTemplate } from '../model/useTemplates';

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefilled from the field (or the template being edited). */
  initial: CalculatedFieldTemplateInput;
  /** Set to update an existing template instead of creating one. */
  templateId?: string;
  onSaved?: (template: CalculatedFieldTemplate) => void;
}

const parseTags = (raw: string) =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/** Save a calculated field's expression as a reusable template, or update one. */
export function SaveTemplateDialog({
  open,
  onClose,
  initial,
  templateId,
  onSaved,
}: SaveTemplateDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState(initial.name);
  const [expression, setExpression] = useState(initial.expression);
  const [description, setDescription] = useState(initial.description ?? '');
  const [tags, setTags] = useState((initial.tags ?? []).join(', '));
  const save = useSaveTemplate();

  const submit = async () => {
    try {
      const template = await save.mutateAsync({
        templateId,
        input: {
          ...initial,
          name: name.trim(),
          expression: expression.trim(),
          description: description.trim() || undefined,
          tags: parseTags(tags),
        },
      });
      enqueueSnackbar(
        templateId
          ? `Template "${template.name}" updated`
          : `Saved "${template.name}" as a template`,
        {
          variant: 'success',
        }
      );
      onSaved?.(template);
      onClose();
    } catch {
      // The error is shown inline below.
    }
  };

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{templateId ? 'Update template' : 'Save as template'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Expression"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            size="small"
            fullWidth
            required
            multiline
            minRows={3}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
            helperText="What it measures and when to use it"
          />
          <TextField
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            size="small"
            fullWidth
            helperText="Comma separated"
          />
          {save.isError && (
            <Alert severity="error">
              {getApiErrorMessage(save.error, 'The template could not be saved')}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={save.isPending || !name.trim() || !expression.trim()}
        >
          {templateId ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
