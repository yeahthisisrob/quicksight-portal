/**
 * The versions an asset has been through: the list (when, who, what
 * changed), one version opened beside it with what changed up to it (from
 * the version before, another, or to what is live now), and a way to put it
 * back. One component for the Studio's History panel (stacked) and the
 * dialog the asset rows open (split).
 */
import { History as HistoryIcon, Restore as RestoreIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import { getApiErrorMessage, historyApi } from '@/shared/api';
import type {
  AssetVersion,
  RollbackResult,
  VersionedAssetType,
} from '@/shared/api/modules/history';
import { EmptyState, pal, StatusIndicator } from '@/shared/design-system';
import { announceAssetChanges } from '@/shared/lib/assetChanges';
import ConfirmationDialog from '@/shared/ui/ConfirmationDialog';

import { versionActor, versionAge, versionMoment, versionSourceWords } from '../lib/versionWords';
import { VersionDiffView } from './VersionDiffView';

export interface VersionHistoryProps {
  assetType: VersionedAssetType;
  assetId: string;
  assetName: string;
  /** Side by side (a dialog) or one under the other (a panel). */
  layout?: 'split' | 'stacked';
  /** After a version was put back: the caller reloads what it shows. */
  onRestored?: (result: RollbackResult) => void;
}

const SKELETON_ROWS = 4;
const LIST_WIDTH = 320;

/** The react-query keys this entity owns; the Studio invalidates them after its own writes. */
const versionQueryKeys = {
  list: (assetType: string, assetId: string) => ['asset-versions', assetType, assetId] as const,
};

function ActorChip({ version }: { version: AssetVersion }) {
  const actor = versionActor(version);
  return (
    <Chip
      size="small"
      variant={actor.portal ? 'filled' : 'outlined'}
      color={version.source === 'rollback' ? 'warning' : actor.portal ? 'primary' : 'default'}
      label={actor.label}
      sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
    />
  );
}

function VersionRow({
  version,
  selected,
  latest,
  onSelect,
}: {
  version: AssetVersion;
  selected: boolean;
  latest: boolean;
  onSelect: () => void;
}) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onSelect}
      alignItems="flex-start"
      sx={{ borderRadius: 1 }}
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {versionMoment(version.at)}
            </Typography>
            {latest && <Chip size="small" label="latest" sx={{ height: 18 }} />}
            {typeof version.quickSightVersion === 'number' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                v{version.quickSightVersion}
              </Typography>
            )}
          </Stack>
        }
        secondary={
          <Stack spacing={0.5} sx={{ mt: 0.25 }}>
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              {version.summary}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <ActorChip version={version} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {versionAge(version.at)}
              </Typography>
            </Stack>
          </Stack>
        }
        slotProps={{ secondary: { component: 'div' } }}
      />
    </ListItemButton>
  );
}

