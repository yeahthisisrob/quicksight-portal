/**
 * Create or edit a visual template: the type, the category column, the
 * values with their aggregations, and an optional second dimension, all by
 * column name. Where it sits and how big is decided by the builder.
 */
import { Add, Delete } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { visualLibrary } from '@/entities/template';

import { getApiErrorMessage } from '@/shared/api';
import type { TemplateVisual, VisualTemplate } from '@/shared/api/modules/data-catalog';

import { describeVisual, VISUAL_TYPES, visualTypeName } from './visualSummary';

const AGGREGATIONS = ['SUM', 'AVERAGE', 'COUNT', 'DISTINCT_COUNT', 'MIN', 'MAX'] as const;
const GRANULARITIES = ['', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;
const MAX_VALUES = 10;

type ValueRow = { id: number; column: string; aggregation: (typeof AGGREGATIONS)[number] };
let nextId = 0;
const valueRow = (column = '', aggregation: ValueRow['aggregation'] = 'SUM'): ValueRow => ({
  id: nextId++,
  column,
  aggregation,
});

/** Types that need a category column. */
const needsCategory = (type: TemplateVisual['type']) => type !== 'KPI' && type !== 'Table';

export function VisualTemplateDialog({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template?: VisualTemplate;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const save = visualLibrary.useSave();
  const initial = template?.visual;
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [type, setType] = useState<TemplateVisual['type']>(initial?.type ?? 'LineChart');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [granularity, setGranularity] = useState<string>(initial?.granularity ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [values, setValues] = useState<ValueRow[]>(
    initial?.values.map((v) => valueRow(v.column, v.aggregation ?? 'SUM')) ?? [valueRow()]
  );

  const visual: TemplateVisual = {
    type,
    ...(title.trim() ? { title: title.trim() } : {}),
    ...(category.trim() && type !== 'KPI' ? { category: category.trim() } : {}),
    ...(granularity ? { granularity: granularity as TemplateVisual['granularity'] } : {}),
    values: values
      .filter((v) => v.column.trim())
      .map((v) => ({ column: v.column.trim(), aggregation: v.aggregation })),
    ...(color.trim() && type !== 'KPI' ? { color: color.trim() } : {}),
  };
  const missing = !name.trim()
    ? 'A name is required.'
    : visual.values.length === 0
      ? 'Add at least one value column.'
      : needsCategory(type) && !visual.category
        ? `A ${visualTypeName(type).toLowerCase()} needs a category column.`
        : null;

  const submit = async () => {
    try {
      await save.mutateAsync({
        templateId: template?.id,
        input: {
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          visual,
        },
      });
      enqueueSnackbar(`Saved "${name.trim()}"`, { variant: 'success' });
      onClose();
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'The visual template could not be saved'), {
        variant: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{template ? `Edit ${template.name}` : 'New visual template'}</DialogTitle>
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
            <TextField
              select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as TemplateVisual['type'])}
              sx={{ minWidth: 180 }}
            >
              {VISUAL_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {visualTypeName(t)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
          <TextField
            label="Title on the visual"
            placeholder={name || 'The template name'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />
          {type !== 'KPI' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={type === 'Table' ? 'Group by (optional)' : 'Category column'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                fullWidth
              />
              <TextField
                select
                label="Date granularity"
                helperText="When the category is a date"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                {GRANULARITIES.map((g) => (
                  <MenuItem key={g || 'none'} value={g}>
                    {g ? g.toLowerCase() : 'None'}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={type === 'PivotTable' ? 'Pivot columns' : 'Split by (colour)'}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                fullWidth
              />
            </Stack>
          )}
          <Typography variant="subtitle2">Values</Typography>
          {values.map((row) => (
            <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                size="small"
                label="Column"
                value={row.column}
                onChange={(e) =>
                  setValues((current) =>
                    current.map((v) => (v.id === row.id ? { ...v, column: e.target.value } : v))
                  )
                }
                sx={{ flex: 2 }}
              />
              <TextField
                select
                size="small"
                label="Aggregation"
                value={row.aggregation}
                onChange={(e) =>
                  setValues((current) =>
                    current.map((v) =>
                      v.id === row.id
                        ? { ...v, aggregation: e.target.value as ValueRow['aggregation'] }
                        : v
                    )
                  )
                }
                sx={{ flex: 1 }}
              >
                {AGGREGATIONS.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a.replace('_', ' ').toLowerCase()}
                  </MenuItem>
                ))}
              </TextField>
              <Tooltip title="Remove">
                <span>
                  <IconButton
                    size="small"
                    disabled={values.length === 1}
                    onClick={() => setValues((current) => current.filter((v) => v.id !== row.id))}
                    aria-label="Remove value"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ))}
          <Button
            startIcon={<Add />}
            disabled={values.length >= MAX_VALUES}
            onClick={() => setValues((current) => [...current, valueRow()])}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add a value
          </Button>
          {missing ? (
            <Alert severity="info">{missing}</Alert>
          ) : (
            <Alert severity="success" icon={false}>
              {describeVisual(visual)}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={Boolean(missing) || save.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
