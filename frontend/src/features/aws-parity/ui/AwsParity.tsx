/**
 * What the portal adds to QuickSight, set against what AWS offers today.
 *
 * Said openly, the way the SMUS hand-off is: where AWS has (or has
 * announced) the same thing, the row says so and the portal points there
 * when it can do the job. Only what can be checked goes in the AWS column,
 * and the table carries the date it was last checked; a row whose AWS side
 * changes is updated or removed, never left to overstate the portal.
 */
import { OpenInNew } from '@mui/icons-material';
import { Box, Chip, Link, Stack, Typography } from '@mui/material';

type AwsStatus = 'none' | 'announced' | 'partial';

export interface ParityRow {
  capability: string;
  portal: string;
  aws: string;
  status: AwsStatus;
  link?: { label: string; href: string };
}

/** When the AWS column was last checked against AWS's docs and announcements. */
export const PARITY_CHECKED = 'September 2026';

export const PARITY_ROWS: ParityRow[] = [
  {
    capability: 'Context graph',
    portal:
      'Search, lineage and related entities across datasets, dashboards, analyses, calculated fields and SMUS listings, served as an API shaped like AWS Context.',
    aws: 'QuickSight describes one asset at a time and has no lineage API. AWS Context is announced; once it reads QuickSight, agents get these reads there.',
    status: 'announced',
    link: { label: 'AWS Context', href: 'https://aws.amazon.com/context/' },
  },
  {
    capability: 'Generative authoring by API',
    portal:
      'Build and edit dashboards and analyses from a sentence through the API: planned, validated against the datasets and previewed before anything is written.',
    aws: 'Generative authoring in QuickSight lives in the console; it is not in the SDK or the API.',
    status: 'none',
  },
  {
    capability: 'Calculated fields as metadata',
    portal:
      'Every calculated field indexed with its expression, where it is defined and read, and whether it is row-level or computed at query time.',
    aws: 'Calculated fields stay inside dataset and analysis definitions; they are not entries in the Glue Data Catalog or the SMUS catalog.',
    status: 'none',
  },
  {
    capability: 'Dataset to SMUS listing',
    portal:
      'Each dataset matched to the SMUS listing it reads (source table, SQL references, name, lineage), so governed descriptions reach QuickSight.',
    aws: 'A QuickSight dataset does not record which SMUS listing it reads.',
    status: 'none',
  },
  {
    capability: 'Account-wide fixes',
    portal:
      'Playbooks: scope, gates, a dry run per asset, preview, a chosen run that pauses and resumes, and a report.',
    aws: 'Changes are per-asset Update calls; there is no preview or dry run across assets.',
    status: 'none',
  },
  {
    capability: 'Refactoring calculated fields',
    portal:
      'Rename, drop unused, or replace with a governed column everywhere they are read; a dataset field renamed by moving each reader first.',
    aws: 'Edited one asset at a time in the console; renaming a dataset field breaks what reads it.',
    status: 'none',
  },
  {
    capability: 'Restoring deleted assets',
    portal:
      'Every dashboard, analysis and dataset archived as exported, and restorable from the Studio.',
    aws: 'RestoreAnalysis brings back an analysis within its recovery window; dashboards and datasets have no restore.',
    status: 'partial',
    link: {
      label: 'RestoreAnalysis',
      href: 'https://docs.aws.amazon.com/quicksight/latest/APIReference/API_RestoreAnalysis.html',
    },
  },
];

const STATUS: Record<AwsStatus, { label: string; color: 'default' | 'info' | 'warning' }> = {
  none: { label: 'Not in AWS', color: 'default' },
  announced: { label: 'Announced', color: 'info' },
  partial: { label: 'Partly', color: 'warning' },
};

export function AwsParity({ rows = PARITY_ROWS }: { rows?: ParityRow[] }) {
  return (
    <Box sx={{ borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
      <Box component="dl" sx={{ m: 0 }}>
        {rows.map((row) => (
          <Box
            key={row.capability}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '200px 1fr 1fr' },
              gap: { xs: 0.75, md: 2.5 },
              px: 2.5,
              py: 1.75,
              '&:not(:first-of-type)': { borderTop: 1, borderColor: 'divider' },
            }}
          >
            <Box component="dt" sx={{ m: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {row.capability}
              </Typography>
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Portal
              </Typography>
              <Typography variant="body2">{row.portal}</Typography>
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  AWS today
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={STATUS[row.status].label}
                  color={STATUS[row.status].color}
                  sx={{ height: 20 }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                {row.aws}
                {row.link && (
                  <>
                    {' '}
                    <Link
                      href={row.link.href}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                    >
                      {row.link.label}
                      <OpenInNew sx={{ fontSize: 14 }} />
                    </Link>
                  </>
                )}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
