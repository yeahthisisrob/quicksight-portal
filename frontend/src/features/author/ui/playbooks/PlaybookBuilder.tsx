/**
 * Compose a playbook: inputs, what to select, and the steps to take on each
 * selected asset. Any value can be typed or taken from an input (filled in
 * when it is previewed). The server checks the whole spec on save and says
 * what is wrong in words; nothing runs until it is previewed.
 */
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  Close,
  DeleteOutlined,
  InputOutlined,
  Save,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type {
  PlaybookSpecCondition,
  PlaybookSpecInput,
  PlaybookSpecStep,
} from '@/shared/api/modules/playbooks';

import { Panel } from '../primitives/Panel';

type Input = PlaybookSpecInput['inputs'][number];
type Value = string | number | boolean | undefined;

const PLACEHOLDER = /^\{\{\s*([\w-]+)\s*\}\}$/;

const CONDITIONS: Record<
  PlaybookSpecCondition['kind'],
  { label: string; field?: keyof PlaybookSpecCondition; hint?: string }
> = {
  views: { label: 'Viewed at least', field: 'min', hint: 'views' },
  viewsAtMost: { label: 'Viewed at most', field: 'max', hint: 'views' },
  readsEngine: {
    label: 'Reads a data source of engine',
    field: 'engine',
    hint: 'REDSHIFT, ATHENA…',
  },
  readsGoverned: { label: 'Reads a SMUS-governed dataset', field: 'value', hint: 'true or false' },
  tagged: { label: 'Tagged', field: 'tag', hint: 'key or key=value' },
  sharedWith: { label: 'Shared with', field: 'principal', hint: 'group or user name' },
  nameContains: { label: 'Name contains', field: 'text' },
  hasErrors: { label: 'Has definition errors' },
};

const STEPS: Record<PlaybookSpecStep['kind'], { label: string; help: string }> = {
  matchDataset: {
    label: 'Match a replacement dataset',
    help: 'For each dataset it reads, one of this engine (governed, if asked) holding every column it uses. With inference, a model maps names that differ; every mapping is checked.',
  },
  rebind: {
    label: 'Rebind onto the match',
    help: 'Checked by a dry run first; anything that would not resolve goes to review.',
  },
  tag: { label: 'Tag', help: 'A marker only; nothing is deleted.' },
  repair: {
    label: 'Repair definition errors',
    help: 'What the repair plan can fix alone; choices go to review.',
  },
  addToFolder: {
    label: 'Add to a folder',
    help: 'A shared folder then carries its audience. Anything already in it is skipped; nothing is removed from other folders.',
  },
};

const TAG_TARGETS = [
  { value: 'asset', label: 'the asset itself' },
  { value: 'replaced-datasets', label: 'the datasets it moved off' },
  { value: 'replaced-datasources', label: 'their data sources' },
] as const;

