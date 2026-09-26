/**
 * Bringing an archived dataset or data source back. Neither has a canvas to
 * fix, so the panel is its checks: the archived definition is whole, the id
 * is free, what it reads still exists, it needs no password the archive
 * cannot hold. A blocking check that fails stops the restore; the rest say
 * what will differ. Dashboards and analyses restore in the Editor instead.
 */
import {
  ArrowBack,
  CheckCircleOutlined,
  ErrorOutlined,
  OpenInNew,
  RestoreOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { components } from '@shared/generated/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { assetsApi, getApiErrorMessage } from '@/shared/api';
import { announceAssetChanges } from '@/shared/lib/assetChanges';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';
import { useDebounce } from '@/shared/lib/useDebounce';

import type { ArchivedPick } from '../../model/useStudio';
import { Panel } from '../primitives/Panel';

type Preview = components['schemas']['SourceRestorePreview'];
type Check = Preview['checks'][number];
type Result = components['schemas']['SourceRestoreResult'];
type DataType = Preview['assetType'];

const ID_DEBOUNCE_MS = 400;

const NOUN: Record<DataType, string> = { dataset: 'dataset', datasource: 'data source' };

function CheckRow({ check }: { check: Check }) {
  const icon = check.ok ? (
    <CheckCircleOutlined color="success" fontSize="small" />
  ) : check.blocking ? (
    <ErrorOutlined color="error" fontSize="small" />
  ) : (
    <WarningAmberOutlined color="warning" fontSize="small" />
  );
  return (
    <ListItem disableGutters sx={{ alignItems: 'flex-start' }}>
      <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>{icon}</ListItemIcon>
      <ListItemText
        primary={check.label}
        secondary={check.detail}
        slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }}
      />
    </ListItem>
  );
}

function Restored({ result, onDone }: { result: Result; onDone: () => void }) {
  const consoleUrl = getQuickSightConsoleUrl(result.assetType, result.assetId);
  return (
    <Stack spacing={2}>
      <Alert severity="success">
        {NOUN[result.assetType]} "{result.name}" is back, as <code>{result.assetId}</code>.
      </Alert>
      {result.warnings.length > 0 && (
        <Alert severity="warning">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {result.warnings.map((warning) => (
              <li key={warning}>
                <Typography variant="body2">{warning}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
      <Stack direction="row" spacing={1}>
        {consoleUrl && (
          <Button
            variant="outlined"
            endIcon={<OpenInNew />}
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in QuickSight
          </Button>
        )}
        <Button onClick={onDone}>Back to the archive</Button>
      </Stack>
    </Stack>
  );
}

export function SourceRestorePanel({
  pick,
  onClose,
}: {
  pick: ArchivedPick & { type: DataType };
  onClose: () => void;
}) {
  const [newId, setNewId] = useState('');
  const [name, setName] = useState('');
  const checkedId = useDebounce(newId.trim(), ID_DEBOUNCE_MS);
  const noun = NOUN[pick.type];

  const preview = useQuery({
    queryKey: ['source-restore-preview', pick.type, pick.id, checkedId],
    queryFn: () => assetsApi.previewSourceRestore(pick.type, pick.id, checkedId || undefined),
  });
  const restore = useMutation({
    mutationFn: () =>
      assetsApi.restoreSource(pick.type, pick.id, {
        ...(newId.trim() ? { newAssetId: newId.trim() } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: () => announceAssetChanges([pick.type]),
  });

  const data = preview.data as Preview | undefined;
  const pending = checkedId !== newId.trim();
  const ready = Boolean(data?.canRestore) && !pending && !preview.isFetching;

  return (
    <Panel
      title={`Restore ${noun} "${data?.name ?? pick.name}"`}
      description={`It comes back as a new ${noun} with its archived definition, audience${pick.type === 'dataset' ? ', tags and refresh schedules' : ' and tags'}.`}
      actions={
        <Button size="small" startIcon={<ArrowBack />} onClick={onClose}>
          Archive
        </Button>
      }
    >
      {restore.data ? (
        <Restored result={restore.data as Result} onDone={onClose} />
      ) : (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Id"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder={pick.id}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Its archived id, unless QuickSight still holds that one"
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={data?.name ?? pick.name}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
          </Stack>

          {preview.isLoading ? (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={20} />
            </Box>
          ) : preview.error ? (
            <Alert severity="error">
              {getApiErrorMessage(preview.error, 'The restore could not be checked')}
            </Alert>
          ) : (
            <List dense disablePadding data-testid="restore-checks">
              {data?.checks.map((check) => (
                <CheckRow key={check.label} check={check} />
              ))}
            </List>
          )}

          {data && !data.canRestore && (
            <Alert severity="error">
              Fix what is marked above first: a {noun} comes back whole, or not at all.
            </Alert>
          )}
          {restore.error && (
            <Alert severity="error">{getApiErrorMessage(restore.error, 'Restore failed')}</Alert>
          )}

          <Box>
            <Button
              variant="contained"
              startIcon={
                restore.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RestoreOutlined />
                )
              }
              disabled={!ready || restore.isPending}
              onClick={() => restore.mutate()}
            >
              Restore
            </Button>
          </Box>
        </Stack>
      )}
    </Panel>
  );
}
