/**
 * A legacy dataset moved to the new data prep experience. QuickSight has no
 * in-place upgrade, so the move is a twin: the preview says what it carries,
 * what it leaves behind, who reads the original and whether those readers
 * will be repointed; the migration writes exactly that and opens the twin.
 */
import { Upgrade } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { authoringApi, getApiErrorMessage } from '@/shared/api';
import { announceAssetChanges } from '@/shared/lib/assetChanges';

import { Panel } from '../primitives/Panel';

function Words({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {items.map((item) => (
          <li key={item}>
            <Typography variant="body2">{item}</Typography>
          </li>
        ))}
      </Box>
    </Box>
  );
}

export function MigrationPanel({
  datasetId,
  experience,
  onMigrated,
}: {
  datasetId: string;
  experience: string | null;
  /** Open the twin here. */
  onMigrated: (twin: { id: string; name: string }) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [rebind, setRebind] = useState(true);
  const preview = useQuery({
    queryKey: ['dataset-migration-preview', datasetId],
    queryFn: () => authoringApi.previewDatasetMigration(datasetId),
    enabled: open,
  });
  const migrate = useMutation({
    mutationFn: () => authoringApi.migrateDataset(datasetId, { rebindReaders: rebind }),
    onSuccess: (result) => {
      const failed = result.rebound.filter((r) => !r.ok);
      enqueueSnackbar(
        failed.length
          ? `Migrated to ${result.name}; ${failed.length} reader${failed.length === 1 ? '' : 's'} could not be repointed`
          : `Migrated to ${result.name}`,
        { variant: failed.length ? 'warning' : 'success' }
      );
      announceAssetChanges(['dataset', 'dashboard', 'analysis']);
      setOpen(false);
      onMigrated({ id: result.assetId, name: result.name });
    },
  });
  if (experience !== 'legacy') return null;
  const data = preview.data;
  const readers = data?.readers ?? [];
  const canMigrate = Boolean(data) && data!.refused.length === 0;

  return (
    <Panel
      title="Legacy data prep"
      description="Built in the legacy data prep experience, which QuickSight is retiring: it cannot be opened in the new data prep or be the parent of a new dataset. Moving it creates a twin in the new experience, with the same tables, steps, audience, tags, folders and schedules, and repoints what reads it."
    >
      <Button variant="outlined" startIcon={<Upgrade />} onClick={() => setOpen(true)}>
        Move to the new data prep
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move to the new data prep experience</DialogTitle>
        <DialogContent>
          {preview.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : preview.error ? (
            <Alert severity="error">
              {getApiErrorMessage(preview.error, 'The migration could not be previewed')}
            </Alert>
          ) : data ? (
            <Stack spacing={2}>
              {data.refused.length > 0 && (
                <Alert severity="error">
                  <AlertTitle>Cannot be moved as it is</AlertTitle>
                  {data.refused.join(' ')}
                </Alert>
              )}
              <Words title="The twin carries" items={data.carried} />
              <Words title="Left behind" items={data.dropped} />
              {data.warnings.length > 0 && <Words title="Warnings" items={data.warnings} />}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {readers.length === 0
                    ? 'Nothing reads the original.'
                    : `${readers.length} dashboard${readers.length === 1 ? '' : 's'} and analyses read the original`}
                </Typography>
                {readers.length > 0 && (
                  <>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {readers.map((r) => (
                        <li key={`${r.assetType}:${r.assetId}`}>
                          <Typography variant="body2">
                            {r.name}{' '}
                            <Typography component="span" variant="caption" color="text.secondary">
                              {r.assetType}
                            </Typography>
                          </Typography>
                        </li>
                      ))}
                    </Box>
                    <FormControlLabel
                      control={
                        <Checkbox checked={rebind} onChange={(e) => setRebind(e.target.checked)} />
                      }
                      label="Repoint them at the twin (same columns, nothing else changes)"
                    />
                  </>
                )}
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                The original stays as it is; delete it from Assets once nothing reads it.
              </Typography>
              {migrate.error && (
                <Alert severity="error">
                  <AlertTitle>QuickSight refused the twin</AlertTitle>
                  {getApiErrorMessage(migrate.error, 'The migration failed')}
                </Alert>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={migrate.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => migrate.mutate()}
            disabled={!canMigrate || migrate.isPending}
            startIcon={
              migrate.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            {migrate.isPending ? 'Moving…' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}