/** A value typed in, or taken from one of the inputs. */
function ValueField({
  label,
  value,
  inputs,
  onChange,
  hint,
  width = 200,
}: {
  label: string;
  value: Value;
  inputs: Input[];
  onChange: (value: Value) => void;
  hint?: string;
  width?: number;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const bound = typeof value === 'string' ? PLACEHOLDER.exec(value)?.[1] : undefined;
  if (bound) {
    return (
      <Chip
        icon={<InputOutlined />}
        label={`input ${bound}`}
        onDelete={() => onChange(undefined)}
        variant="outlined"
        color="primary"
      />
    );
  }
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <TextField
        size="small"
        label={label}
        placeholder={hint}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const asNumber = Number(raw);
          onChange(
            raw === ''
              ? undefined
              : raw === 'true'
                ? true
                : raw === 'false'
                  ? false
                  : raw.trim() !== '' && Number.isFinite(asNumber)
                    ? asNumber
                    : raw
          );
        }}
        sx={{ width }}
      />
      {inputs.length > 0 && (
        <>
          <Tooltip title="Take it from an input">
            <IconButton
              size="small"
              onClick={(e) => setAnchor(e.currentTarget)}
              aria-label={`${label} from an input`}
            >
              <InputOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {inputs.map((input) => (
              <MenuItem
                key={input.key}
                onClick={() => {
                  onChange(`{{${input.key}}}`);
                  setAnchor(null);
                }}
              >
                {input.label} ({input.key})
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Stack>
  );
}

function AddMenu<K extends string>({
  label,
  options,
  onAdd,
}: {
  label: string;
  options: Record<K, { label: string }>;
  onAdd: (kind: K) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button size="small" startIcon={<Add />} onClick={(e) => setAnchor(e.currentTarget)}>
        {label}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {(Object.keys(options) as K[]).map((kind) => (
          <MenuItem
            key={kind}
            onClick={() => {
              onAdd(kind);
              setAnchor(null);
            }}
          >
            {options[kind].label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function InputsEditor({
  inputs,
  onChange,
}: {
  inputs: Input[];
  onChange: (inputs: Input[]) => void;
}) {
  const set = (i: number, patch: Partial<Input>) =>
    onChange(inputs.map((input, j) => (j === i ? { ...input, ...patch } : input)));
  return (
    <Stack spacing={1.5}>
      {inputs.map((input, i) => (
        <Stack
          key={i}
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{ alignItems: { md: 'center' } }}
        >
          <TextField
            size="small"
            label="Key"
            value={input.key}
            onChange={(e) => set(i, { key: e.target.value })}
            sx={{ width: 140 }}
          />
          <TextField
            size="small"
            label="Label"
            value={input.label}
            onChange={(e) => set(i, { label: e.target.value })}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <TextField
            select
            size="small"
            label="Kind"
            value={input.kind}
            onChange={(e) => set(i, { kind: e.target.value as Input['kind'] })}
            sx={{ width: 140 }}
          >
            {['number', 'text', 'boolean', 'engine', 'datasource', 'folder'].map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Default"
            value={input.default === undefined ? '' : String(input.default)}
            onChange={(e) =>
              set(i, {
                default:
                  e.target.value === ''
                    ? undefined
                    : input.kind === 'number'
                      ? Number(e.target.value)
                      : input.kind === 'boolean'
                        ? e.target.value === 'true'
                        : e.target.value,
              })
            }
            sx={{ width: 140 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(input.required)}
                onChange={(e) => set(i, { required: e.target.checked })}
              />
            }
            label="Required"
          />
          <IconButton
            aria-label="Remove input"
            onClick={() => onChange(inputs.filter((_, j) => j !== i))}
          >
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Box>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() =>
            onChange([
              ...inputs,
              { key: `input${inputs.length + 1}`, label: 'New input', kind: 'text' },
            ])
          }
        >
          Add input
        </Button>
      </Box>
    </Stack>
  );
}

function StepCard({
  step,
  index,
  count,
  inputs,
  onChange,
  onMove,
  onRemove,
}: {
  step: PlaybookSpecStep;
  index: number;
  count: number;
  inputs: Input[];
  onChange: (step: PlaybookSpecStep) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const meta = STEPS[step.kind];
  const field = (key: keyof PlaybookSpecStep, label: string, hint?: string) => (
    <ValueField
      label={label}
      hint={hint}
      value={step[key] as Value}
      inputs={inputs}
      onChange={(value) => onChange({ ...step, [key]: value })}
    />
  );
  return (
    <Box
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}
      data-testid={`step-${index}`}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Chip size="small" label={index + 1} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {meta.label}
        </Typography>
        <IconButton
          size="small"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label="Move up"
        >
          <ArrowUpward fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label="Move down"
        >
          <ArrowDownward fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onRemove} aria-label="Remove step">
          <Close fontSize="small" />
        </IconButton>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {meta.help}
      </Typography>
      {step.kind === 'matchDataset' && (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
          {field('engine', 'Engine', 'ATHENA')}
          {field('governed', 'SMUS-governed', 'true or false')}
          {field('infer', 'Use a model', 'true or false')}
          {field('minConfidence', 'Min confidence', '0.8')}
        </Stack>
      )}
      {step.kind === 'addToFolder' && (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {field('folder', 'Folder id', 'or take it from a folder input')}
        </Stack>
      )}
      {step.kind === 'tag' && (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
          <TextField
            select
            size="small"
            label="Tag"
            value={step.target ?? 'asset'}
            onChange={(e) =>
              onChange({ ...step, target: e.target.value as PlaybookSpecStep['target'] })
            }
            sx={{ width: 240 }}
          >
            {TAG_TARGETS.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          {field('key', 'Key', 'portal:deprecated')}
          {field('value', 'Value')}
        </Stack>
      )}
    </Box>
  );
}

export function PlaybookBuilder({
  initial,
  title,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial: PlaybookSpecInput;
  title: string;
  saving: boolean;
  error: string | null;
  onSave: (spec: PlaybookSpecInput) => void;
  onCancel: () => void;
}) {
  const [spec, setSpec] = useState<PlaybookSpecInput>(initial);
  const set = (patch: Partial<PlaybookSpecInput>) => setSpec((prev) => ({ ...prev, ...patch }));
  const where = spec.select.where;
  const setWhere = (next: PlaybookSpecCondition[]) =>
    set({ select: { ...spec.select, where: next } });
  const steps = spec.steps;
  const editedWithin = spec.gates?.editedWithinDays;

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          {title}
        </Typography>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          disabled={saving || !spec.name.trim() || steps.length === 0}
          onClick={() => onSave(spec)}
        >
          Save
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}

      <Panel title="What it is">
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Name"
            value={spec.name}
            onChange={(e) => set({ name: e.target.value })}
            sx={{ maxWidth: 560 }}
          />
          <TextField
            size="small"
            label="What it does, for the card"
            value={spec.description ?? ''}
            onChange={(e) => set({ description: e.target.value })}
            multiline
            minRows={2}
          />
        </Stack>
      </Panel>

      <Panel
        title="Inputs"
        description="Values asked for when it is previewed. Anything below can use one."
      >
        <InputsEditor inputs={spec.inputs} onChange={(inputs) => set({ inputs })} />
      </Panel>

      <Panel title="Select" description="Which assets it looks at. Every condition must hold.">
        <Stack spacing={2}>
          <ToggleButtonGroup
            size="small"
            value={spec.select.assetTypes}
            onChange={(_, next: PlaybookSpecInput['select']['assetTypes']) =>
              next.length > 0 && set({ select: { ...spec.select, assetTypes: next } })
            }
            aria-label="Asset types"
          >
            <ToggleButton value="dashboard">Dashboards</ToggleButton>
            <ToggleButton value="analysis">Analyses</ToggleButton>
            <ToggleButton value="dataset">Datasets</ToggleButton>
            <ToggleButton value="datasource">Data sources</ToggleButton>
          </ToggleButtonGroup>
          {where.map((condition, i) => {
            const meta = CONDITIONS[condition.kind];
            return (
              <Stack
                key={i}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center' }}
                data-testid={`condition-${i}`}
              >
                <Typography variant="body2" sx={{ minWidth: 240 }}>
                  {meta.label}
                </Typography>
                {meta.field && (
                  <ValueField
                    label={meta.hint ?? 'Value'}
                    value={condition[meta.field] as Value}
                    inputs={spec.inputs}
                    onChange={(value) =>
                      setWhere(where.map((c, j) => (j === i ? { ...c, [meta.field!]: value } : c)))
                    }
                  />
                )}
                <IconButton
                  aria-label="Remove condition"
                  onClick={() => setWhere(where.filter((_, j) => j !== i))}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
          <Box>
            <AddMenu
              label="Add condition"
              options={CONDITIONS}
              onAdd={(kind) => setWhere([...where, { kind }])}
            />
          </Box>
        </Stack>
      </Panel>

      <Panel
        title="Steps"
        description="Taken in order on each selected asset. A step that needs a person sends the asset to review."
      >
        <Stack spacing={1.5}>
          {steps.map((step, i) => (
            <StepCard
              key={i}
              step={step}
              index={i}
              count={steps.length}
              inputs={spec.inputs}
              onChange={(next) => set({ steps: steps.map((s, j) => (j === i ? next : s)) })}
              onMove={(delta) => {
                const next = [...steps];
                const [moved] = next.splice(i, 1);
                next.splice(i + delta, 0, moved!);
                set({ steps: next });
              }}
              onRemove={() => set({ steps: steps.filter((_, j) => j !== i) })}
            />
          ))}
          <Box>
            <AddMenu
              label="Add step"
              options={STEPS}
              onAdd={(kind) =>
                set({
                  steps: [
                    ...steps,
                    kind === 'tag' ? { kind, target: 'asset', key: '', value: '' } : { kind },
                  ],
                })
              }
            />
          </Box>
        </Stack>
      </Panel>

      <Panel title="Conditions it starts with" description="Anyone previewing it can change them.">
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Typography variant="body2">Skip anything edited in the last</Typography>
          <TextField
            size="small"
            type="number"
            value={editedWithin === undefined ? '' : String(editedWithin)}
            onChange={(e) =>
              set({
                gates: {
                  ...(spec.gates ?? {}),
                  editedWithinDays: e.target.value === '' ? undefined : Number(e.target.value),
                },
              })
            }
            sx={{ width: 96 }}
          />
          <Typography variant="body2">days</Typography>
        </Stack>
      </Panel>
    </Stack>
  );
}
