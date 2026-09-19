/**
 * From nothing, step 2 - the visuals. Describe the dashboard and the planner
 * proposes them from the datasets' columns; or add them by hand. Either way
 * they are cards: a type, a title, a dataset, the columns in its wells. Every
 * edit re-previews, and what the builder could not place is listed.
 */
import { Add, AutoAwesome, Close } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { EmptyState } from '@/shared/design-system';

import {
  AGGREGATIONS,
  type Aggregation,
  BUILDABLE_TYPE_LABELS,
  BUILDABLE_VISUAL_TYPES,
  type BuildableVisualType,
  type DatasetColumn,
  type DraftVisual,
  defaultAggregation,
  describeVisual,
  GRANULARITIES,
  type Granularity,
  isComplete,
  isDateColumn,
} from '../../model/newAsset';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

/** What the two dimension wells are called, per visual type. */
const DIMENSION_LABELS: Partial<Record<BuildableVisualType, { category: string; color: string }>> =
  {
    Table: { category: 'Group by', color: 'Group by (second)' },
    PivotTable: { category: 'Rows', color: 'Columns' },
  };
const DEFAULT_DIMENSIONS = { category: 'Category', color: 'Colour' };

const TYPE_WIDTH = 160;
const DATASET_WIDTH = 180;
const AGGREGATION_WIDTH = 150;
const GRANULARITY_WIDTH = 120;
const CARD_RADIUS = 2;

/**
 * A column of the chosen dataset, with its type; free text when the export
 * has no columns for it (the server checks the name either way).
 */
function ColumnSelect({
  label,
  value,
  columns,
  onChange,
  clearable = false,
  sx,
}: {
  label: string;
  value: string;
  columns: DatasetColumn[];
  onChange: (column: string, type: string | undefined) => void;
  clearable?: boolean;
  sx?: object;
}) {
  const known = columns.find((c) => c.name === value);
  return (
    <Autocomplete<DatasetColumn, false, boolean, true>
      freeSolo
      disableClearable={!clearable}
      options={columns}
      value={known ?? (value ? { name: value, type: '' } : null)}
      inputValue={value}
      onInputChange={(_, next, reason) => {
        if (reason === 'input' || reason === 'clear') {
          onChange(next, columns.find((c) => c.name === next)?.type);
        }
      }}
      onChange={(_, next) => {
        const name = typeof next === 'string' ? next : (next?.name ?? '');
        onChange(name, typeof next === 'string' ? undefined : next?.type);
      }}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
      isOptionEqualToValue={(o, v) =>
        (typeof o === 'string' ? o : o.name) === (typeof v === 'string' ? v : v.name)
      }
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        const column = typeof option === 'string' ? { name: option, type: '' } : option;
        return (
          <li key={key} {...rest}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {column.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
              {column.type}
            </Typography>
          </li>
        );
      }}
      size="small"
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={columns.length === 0 ? 'Column name' : undefined}
        />
      )}
    />
  );
}

