/**
 * The portal and AWS side by side, gaps shown on both sides: this matrix is
 * how the portal tracks what it lacks as well as what AWS lacks. One
 * capability per row, a level and a few words per side. Only what can be checked goes
 * in the AWS column; the page carries the date it was checked, and a row
 * whose AWS side changes is updated, never left to overstate the portal.
 *
 * A row earns its place where the portal fills (or could fill) an API or
 * UX gap on the AWS side; it is not a checklist of everything QuickSight
 * has.
 */
import { CheckCircle, RadioButtonUnchecked, Schedule, TonalityOutlined } from '@mui/icons-material';
import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** announced = AWS has announced it and it is not yet available. */
type Level = 'yes' | 'partial' | 'announced' | 'no';

interface Side {
  level: Level;
  note: string;
}

interface ParityRow {
  capability: string;
  portal: Side;
  aws: Side;
}

/** When the AWS column was last checked against AWS's docs and announcements. */
export const PARITY_CHECKED = 'September 2026';

export const PARITY_ROWS: ParityRow[] = [
  {
    capability: 'Search and lineage graph',
    portal: { level: 'yes', note: 'API shaped like AWS Context' },
    aws: { level: 'announced', note: 'AWS Context' },
  },
  {
    capability: 'Generative authoring',
    portal: { level: 'yes', note: 'By API, previewed first' },
    aws: { level: 'partial', note: 'Console only' },
  },
  {
    capability: 'Calculated fields as metadata',
    portal: { level: 'yes', note: 'Indexed, with who reads each' },
    aws: { level: 'no', note: 'Not in Glue or SMUS catalogs' },
  },
  {
    capability: 'Dataset to SMUS listing',
    portal: { level: 'yes', note: 'Matched automatically' },
    aws: { level: 'no', note: 'Not recorded' },
  },
  {
    capability: 'Fixes across the account',
    portal: { level: 'yes', note: 'Playbooks with dry runs' },
    aws: { level: 'no', note: 'One asset at a time' },
  },
  {
    capability: 'Refactor calculated fields',
    portal: { level: 'yes', note: 'Rename, drop, replace safely' },
    aws: { level: 'no', note: 'Manual, per asset' },
  },
  {
    capability: 'Restore deleted assets',
    portal: { level: 'yes', note: 'Dashboards, analyses, datasets' },
    aws: { level: 'partial', note: 'Analyses, within a window' },
  },
  {
    capability: 'Version history',
    portal: { level: 'no', note: 'Last export only' },
    aws: { level: 'partial', note: 'Dashboards; datasets in console' },
  },
  {
    capability: 'Assets as code, cross-account',
    portal: { level: 'no', note: 'One account' },
    aws: { level: 'yes', note: 'Asset bundles' },
  },
  {
    capability: 'Themes across assets',
    portal: { level: 'no', note: 'Kept on copy only' },
    aws: { level: 'partial', note: 'Applied per analysis' },
  },
  {
    capability: 'Namespaces',
    portal: { level: 'no', note: 'Default namespace only' },
    aws: { level: 'yes', note: 'Through the API' },
  },
];

const LEVELS: Record<Level, { label: string; icon: ReactNode }> = {
  yes: { label: 'Yes', icon: <CheckCircle fontSize="small" color="success" /> },
  partial: { label: 'Partly', icon: <TonalityOutlined fontSize="small" color="warning" /> },
  announced: { label: 'Announced', icon: <Schedule fontSize="small" color="info" /> },
  no: { label: 'No', icon: <RadioButtonUnchecked fontSize="small" color="disabled" /> },
};

const COLUMNS = { xs: '1fr 1fr', sm: 'minmax(180px, 1.2fr) 1fr 1fr' };

function Cell({ side }: { side: Side }) {
  const level = LEVELS[side.level];
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
      <Box aria-label={level.label} sx={{ display: 'flex', pt: 0.125 }}>
        {level.icon}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0 }}>
        {side.note}
      </Typography>
    </Stack>
  );
}

export function AwsParity({ rows = PARITY_ROWS }: { rows?: ParityRow[] }) {
  return (
    <Box
      role="table"
      sx={{ borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}
    >
      <Box
        role="row"
        sx={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          gap: 2,
          px: 2,
          py: 1.25,
          bgcolor: 'action.hover',
        }}
      >
        <Typography
          role="columnheader"
          variant="overline"
          sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}
        >
          Capability
        </Typography>
        <Typography role="columnheader" variant="overline" sx={{ color: 'text.secondary' }}>
          Portal
        </Typography>
        <Typography role="columnheader" variant="overline" sx={{ color: 'text.secondary' }}>
          AWS today
        </Typography>
      </Box>
      {rows.map((row) => (
        <Box
          key={row.capability}
          role="row"
          sx={{
            display: 'grid',
            gridTemplateColumns: COLUMNS,
            gap: { xs: 1, sm: 2 },
            px: 2,
            py: 1.25,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            role="rowheader"
            variant="subtitle2"
            sx={{ fontWeight: 600, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          >
            {row.capability}
          </Typography>
          <Box role="cell">
            <Cell side={row.portal} />
          </Box>
          <Box role="cell">
            <Cell side={row.aws} />
          </Box>
        </Box>
      ))}
      <Stack
        direction="row"
        spacing={2}
        sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap', rowGap: 0.5 }}
      >
        {Object.values(LEVELS).map((level) => (
          <Stack key={level.label} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {level.icon}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {level.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
