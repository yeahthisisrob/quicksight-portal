/**
 * The calculated fields a change adds, each placed by the organisation's
 * field strategy (Settings, Authoring guidance): use a column the dataset
 * already has, keep it in the analysis, or move it to the dataset or the
 * source. The ones that belong elsewhere are listed again as follow-ups.
 */
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';

import type { FieldVerdict } from '@/shared/api/modules/assistant';

type Verdict = FieldVerdict['verdict'];

const VERDICT: Record<
  Verdict,
  { label: string; color: 'success' | 'warning' | 'info' | 'default' }
> = {
  'use-column': { label: 'Use the existing column', color: 'success' },
  'push-down': { label: 'Push down to the source', color: 'warning' },
  dataset: { label: 'Move into the dataset', color: 'info' },
  'row-level': { label: 'Row-level', color: 'default' },
  analysis: { label: 'Stays in the analysis', color: 'default' },
};

const FOLLOW_UP: Partial<Record<Verdict, string>> = {
  'push-down': 'materialise in the source',
  dataset: 'move into the QuickSight dataset',
};

export function FieldVerdicts({ fields }: { fields: FieldVerdict[] }) {
  const followUps = fields.filter((f) => FOLLOW_UP[f.verdict]);
  return (
    <Stack spacing={1}>
      {fields.map((f) => {
        const verdict = VERDICT[f.verdict];
        return (
          <Box key={`${f.name}|${f.expression}`} sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {f.name}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={verdict.color}
                label={f.column ? `${verdict.label}: ${f.column}` : verdict.label}
              />
            </Stack>
            <Typography
              variant="caption"
              component="div"
              sx={{ fontFamily: 'monospace', color: 'text.secondary', overflowWrap: 'anywhere' }}
            >
              {f.expression}
            </Typography>
            <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
              {f.note}
            </Typography>
          </Box>
        );
      })}
      {followUps.length > 0 && (
        <Alert severity="info" variant="outlined">
          <Typography variant="caption" component="div" sx={{ fontWeight: 700 }}>
            Follow-ups
          </Typography>
          {followUps.map((f) => (
            <Typography key={f.name} variant="caption" component="div">
              {f.name}: {FOLLOW_UP[f.verdict]}
            </Typography>
          ))}
        </Alert>
      )}
    </Stack>
  );
}
