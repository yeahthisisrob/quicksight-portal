/**
 * Operations › History: what changed lately across the account, newest
 * first, with who changed it and what changed in words. A row opens that
 * asset's full history.
 */
import {
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { VersionHistoryDialog, versionMoment } from '@/entities/asset-version';

import { getApiErrorMessage, historyApi } from '@/shared/api';
import type { AssetVersion } from '@/shared/api/modules/history';
import { Container, EmptyState, StatStrip } from '@/shared/design-system';
import { TypedChip } from '@/shared/ui';

const RECENT = 100;
const SKELETON_ROWS = 6;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Counts({ versions }: { versions: AssetVersion[] }) {
  const since = Date.now() - WEEK_MS;
  const assets = new Set(versions.map((v) => `${v.assetType}:${v.assetId}`)).size;
  const thisWeek = versions.filter((v) => new Date(v.at).getTime() >= since).length;
  const outside = versions.filter((v) => v.source === 'export').length;
  const byPeople = versions.filter((v) => v.source !== 'export').length;
  return (
    <StatStrip
      ariaLabel="History counts"
      items={[
        { label: 'Changes listed', value: versions.length, hint: `the latest ${RECENT}` },
        { label: 'Assets changed', value: assets },
        { label: 'This week', value: thisWeek },
        { label: 'Through the portal', value: byPeople, hint: 'people, rollbacks' },
        { label: 'Outside the portal', value: outside, hint: 'seen by the export' },
      ]}
    />
  );
}

export function RecentChangesPanel() {
  const recent = useQuery({
    queryKey: ['history-recent', RECENT],
    queryFn: () => historyApi.recent(RECENT),
  });
  const [open, setOpen] = useState<AssetVersion | null>(null);
  const versions = recent.data ?? [];

  return (
    <Stack spacing={2}>
      {recent.data ? (
        <Counts versions={versions} />
      ) : (
        <Skeleton variant="rectangular" height={72} />
      )}
      <Container
        header="What changed lately"
        description="Every version kept across the account, newest first. A version is kept whenever an export, a refresh or a portal write finds a definition changed."
        disableContentPadding
      >
        {recent.isError ? (
          <Typography variant="body2" color="error" sx={{ p: 2 }}>
            {getApiErrorMessage(recent.error, 'History could not be read')}
          </Typography>
        ) : recent.isPending ? (
          <Stack spacing={1} sx={{ p: 2 }}>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <Skeleton key={i} variant="text" />
            ))}
          </Stack>
        ) : versions.length === 0 ? (
          <EmptyState
            compact
            title="Nothing kept yet"
            description="Run an export: the first version of every dashboard, analysis and dataset is kept then, and every change after that."
          />
        ) : (
          <List dense disablePadding>
            {versions.map((version) => (
              <ListItemButton
                key={`${version.assetType}:${version.assetId}:${version.versionId}`}
                onClick={() => setOpen(version)}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <TypedChip
                        type={
                          version.assetType.toUpperCase() as 'DASHBOARD' | 'ANALYSIS' | 'DATASET'
                        }
                        size="small"
                        showIcon={false}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {version.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {versionMoment(version.at)}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', mt: 0.25, minWidth: 0 }}
                    >
                      <Chip
                        size="small"
                        variant={version.source === 'export' ? 'outlined' : 'filled'}
                        color={
                          version.source === 'rollback'
                            ? 'warning'
                            : version.source === 'portal'
                              ? 'primary'
                              : 'default'
                        }
                        label={version.by}
                        sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                      />
                      <Typography variant="body2" noWrap>
                        {version.summary}
                      </Typography>
                    </Stack>
                  }
                  slotProps={{ secondary: { component: 'div' } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Container>
      {open && (
        <VersionHistoryDialog
          open
          onClose={() => setOpen(null)}
          assetType={open.assetType}
          assetId={open.assetId}
          assetName={open.name}
        />
      )}
    </Stack>
  );
}
