/**
 * Step 4 - the standard to migrate onto: a template dashboard whose
 * furniture, theme and tile size the result takes, and the type rules
 * applied to every visual at once. Optional; skipping it keeps the layout.
 */
import { Add, Close } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { compactNumber } from '../../lib/ranking';
import {
  CHART_FAMILY_PRESETS,
  type ChartRule,
  describeParts,
  describeTypeRules,
  EDITABLE_VISUAL_TYPES,
  type EditableVisualType,
  TEMPLATE_PARTS,
  VISUAL_TYPE_LABELS,
} from '../../model/standard';
import type { AuthorFlow, StandardCandidate } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

const SELECT_WIDTH = 180;
const LIST_MAX_HEIGHT = 320;

function TemplateList({ flow }: { flow: AuthorFlow }) {
  const { standard } = flow;
  const chosen = standard.template?.assetId ?? null;
  const items = standard.candidates.items.filter((c) => c.id !== flow.state.source?.id);

  if (standard.candidates.loading) {
    return <StatusIndicator kind="loading">Looking for templates</StatusIndicator>;
  }
  if (items.length === 0) {
    return (
      <Alert severity="info">
        No dashboard is tagged as a template yet. Mark one from the Source step and it appears here
        as a standard to migrate onto.
      </Alert>
    );
  }
  const pick = (candidate: StandardCandidate | null) => standard.chooseTemplate(candidate);
  return (
    <List dense disablePadding sx={{ maxHeight: LIST_MAX_HEIGHT, overflow: 'auto' }}>
      <ListItemButton
        selected={chosen === null}
        onClick={() => pick(null)}
        sx={{ borderRadius: 1 }}
        data-template="none"
      >
        <ListItemText primary="None" secondary="Keep the source's layout and theme" />
      </ListItemButton>
      {items.map((candidate) => (
        <ListItemButton
          key={candidate.id}
          selected={chosen === candidate.id}
          onClick={() => pick(candidate)}
          sx={{ borderRadius: 1 }}
          data-template={candidate.id}
        >
          <ListItemText
            primary={candidate.name}
            secondary={
              candidate.views > 0 ? `${compactNumber(candidate.views)} views` : 'No views recorded'
            }
          />
          <Chip size="small" color="warning" label="Template" sx={{ height: 20 }} />
        </ListItemButton>
      ))}
    </List>
  );
}

function TemplateParts({ flow }: { flow: AuthorFlow }) {
  const { standard } = flow;
  if (!standard.template) {
    return null;
  }
  const parts = standard.template.parts;
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        What comes from {standard.template.name}
      </Typography>
      {TEMPLATE_PARTS.map((part) => (
        <Box key={part.key}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={parts[part.key]}
                onChange={(e) => standard.setTemplatePart(part.key, e.target.checked)}
              />
            }
            label={part.label}
          />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', ml: 6, mt: -0.5 }}
          >
            {part.help}
          </Typography>
        </Box>
      ))}
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
        Visuals reflow into the template’s tile size below its furniture, in their current order.
        Kept: {describeParts(parts)}.
      </Typography>
    </Stack>
  );
}

function TypeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EditableVisualType;
  onChange: (value: EditableVisualType) => void;
}) {
  const id = `standard-${label.toLowerCase()}`;
  return (
    <FormControl size="small" sx={{ minWidth: SELECT_WIDTH }}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select
        labelId={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as EditableVisualType)}
      >
        {EDITABLE_VISUAL_TYPES.map((type) => (
          <MenuItem key={type} value={type}>
            {VISUAL_TYPE_LABELS[type]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ChartRules({ flow }: { flow: AuthorFlow }) {
  const { standard } = flow;
  const [draft, setDraft] = useState<ChartRule>({ from: 'Table', to: 'PivotTable' });
  const rules = standard.typeRules.chartFamily;

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Chart family swaps
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Every visual of one type becomes another, wherever its fields fit. The ones that do not fit
        stay as they are and are listed on the mockup.
      </Typography>
      {rules.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {rules.map((rule) => (
            <Chip
              key={rule.from}
              label={`${VISUAL_TYPE_LABELS[rule.from]} → ${VISUAL_TYPE_LABELS[rule.to]}`}
              onDelete={() => standard.removeChartRule(rule.from)}
              deleteIcon={<Close />}
              data-rule={`${rule.from}-${rule.to}`}
            />
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <TypeSelect
          label="From"
          value={draft.from}
          onChange={(from) => setDraft({ ...draft, from })}
        />
        <TypeSelect label="To" value={draft.to} onChange={(to) => setDraft({ ...draft, to })} />
        <Tooltip title={draft.from === draft.to ? 'Pick two different types' : 'Add the rule'}>
          <span>
            <IconButton
              size="small"
              aria-label="Add chart rule"
              disabled={draft.from === draft.to}
              onClick={() => standard.addChartRule(draft)}
            >
              <Add fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {CHART_FAMILY_PRESETS.map((preset) => (
          <Button
            key={`${preset.from}-${preset.to}`}
            size="small"
            variant="text"
            onClick={() => standard.addChartRule(preset)}
            disabled={rules.some((r) => r.from === preset.from && r.to === preset.to)}
          >
            {VISUAL_TYPE_LABELS[preset.from]} → {VISUAL_TYPE_LABELS[preset.to]}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

function OtherRules({ flow }: { flow: AuthorFlow }) {
  const { standard } = flow;
  return (
    <Stack spacing={0.5}>
      <Box>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={standard.typeRules.kpi}
              onChange={(e) => standard.setTypeRules({ kpi: e.target.checked })}
            />
          }
          label="Standardise KPIs"
        />
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', ml: 6, mt: -0.5 }}
        >
          Gauges become KPIs, and every KPI takes the template’s KPI options (sparkline, comparison)
          when a template is chosen.
        </Typography>
      </Box>
      <Box>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={standard.typeRules.casts}
              onChange={(e) => standard.setTypeRules({ casts: e.target.checked })}
            />
          }
          label="Cast changed column types"
        />
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', ml: 6, mt: -0.5 }}
        >
          Where the new dataset’s column type differs from what the visuals were built for, a
          calculated field with the cast is added and the visuals read it instead.
        </Typography>
      </Box>
    </Stack>
  );
}

export function StandardStep({ flow }: { flow: AuthorFlow }) {
  const { standard } = flow;
  const summary = standard.template
    ? `${standard.template.name}, ${describeParts(standard.template.parts)}`
    : 'No template';
  return (
    <Stack spacing={2.5}>
      <Panel
        title="Standard"
        description="Migrate onto a template dashboard’s layout standard and convert visual types in bulk. Skip this to keep the layout as it is."
        actions={
          standard.active ? (
            <StatusIndicator kind="success">Standard set</StatusIndicator>
          ) : (
            <StatusIndicator kind="pending">Optional</StatusIndicator>
          )
        }
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 2fr) 3fr' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Template dashboard
            </Typography>
            <TemplateList flow={flow} />
          </Stack>
          <Stack spacing={3}>
            <TemplateParts flow={flow} />
            <ChartRules flow={flow} />
            <OtherRules flow={flow} />
          </Stack>
        </Box>
      </Panel>

      <Panel title="What will change" description="Before you see the mockup.">
        <Stack spacing={0.5}>
          <Typography variant="body2">
            <strong>Template:</strong> {summary}
          </Typography>
          <Typography variant="body2">
            <strong>Type rules:</strong> {describeTypeRules(standard.typeRules)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={flow.back}>Back</Button>
          <Button
            variant="contained"
            onClick={flow.next}
            disabled={flow.status.mockup === 'locked'}
          >
            {standard.active ? 'See the mockup' : 'Skip to the mockup'}
          </Button>
        </Stack>
      </Panel>
    </Stack>
  );
}
