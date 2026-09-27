/**
 * What kind of calculation a field is and where QuickSight evaluates it,
 * from the shared classifier: a chip for lists, and the order of
 * evaluation with the field's stage marked, for a field in focus.
 */
import { OpenInNew } from '@mui/icons-material';
import { Box, Chip, Link, Stack, Tooltip, Typography } from '@mui/material';

import {
  EVALUATION_ORDER,
  type ExpressionVerdict,
  type FieldKind,
  ORDER_OF_EVALUATION_URL,
} from '@/shared/lib';

const KIND_LABEL: Record<FieldKind, string> = {
  'row-level': 'Row-level',
  aggregate: 'Aggregate',
  'lac-a': 'LAC-A',
  'lac-w': 'LAC-W',
  'table-calc': 'Table calculation',
};

const KIND_COLOR: Record<FieldKind, 'success' | 'primary' | 'secondary' | 'info' | 'warning'> = {
  'row-level': 'success',
  aggregate: 'primary',
  'lac-a': 'secondary',
  'lac-w': 'info',
  'table-calc': 'warning',
};

function fieldKindLabel(verdict: ExpressionVerdict): string {
  const level = verdict.calcLevel && verdict.kind === 'lac-w' ? ` · ${verdict.calcLevel}` : '';
  return `${KIND_LABEL[verdict.kind]}${level}`;
}

/** The kind, and whether SPICE computes it once at ingestion. */
export function FieldKindChip({ verdict }: { verdict: ExpressionVerdict }) {
  const stage = EVALUATION_ORDER.find((s) => s.id === verdict.stage);
  const why = [
    verdict.materialisable
      ? 'Materialised: SPICE computes it once at ingestion.'
      : 'Computed at query time.',
    ...verdict.reasons,
    ...(verdict.error ? [`Did not parse: ${verdict.error.message}`] : []),
  ];
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
            {stage?.label}
          </Typography>
          {why.map((line) => (
            <Typography key={line} variant="caption" sx={{ display: 'block' }}>
              {line}
            </Typography>
          ))}
        </Box>
      }
    >
      <Chip
        size="small"
        variant="outlined"
        color={KIND_COLOR[verdict.kind]}
        label={`${fieldKindLabel(verdict)}${verdict.materialisable ? ' · SPICE' : ''}`}
      />
    </Tooltip>
  );
}

/** QuickSight's order of evaluation, the field's stage marked. */
export function EvaluationOrder({ verdict }: { verdict: ExpressionVerdict }) {
  const at = EVALUATION_ORDER.findIndex((s) => s.id === verdict.stage);
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 0.75 }}>
        <Typography variant="subtitle2">Order of evaluation</Typography>
        <Link
          href={ORDER_OF_EVALUATION_URL}
          target="_blank"
          rel="noreferrer"
          variant="caption"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
        >
          AWS docs
          <OpenInNew sx={{ fontSize: 12 }} />
        </Link>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {EVALUATION_ORDER.map((stage, i) => (
          <Tooltip key={stage.id} title={stage.summary}>
            <Chip
              size="small"
              label={stage.label}
              color={i === at ? KIND_COLOR[verdict.kind] : 'default'}
              variant={i === at ? 'filled' : 'outlined'}
              sx={{ opacity: i > at ? 0.5 : 1 }}
            />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}
