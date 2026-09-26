/**
 * Create or edit a filter bar template: its name, whether it is the
 * default, and its controls in order, each with a column, a title, a width
 * and any values selected to start with. The bar is previewed as it will
 * sit at the top of a sheet.
 */
import { Add, ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { filterBarLibrary } from '@/entities/template';

import { getApiErrorMessage } from '@/shared/api';
import type { FilterBarControl, FilterBarTemplate } from '@/shared/api/modules/data-catalog';

import { FilterBarPreview } from './FilterBarPreview';

const SPANS = [1, 2, 3, 4, 5, 6];
const DEFAULT_SPAN = 2;
const MAX_CONTROLS = 12;

type Row = { id: number; column: string; title: string; span: number; values: string };

let nextRowId = 0;
const blankRow = (): Row => ({
  id: nextRowId++,
  column: '',
  title: '',
  span: DEFAULT_SPAN,
  values: '',
});

function toRows(controls: FilterBarControl[] | undefined): Row[] {
  return (controls ?? []).map((c) => ({
    id: nextRowId++,
    column: c.column,
    title: c.title ?? '',
    span: c.span,
    values: (c.values ?? []).join(', '),
  }));
}

function toControls(rows: Row[]): FilterBarControl[] {
  return rows
    .filter((r) => r.column.trim())
    .map((r) => {
      const values = r.values
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      return {
        column: r.column.trim(),
        span: r.span,
        ...(r.title.trim() ? { title: r.title.trim() } : {}),
        ...(values.length ? { values } : {}),
      };
    });
}

export function FilterBarDialog({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  /** Edit this one; a new bar when absent. */
  template?: FilterBarTemplate;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const save = filterBarLibrary.useSave();
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [rows, setRows] = useState<Row[]>(template ? toRows(template.controls) : [blankRow()]);

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const move = (index: number, by: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row!);
      return next;
    });

  const controls = toControls(rows);
  const canSave = name.trim() !== '' && controls.length > 0 && !save.isPending;

  const submit = async () => {
    try {
      await save.mutateAsync({
        templateId: template?.id,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          isDefault,
          controls,
        },
      });
      enqueueSnackbar(`Saved "${name.trim()}"`, { variant: 'success' });
      onClose();
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'The filter bar could not be saved'), {
        variant: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{template ? `Edit ${template.name}` : 'New filter bar'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              }
              label="Default for new analyses"
              sx={{ flexShrink: 0 }}
            />
          </Stack>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Typography variant="subtitle2">Controls, in bar order</Typography>
          {rows.map((row, index) => (
            <Stack
              key={row.id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <TextField
                size="small"
                label="Column"
                value={row.column}
                onChange={(e) => update(index, { column: e.target.value })}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                label="Title"
                placeholder={row.column || 'The column name'}
                value={row.title}
                onChange={(e) => update(index, { title: e.target.value })}
                sx={{ flex: 2 }}
              />
              <TextField
                select
                size="small"
                label="Width"
                value={row.span}
                onChange={(e) => update(index, { span: Number(e.target.value) })}
                sx={{ width: 96 }}
              >
                {SPANS.map((span) => (
                  <MenuItem key={span} value={span}>
                    {span}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Start with"
                placeholder="All values"
                helperText={index === rows.length - 1 ? 'Text columns; comma-separated' : undefined}
                value={row.values}
                onChange={(e) => update(index, { values: e.target.value })}
                sx={{ flex: 2 }}
              />
              <Stack direction="row">
                <Tooltip title="Earlier">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Move earlier"
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Later">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Move later"
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton
                    size="small"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    aria-label="Remove control"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          ))}
          <Button
            startIcon={<Add />}
            disabled={rows.length >= MAX_CONTROLS}
            onClick={() => setRows((current) => [...current, blankRow()])}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add a control
          </Button>
          {controls.length > 0 ? (
            <FilterBarPreview controls={controls} />
          ) : (
            <Alert severity="info">Add at least one control with a column.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={!canSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