export function VersionHistory({
  assetType,
  assetId,
  assetName,
  layout = 'split',
  onRestored,
}: VersionHistoryProps) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const versions = useQuery({
    queryKey: versionQueryKeys.list(assetType, assetId),
    queryFn: () => historyApi.list(assetType, assetId),
  });
  const list = versions.data ?? [];
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [against, setAgainst] = useState<string>('previous');
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // The newest version opens first; a list that changed under the selection falls back to it.
  useEffect(() => {
    if (list.length > 0 && !list.some((v) => v.versionId === selectedId)) {
      setSelectedId(list[0]?.versionId);
      setAgainst('previous');
    }
  }, [list, selectedId]);

  const selected = list.find((v) => v.versionId === selectedId);
  const diff = useQuery({
    queryKey: ['asset-version-diff', assetType, assetId, selectedId, against],
    queryFn: () =>
      historyApi.diff(assetType, assetId, selectedId as string, { against, definitions: true }),
    enabled: Boolean(selectedId),
  });

  const restore = async () => {
    if (!selected) return;
    setConfirming(false);
    setRestoring('Starting');
    setRestoreError(null);
    try {
      const result = await historyApi.rollback(
        assetType,
        assetId,
        selected.versionId,
        setRestoring
      );
      enqueueSnackbar(`Put back the version of ${versionMoment(selected.at)} of "${result.name}"`, {
        variant: 'success',
      });
      announceAssetChanges([assetType]);
      await queryClient.invalidateQueries({ queryKey: versionQueryKeys.list(assetType, assetId) });
      await queryClient.invalidateQueries({ queryKey: ['asset-json', assetType, assetId] });
      onRestored?.(result);
    } catch (error) {
      setRestoreError(getApiErrorMessage(error, 'The version could not be put back'));
    } finally {
      setRestoring(null);
    }
  };

  if (versions.isError) {
    return (
      <Alert severity="error">
        {getApiErrorMessage(versions.error, 'History could not be read')}
      </Alert>
    );
  }
  if (versions.isPending) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Skeleton key={i} variant="rectangular" height={56} />
        ))}
      </Stack>
    );
  }
  if (list.length === 0) {
    return (
      <EmptyState
        compact
        icon={<HistoryIcon />}
        title="No versions yet"
        description="A version is kept the first time an export or a refresh reads this asset, and whenever its definition changes after that."
      />
    );
  }

  const fromLabel =
    against === 'live'
      ? selected
        ? versionMoment(selected.at)
        : ''
      : diff.data?.from
        ? versionMoment(diff.data.from.at)
        : 'Nothing';
  const toLabel = against === 'live' ? 'Live now' : selected ? versionMoment(selected.at) : '';
  const others = list.filter((v) => v.versionId !== selectedId);

  const detail = selected && (
    <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Version of {versionMoment(selected.at)}
          </Typography>
          <ActorChip version={selected} />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {versionSourceWords(selected)}
          {selected.action ? ` · ${selected.action}` : ''} · {Math.round(selected.size / 1024)} KB
        </Typography>
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="version-against">Compare with</InputLabel>
          <Select
            labelId="version-against"
            label="Compare with"
            value={against}
            onChange={(e) => setAgainst(e.target.value)}
          >
            <MenuItem value="previous">The version before</MenuItem>
            <MenuItem value="live">What is live now</MenuItem>
            {others.map((v) => (
              <MenuItem key={v.versionId} value={v.versionId}>
                {versionMoment(v.at)} · {v.summary}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Chip
          icon={<RestoreIcon />}
          label="Put this version back"
          color="primary"
          variant="outlined"
          clickable
          disabled={restoring !== null}
          onClick={() => setConfirming(true)}
        />
      </Stack>
      {restoring && (
        <Alert severity="info" icon={<CircularProgress size={18} />}>
          {restoring}
        </Alert>
      )}
      {restoreError && <Alert severity="error">{restoreError}</Alert>}
      {diff.isError ? (
        <Alert severity="warning">
          {getApiErrorMessage(diff.error, 'The versions could not be compared')}
        </Alert>
      ) : diff.data ? (
        <VersionDiffView diff={diff.data} fromLabel={fromLabel} toLabel={toLabel} />
      ) : (
        <Skeleton variant="rectangular" height={120} />
      )}
    </Stack>
  );

  const rows = (
    <List dense disablePadding sx={{ minWidth: 0 }}>
      {list.map((version, index) => (
        <VersionRow
          key={version.versionId}
          version={version}
          selected={version.versionId === selectedId}
          latest={index === 0}
          onSelect={() => {
            setSelectedId(version.versionId);
            setAgainst('previous');
          }}
        />
      ))}
    </List>
  );

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <StatusIndicator type="info" size="small">
          {list.length} version{list.length === 1 ? '' : 's'} kept
        </StatusIndicator>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          since {versionMoment(list[list.length - 1]?.at ?? '')}
        </Typography>
      </Stack>
      {layout === 'split' ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: 'flex-start' }}
        >
          <Box
            sx={(theme) => ({
              width: { md: LIST_WIDTH },
              flexShrink: 0,
              alignSelf: 'stretch',
              borderRight: { md: `1px solid ${pal(theme).line.divider}` },
              pr: { md: 1.5 },
              maxHeight: { md: 560 },
              overflowY: 'auto',
            })}
          >
            {rows}
          </Box>
          {detail}
        </Stack>
      ) : (
        <Stack spacing={2}>
          {rows}
          {detail}
        </Stack>
      )}
      <ConfirmationDialog
        open={confirming}
        title={`Put back the version of ${selected ? versionMoment(selected.at) : ''}?`}
        message={`"${assetName}" is written over with that definition, as a new version. Nothing is lost: today's definition stays in the history.`}
        confirmText="Put it back"
        severity="info"
        onConfirm={() => void restore()}
        onClose={() => setConfirming(false)}
      />
    </Box>
  );
}
