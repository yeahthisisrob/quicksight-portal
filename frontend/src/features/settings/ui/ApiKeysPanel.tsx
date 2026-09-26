/**
 * ApiKeysPanel - credentials for machine callers. A key grants the same
 * access as a signed-in user to every endpoint except this panel. The secret
 * is shown once, at creation; only a label and a prefix are kept.
 */
import { ContentCopy, Delete } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { getApiErrorMessage } from '@/shared/api';
import { type ApiKey, type ApiKeyCreated, settingsApi } from '@/shared/api/modules/settings';
import { Container, EmptyState, StatusIndicator } from '@/shared/design-system';
import ConfirmationDialog from '@/shared/ui/ConfirmationDialog';

const API_KEYS_QUERY_KEY = ['settings', 'api-keys'] as const;
const DATE_FORMAT = 'MMM d, yyyy HH:mm';
const LABEL_WIDTH = 280;
const META_WIDTH = 160;

function KeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (key: ApiKey) => void }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={(theme) => ({
        alignItems: 'center',
        py: 1.25,
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-of-type': { borderBottom: 0 },
      })}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {apiKey.label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          {apiKey.prefix}…
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: META_WIDTH }}>
        Created {format(new Date(apiKey.createdAt), DATE_FORMAT)} by {apiKey.createdBy}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: META_WIDTH }}>
        {apiKey.lastUsedAt
          ? `Last used ${format(new Date(apiKey.lastUsedAt), DATE_FORMAT)}`
          : 'Never used'}
      </Typography>
      <Tooltip title="Revoke">
        <IconButton
          size="small"
          aria-label={`Revoke ${apiKey.label}`}
          onClick={() => onRevoke(apiKey)}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function SecretDialog({
  created,
  onClose,
}: {
  created: ApiKeyCreated | null;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const copy = async () => {
    if (!created) {
      return;
    }
    try {
      await navigator.clipboard.writeText(created.secret);
      enqueueSnackbar('Copied', { variant: 'success' });
    } catch {
      enqueueSnackbar('Could not copy; select the text instead', { variant: 'warning' });
    }
  };
  return (
    <Dialog open={created !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Your new API key</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="warning">
            This is the only time the secret is shown. Store it where the caller will read it, for
            example an environment variable named QSP_API_KEY.
          </Alert>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              value={created?.secret ?? ''}
              size="small"
              fullWidth
              slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace' } } }}
            />
            <Tooltip title="Copy">
              <IconButton aria-label="Copy secret" onClick={() => void copy()}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Send it on every request as{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              Authorization: Bearer {created?.key.prefix}…
            </Box>
            . The API guide in the repo has a ready-made <code>just api</code> recipe.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ApiKeysPanel() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const keys = useQuery({ queryKey: API_KEYS_QUERY_KEY, queryFn: () => settingsApi.listApiKeys() });
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const create = useMutation({
    mutationFn: () => settingsApi.createApiKey(label),
    onSuccess: (result) => {
      setCreated(result);
      setLabel('');
      void queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'Could not create the key'), { variant: 'error' }),
  });
  const revoke = useMutation({
    mutationFn: (key: ApiKey) => settingsApi.revokeApiKey(key.id),
    onSuccess: (_, key) => {
      enqueueSnackbar(`Revoked "${key.label}"`, { variant: 'success' });
      setRevoking(null);
      void queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'Could not revoke the key'), { variant: 'error' }),
  });

  return (
    <Container
      header="API keys"
      description="For a CLI, a script or an agent. A key can call every endpoint a signed-in user can, except this panel."
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            label="Label"
            placeholder="e.g. claude cli"
            size="small"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && label.trim()) {
                create.mutate();
              }
            }}
            sx={{ minWidth: LABEL_WIDTH }}
          />
          <Button
            variant="contained"
            onClick={() => create.mutate()}
            disabled={!label.trim() || create.isPending}
          >
            Create key
          </Button>
        </Stack>

        {keys.isError ? (
          <Alert severity="error">
            {getApiErrorMessage(keys.error, 'Could not list API keys')}
          </Alert>
        ) : keys.isPending ? (
          <StatusIndicator type="in-progress">Loading keys</StatusIndicator>
        ) : keys.data.length === 0 ? (
          <EmptyState
            compact
            title="No API keys yet"
            description="Create one to call the portal from outside the browser."
          />
        ) : (
          <Box>
            {keys.data.map((apiKey) => (
              <KeyRow key={apiKey.id} apiKey={apiKey} onRevoke={setRevoking} />
            ))}
          </Box>
        )}
      </Stack>

      <SecretDialog created={created} onClose={() => setCreated(null)} />
      <ConfirmationDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        title={`Revoke "${revoking?.label ?? ''}"?`}
        message="Anything still using this key will get 401 from its next request. This cannot be undone."
        confirmText="Revoke"
        severity="error"
        loading={revoke.isPending}
      />
    </Container>
  );
}
