/**
 * What a change will build, drawn before anything is prepared: where the
 * data comes from (SMUS listings, when there are any) to the datasets
 * (existing, or new and through which data source) to the analysis or
 * dashboard (new, edited, or read as it is). Each node says whether it
 * exists already, so "use the governed dataset" is visibly not "make one".
 */
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Chip, Stack, Typography } from '@mui/material';

import type { AssistantArtifact } from '@/shared/api/modules/assistant';

type Status = 'existing' | 'new' | 'edited';

const STATUS_LABEL: Record<Status, string> = {
  existing: 'Existing',
  new: 'New',
  edited: 'Edited',
};

const STATUS_COLOR: Record<Status, 'default' | 'success' | 'warning'> = {
  existing: 'default',
  new: 'success',
  edited: 'warning',
};

function Node({ title, detail, status }: { title: string; detail?: string; status?: Status }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor:
          status === 'new' ? 'success.main' : status === 'edited' ? 'warning.main' : 'divider',
        borderStyle: status === 'new' ? 'dashed' : 'solid',
        borderRadius: 1.5,
        px: 1.25,
        py: 0.75,
        minWidth: 0,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {status && (
          <Chip
            size="small"
            label={STATUS_LABEL[status]}
            color={STATUS_COLOR[status]}
            variant="outlined"
          />
        )}
      </Stack>
      {detail && (
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {detail}
        </Typography>
      )}
    </Box>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.75} sx={{ flex: '1 1 0', minWidth: 160 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function Arrow() {
  return (
    <Box
      aria-hidden
      sx={{
        display: { xs: 'none', sm: 'flex' },
        alignItems: 'center',
        pt: 3,
        color: 'text.disabled',
      }}
    >
      <ArrowForwardIcon fontSize="small" />
    </Box>
  );
}

export function PlanLineage({ plan }: { plan: AssistantArtifact }) {
  const sources = plan.sources ?? [];
  const datasets = plan.datasets ?? [];
  const asset = plan.asset;
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
    >
      {sources.length > 0 && (
        <>
          <Column label="SMUS catalog">
            {sources.map((s) => (
              <Node
                key={`${s.project ?? ''}/${s.listing}`}
                title={s.listing}
                detail={
                  [s.project && `project ${s.project}`, s.table].filter(Boolean).join(' · ') ||
                  undefined
                }
              />
            ))}
          </Column>
          <Arrow />
        </>
      )}
      <Column label="Datasets">
        {datasets.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            The asset's current datasets
          </Typography>
        ) : (
          datasets.map((d) => (
            <Node
              key={d.id ?? d.name}
              title={d.name}
              status={d.status}
              detail={
                d.status === 'new'
                  ? d.dataSource
                    ? `through ${d.dataSource}`
                    : 'created on Run'
                  : d.id
              }
            />
          ))
        )}
      </Column>
      {asset && (
        <>
          <Arrow />
          <Column label={asset.kind === 'dashboard' ? 'Dashboard' : 'Analysis'}>
            <Node title={asset.name} status={asset.status} detail={asset.id} />
          </Column>
        </>
      )}
    </Stack>
  );
}
