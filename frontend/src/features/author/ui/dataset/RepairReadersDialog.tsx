/**
 * Every dashboard and analysis on a dataset, repaired in place in one pass:
 * the preview lists each reader with what is wrong and the fix the plan
 * proposes; the repair applies exactly those fixes and says what happened
 * to each. A reader that needs a person's choice is left alone and named.
 */
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { authoringApi, getApiErrorMessage } from '@/shared/api';
import type { DatasetReadersRepairResult } from '@/shared/api/modules/authoring';
import { announceAssetChanges } from '@/shared/lib/assetChanges';

type Outcome = DatasetReadersRepairResult['results'][number]['outcome'];

const OUTCOME: Record<
  Outcome,
  { label: string; color: 'success' | 'default' | 'warning' | 'error' }
> = {
  repaired: { label: 'Repaired', color: 'success' },
  clean: { label: 'Nothing to fix', color: 'default' },
  needsChoice: { label: 'Needs a choice', color: 'warning' },
  failed: { label: 'Refused', color: 'error' },
};

export function RepairReadersDialog({
  datasetId,
  open,
  onClose,
}: {
  datasetId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const preview = useQuery({
    queryKey: ['dataset-readers-repair', datasetId],
    queryFn: () => authoringApi.previewReadersRepair(datasetId),
    enabled: open,
  });
  const repair = useMutation({
    mutationFn: () => authoringApi.repairReaders(datasetId),
    onSuccess: (result) => {
      const repaired = result.results.filter((r) => r.outcome === 'repaired').length;
      const failed = result.results.filter((r) => r.outcome === 'failed').length;
      enqueueSnackbar(`${repaired} repaired${failed ? `, ${failed} refused` : ''}`, {
        variant: failed ? 'warning' : 'success',
      });
      announceAssetChanges(['dashboard', 'analysis']);
    },
  });
  const data = preview.data;
  type Result = DatasetReadersRepairResult['results'][number];
  const results = new Map<string, Result>(
    (repair.data?.results ?? []).map((r) => [`${r.assetType}:${r.assetId}`, r])
  );

  return (
    <Dialog open={open} onClose={repair.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Repair what reads {data?.name ?? 'it'}</DialogTitle>
      <DialogContent>
        {preview.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : preview.error ? (
          <Alert severity="error">
            {getApiErrorMessage(preview.error, 'The readers could not be checked')}
          </Alert>
        ) : data ? (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {data.readers.length === 0
                ? 'Nothing reads this dataset.'
                : data.toRepair === 0
                  ? 'Every dashboard and analysis on it is fine, or needs a choice only a person can make.'
                  : `${data.toRepair} of ${data.readers.length} can be repaired in place. Each is rewritten once; nothing is copied.`}
            </Typography>
            {data.readers.map((reader) => {
              const key = `${reader.assetType}:${reader.assetId}`;
              const result = results.get(key);
              const { fixable, needsChoice, unfixable } = reader.plan.summary;
              return (
                <Box key={key} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                      {reader.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {reader.assetType}
                    </Typography>
                    {result ? (
                      <Chip size="small" {...OUTCOME[result.outcome]} />
                    ) : reader.plan.issues.length === 0 ? (
                      <Chip size="small" label="Nothing to fix" />
                    ) : (
                      <Chip
                        size="small"
                        color={needsChoice || unfixable ? 'warning' : 'info'}
                        label={`${fixable} fix${fixable === 1 ? '' : 'es'}${needsChoice ? `, ${needsChoice} to choose` : ''}${unfixable ? `, ${unfixable} unfixable` : ''}`}
                      />
                    )}
                  </Stack>
                  {reader.plan.issues.length > 0 && (
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                      {reader.plan.issues.map((issue) => (
                        <li key={issue.id}>
                          <Typography variant="caption">{issue.message}</Typography>
                        </li>
                      ))}
                    </Box>
                  )}
                  {result?.error && (
                    <Typography variant="caption" color="error">
                      {result.error}
                    </Typography>
                  )}
                </Box>
              );
            })}
            {data.unreadable.length > 0 && (
              <Alert severity="warning">
                Could not read {data.unreadable.map((u) => u.name).join(', ')}.
              </Alert>
            )}
            {repair.error && (
              <Alert severity="error">
                <AlertTitle>The repair failed</AlertTitle>
                {getApiErrorMessage(repair.error, 'The readers could not be repaired')}
              </Alert>
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={repair.isPending}>
          {repair.data ? 'Close' : 'Cancel'}
        </Button>
        {!repair.data && (
          <Button
            variant="contained"
            onClick={() => repair.mutate()}
            disabled={!data || data.toRepair === 0 || repair.isPending}
            startIcon={
              repair.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            {repair.isPending ? 'Repairing…' : 'Repair'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