function VisualCard({
  flow,
  visual,
  index,
}: {
  flow: AuthorFlow;
  visual: DraftVisual;
  index: number;
}) {
  const { fresh } = flow;
  const columns = fresh.columns[visual.identifier]?.columns ?? [];
  const isKpi = visual.type === 'KPI';
  const categoryType = columns.find((c) => c.name === visual.category)?.type;
  const wells = DIMENSION_LABELS[visual.type] ?? DEFAULT_DIMENSIONS;
  const complete = isComplete(visual);
  const typeId = `visual-${visual.id}-type`;
  const datasetId = `visual-${visual.id}-dataset`;

  return (
    <Box
      data-testid={`visual-card-${index}`}
      sx={{
        border: 1,
        borderColor: complete ? 'divider' : 'warning.main',
        borderRadius: CARD_RADIUS,
        p: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: TYPE_WIDTH }}>
            <InputLabel id={typeId}>Type</InputLabel>
            <Select
              labelId={typeId}
              label="Type"
              value={visual.type}
              onChange={(e) =>
                fresh.updateVisual(visual.id, { type: e.target.value as BuildableVisualType })
              }
            >
              {BUILDABLE_VISUAL_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {BUILDABLE_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Title"
            value={visual.title}
            onChange={(e) => fresh.updateVisual(visual.id, { title: e.target.value })}
            sx={{ flex: 1, minWidth: DATASET_WIDTH }}
            slotProps={{ htmlInput: { 'data-testid': 'visual-title' } }}
          />
          <FormControl size="small" sx={{ minWidth: DATASET_WIDTH }}>
            <InputLabel id={datasetId}>Dataset</InputLabel>
            <Select
              labelId={datasetId}
              label="Dataset"
              value={visual.identifier}
              onChange={(e) => fresh.updateVisual(visual.id, { identifier: e.target.value })}
            >
              {fresh.datasets.map((d) => (
                <MenuItem key={d.identifier} value={d.identifier}>
                  {d.identifier}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Remove this visual">
            <IconButton
              size="small"
              aria-label={`Remove visual ${index + 1}`}
              onClick={() => fresh.removeVisual(visual.id)}
            >
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {!isKpi && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <ColumnSelect
              label={wells.category}
              value={visual.category ?? ''}
              columns={columns}
              clearable
              onChange={(category, type) =>
                fresh.updateVisual(visual.id, {
                  category,
                  granularity: isDateColumn(type) ? (visual.granularity ?? 'MONTH') : undefined,
                })
              }
              sx={{ flex: 1, minWidth: DATASET_WIDTH }}
            />
            {isDateColumn(categoryType) && (
              <FormControl size="small" sx={{ minWidth: GRANULARITY_WIDTH }}>
                <InputLabel id={`${typeId}-granularity`}>Granularity</InputLabel>
                <Select
                  labelId={`${typeId}-granularity`}
                  label="Granularity"
                  value={visual.granularity ?? 'MONTH'}
                  onChange={(e) =>
                    fresh.updateVisual(visual.id, { granularity: e.target.value as Granularity })
                  }
                >
                  {GRANULARITIES.map((g) => (
                    <MenuItem key={g.value} value={g.value}>
                      {g.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <ColumnSelect
              label={wells.color}
              value={visual.color ?? ''}
              columns={columns}
              clearable
              onChange={(color) => fresh.updateVisual(visual.id, { color })}
              sx={{ flex: 1, minWidth: DATASET_WIDTH }}
            />
          </Stack>
        )}

        <Stack spacing={1}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Values
          </Typography>
          {visual.values.map((value, i) => (
            <Stack
              // Rows have no identity of their own; the index is the key.
              key={`${visual.id}-value-${i}`}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'flex-start' }}
            >
              <ColumnSelect
                label="Column"
                value={value.column}
                columns={columns}
                onChange={(column, type) =>
                  fresh.updateValue(visual.id, i, {
                    column,
                    aggregation: value.aggregation ?? defaultAggregation(type),
                  })
                }
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ minWidth: AGGREGATION_WIDTH }}>
                <InputLabel id={`${typeId}-agg-${i}`}>Aggregation</InputLabel>
                <Select
                  labelId={`${typeId}-agg-${i}`}
                  label="Aggregation"
                  value={value.aggregation ?? ''}
                  displayEmpty
                  onChange={(e) =>
                    fresh.updateValue(visual.id, i, {
                      aggregation: (e.target.value || undefined) as Aggregation | undefined,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>Default</em>
                  </MenuItem>
                  {AGGREGATIONS.map((a) => (
                    <MenuItem key={a.value} value={a.value}>
                      {a.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton
                size="small"
                aria-label="Remove value"
                disabled={visual.values.length === 1}
                onClick={() => fresh.removeValue(visual.id, i)}
              >
                <Close fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Box>
            <Button size="small" startIcon={<Add />} onClick={() => fresh.addValue(visual.id)}>
              Add value
            </Button>
          </Box>
        </Stack>

        <Typography variant="caption" sx={{ color: complete ? 'text.secondary' : 'warning.dark' }}>
          {complete ? describeVisual(visual) : 'Needs a title and at least one value column.'}
        </Typography>
      </Stack>
    </Box>
  );
}

function AskPanel({ flow }: { flow: AuthorFlow }) {
  const { fresh } = flow;
  return (
    <Panel
      title="Describe the dashboard"
      description="The planner proposes visuals from the columns your datasets have. They land below as cards you can change; propose again to start over."
    >
      <Stack spacing={1.5}>
        <TextField
          multiline
          minRows={2}
          placeholder='e.g. "revenue and orders this year, revenue by region and channel, a monthly trend, top customers"'
          value={flow.ask}
          onChange={(e) => flow.setAsk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void flow.propose();
            }
          }}
          disabled={flow.proposing}
          fullWidth
          slotProps={{ htmlInput: { 'data-testid': 'visuals-ask' } }}
        />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={
              flow.proposing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />
            }
            onClick={() => void flow.propose()}
            disabled={flow.proposing || !flow.ask.trim()}
          >
            Propose
          </Button>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Enter to send, Shift+Enter for a new line
          </Typography>
        </Stack>
        {flow.proposeError && <Alert severity="error">{flow.proposeError}</Alert>}
        {fresh.proposal && (
          <Alert severity="success" data-testid="visuals-proposal">
            <AlertTitle>Proposal from {fresh.proposal.model.provider}</AlertTitle>
            {fresh.proposal.reason}
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {fresh.proposal.model.model}
            </Typography>
          </Alert>
        )}
      </Stack>
    </Panel>
  );
}

export function VisualsStep({ flow }: { flow: AuthorFlow }) {
  const { fresh, preview } = flow;
  const complete = fresh.visuals.filter(isComplete).length;
  const incomplete = fresh.visuals.length - complete;

  return (
    <Stack spacing={2.5}>
      <AskPanel flow={flow} />

      <Panel
        title="Visuals"
        description="Each visual reads one dataset; the builder picks the field wells from the columns' types. KPIs are laid out first."
        actions={
          <>
            {preview.loading ? (
              <StatusIndicator kind="loading">Building</StatusIndicator>
            ) : complete > 0 ? (
              <StatusIndicator kind={incomplete > 0 ? 'warning' : 'success'}>
                {complete} ready{incomplete > 0 ? `, ${incomplete} incomplete` : ''}
              </StatusIndicator>
            ) : (
              <StatusIndicator kind="pending">None yet</StatusIndicator>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={fresh.addVisual}
              data-testid="add-visual"
            >
              Add visual
            </Button>
          </>
        }
      >
        {fresh.visuals.length === 0 ? (
          <EmptyState
            compact
            title="No visuals yet"
            description="Describe the dashboard above and propose, or add a visual and name its columns."
            action={
              <Button variant="contained" startIcon={<Add />} onClick={fresh.addVisual}>
                Add visual
              </Button>
            }
          />
        ) : (
          <Stack spacing={1.5}>
            {fresh.visuals.map((visual, index) => (
              <VisualCard key={visual.id} flow={flow} visual={visual} index={index} />
            ))}
          </Stack>
        )}
      </Panel>

      {preview.error && <Alert severity="error">{preview.error}</Alert>}
      {preview.warnings.length > 0 && (
        <Alert severity="warning" data-testid="visuals-warnings">
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            The builder could not place everything
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {preview.warnings.map((warning) => (
              <li key={warning}>
                <Typography variant="body2">{warning}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
      {preview.changes.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {preview.changes.map((change, i) => (
            <Chip
              key={`${change.kind}-${i}-${change.description}`}
              size="small"
              variant="outlined"
              label={change.description}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={flow.back}>Back</Button>
        <Button variant="contained" onClick={flow.next} disabled={complete === 0}>
          Continue
        </Button>
      </Stack>
    </Stack>
  );
}
