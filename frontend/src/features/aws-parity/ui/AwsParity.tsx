/**
 * The portal and AWS side by side, gaps shown on both sides: this matrix is
 * how the portal tracks what it lacks as well as what AWS lacks. One
 * capability per row, a level and a few words per side, and one sentence
 * behind it (what the portal does, or what closing its gap means) for
 * whoever opens the row. Only what can be checked goes in the AWS column; the page carries the date it was checked, and a row
 * whose AWS side changes is updated, never left to overstate the portal.
 *
 * A row earns its place where the portal fills (or could fill) an API or
 * UX gap on the AWS side; it is not a checklist of everything QuickSight
 * has.
 */
import {
  CheckCircle,
  ExpandMore,
  RadioButtonUnchecked,
  Schedule,
  TonalityOutlined,
} from '@mui/icons-material';
import { Box, ButtonBase, Collapse, Stack, Typography } from '@mui/material';
import { type ReactNode, useState } from 'react';

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
  /** One sentence: how the portal does it, or what closing its gap means. */
  detail: string;
}

/** When the AWS column was last checked against AWS's docs and announcements. */
export const PARITY_CHECKED = 'September 2026';

export const PARITY_ROWS: ParityRow[] = [
  {
    capability: 'Search and lineage graph',
    portal: { level: 'yes', note: 'API shaped like AWS Context' },
    aws: { level: 'announced', note: 'AWS Context' },
    detail:
      'Search, get and related over every asset, field and listing. When AWS Context reads QuickSight, agents are pointed there, and the portal keeps the parsed definitions and the checked write paths.',
  },
  {
    capability: 'Generative authoring',
    portal: { level: 'yes', note: 'By API, previewed first' },
    aws: { level: 'partial', note: 'Console only' },
    detail:
      'Build or edit a dashboard from a sentence through the API an agent can call: planned against the datasets, previewed, then written. AWS offers this in the console only.',
  },
  {
    capability: 'Field-level lineage',
    portal: { level: 'yes', note: 'Source column to visual' },
    aws: { level: 'no', note: 'None in QuickSight' },
    detail:
      'Every dataset column is traced through renames to the parent dataset column or the governed listing column, each calculated field to what it reads, and each visual to the fields it shows. Open a column or field in the Studio to see what a change touches; agents follow the same relations in the context graph.',
  },
  {
    capability: 'Calculated fields as metadata',
    portal: { level: 'yes', note: 'Indexed, with who reads each' },
    aws: { level: 'no', note: 'Not in Glue or SMUS catalogs' },
    detail:
      "Each field's expression, where it is defined and read, and the governed column it may duplicate, searchable across the account.",
  },
  {
    capability: 'Dataset to SMUS listing',
    portal: { level: 'yes', note: 'Matched automatically' },
    aws: { level: 'no', note: 'Not recorded' },
    detail:
      'Matched by source table, SQL references, name, then lineage, so governed descriptions reach QuickSight authors and the assistant.',
  },
  {
    capability: 'Fixes across the account',
    portal: { level: 'yes', note: 'Playbooks with dry runs' },
    aws: { level: 'no', note: 'One asset at a time' },
    detail:
      'Playbooks: select, gate, dry-run per asset, preview, run the chosen rows, pause and resume, report. Custom ones are specs anyone can save.',
  },
  {
    capability: 'Refactor calculated fields',
    portal: { level: 'yes', note: 'Rename, drop, replace safely' },
    aws: { level: 'no', note: 'Manual, per asset' },
    detail:
      'Rename to a standard, drop what nothing reads, or replace with a governed column, everywhere each is read. A dataset field is migrated reader by reader so nothing breaks.',
  },
  {
    capability: 'Restore deleted assets',
    portal: { level: 'yes', note: 'Dashboards, analyses, datasets' },
    aws: { level: 'partial', note: 'Analyses, within a window' },
    detail:
      "Every export keeps each asset's definition; a deleted dashboard, analysis or dataset is restored from the Studio with its permissions.",
  },
  {
    capability: 'Expression kinds',
    portal: { level: 'yes', note: 'Kind, stage, SPICE or not' },
    aws: { level: 'partial', note: 'Checked in the console only' },
    detail:
      'A light local parser gives each calculated field its kind (row-level, aggregate, LAC-A, LAC-W, table calculation), its stage in the order of evaluation and whether SPICE materialises it, for people in the Studio and the catalog, and for the assistant and playbooks through the context graph. AWS has no API for this.',
  },
  {
    capability: 'Version history',
    portal: { level: 'no', note: 'Last export only' },
    aws: { level: 'partial', note: 'Dashboards; datasets in console' },
    detail:
      "To close: versioning on the metadata bucket, a version kept only when the definition changes, with diff and restore of any version. Dashboards merge with QuickSight's own versions.",
  },
  {
    capability: 'Assets as code, cross-account',
    portal: { level: 'no', note: 'One account' },
    aws: { level: 'yes', note: 'Asset bundles' },
    detail:
      "To close: asset bundles as the transport between accounts, with the portal's remap of data sources and datasets, a dry run and a report around them.",
  },
  {
    capability: 'Themes across assets',
    portal: { level: 'no', note: 'Kept on copy only' },
    aws: { level: 'partial', note: 'Applied per analysis' },
    detail: 'To close: which assets use which theme, and applying one across many as a playbook.',
  },
  {
    capability: 'Namespaces',
    portal: { level: 'no', note: 'Default namespace only' },
    aws: { level: 'yes', note: 'Through the API' },
    detail: 'To close: pick a namespace; its users, groups and assets; share across namespaces.',
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

function ParityLine({
  row,
  open,
  onToggle,
}: {
  row: ParityRow;
  open: boolean;
  onToggle: () => void;
}) {
  const detailId = `parity-${row.capability.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={detailId}
        sx={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          gap: { xs: 1, sm: 2 },
          width: '100%',
          px: 2,
          py: 1.25,
          textAlign: 'left',
          alignItems: 'start',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        >
          <ExpandMore
            fontSize="small"
            sx={{
              color: 'text.secondary',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {row.capability}
          </Typography>
        </Stack>
        <Box>
          <Cell side={row.portal} />
        </Box>
        <Box>
          <Cell side={row.aws} />
        </Box>
      </ButtonBase>
      <Collapse in={open} id={detailId}>
        <Typography
          variant="body2"
          sx={{ px: 2, pb: 1.5, pl: { xs: 2, sm: 5 }, color: 'text.secondary', maxWidth: 900 }}
        >
          {row.detail}
        </Typography>
      </Collapse>
    </Box>
  );
}

export function AwsParity({
  rows = PARITY_ROWS,
  initiallyOpen = [],
}: {
  rows?: ParityRow[];
  initiallyOpen?: string[];
}) {
  const [opened, setOpened] = useState(() => new Set(initiallyOpen));
  const toggle = (capability: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (!next.delete(capability)) next.add(capability);
      return next;
    });
  return (
    <Box sx={{ borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
      <Box
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
          variant="overline"
          sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary', pl: 3 }}
        >
          Capability
        </Typography>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Portal
        </Typography>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          AWS today
        </Typography>
      </Box>
      {rows.map((row) => (
        <ParityLine
          key={row.capability}
          row={row}
          open={opened.has(row.capability)}
          onToggle={() => toggle(row.capability)}
        />
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
