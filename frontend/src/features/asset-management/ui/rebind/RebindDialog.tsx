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
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';

import {
  ColumnResolutionTable,
  type RebindMode,
  type RebindSource,
  TargetDatasetPicker,
  useRebindDraft,
} from '@/entities/definition';

import { authoringApi, getApiErrorMessage } from '@/shared/api';
import type { AuthorableAssetType, Proposal } from '@/shared/api/modules/authoring';
import { typography } from '@/shared/design-system/theme';

interface RebindDialogProps {
  open: boolean;
  onClose: () => void;
  assetType: AuthorableAssetType;
  asset: { id: string; name: string } | null;
  /** Called with the written asset after a successful apply. */
  onApplied?: (result: { assetId: string; name: string; mode: RebindMode }) => void;
}

/**
 * Point a dashboard or analysis at different datasets, in place or as a copy.
 *
 * The draft logic (targets, renames, the server dry run, the apply verdict)
 * lives in useRebindDraft and is shared with the Author page; this dialog is
 * the compact, row-menu form of it.
 */
export default function RebindDialog({
  open,
  onClose,
  assetType,
  asset,
  onApplied,
}: RebindDialogProps) {
  const { enqueueSnackbar } = useSnackbar();

  const source = useMemo<RebindSource | null>(
    () => (asset ? { type: assetType, id: asset.id, name: asset.name } : null),
    [assetType, asset]
  );
  const draft = useRebindDraft(source, open);

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const noun = assetType === 'dashboard' ? 'dashboard' : 'analysis';

  /**
   * Ask the planner. Its answer only fills in the same controls a person
   * would use - target, renames, mode, name - so the usual dry run still
   * decides whether apply is allowed.
   */
  const handlePropose = async () => {
    if (!asset || !ask.trim()) {
      return;
    }
    setProposing(true);
    setProposeError(null);
    setProposal(null);
    try {
      const result = await authoringApi.propose(assetType, asset.id, { ask: ask.trim() });
      setProposal(result);
      draft.applyProposal(result);
    } catch (error) {
      setProposeError(getApiErrorMessage(error, 'The planner could not build a proposal'));
    } finally {
      setProposing(false);
    }
  };

  const handleApply = async () => {
    if (!asset) {
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const result = await authoringApi.applyRebind(assetType, asset.id, {
        mode: draft.mode,
        rebinds: draft.rebinds,
        name: draft.name.trim() || undefined,
      });
      enqueueSnackbar(
        draft.mode === 'clone'
          ? `Created ${noun} "${result.name}"`
          : `Updated ${noun} "${result.name}"`,
        { variant: 'success' }
      );
      onApplied?.({ assetId: result.assetId, name: result.name, mode: draft.mode });
      onClose();
    } catch (error) {
      setApplyError(getApiErrorMessage(error, `Failed to update the ${noun}`));
    } finally {
      setApplying(false);
    }
  };

  const busy = applying || proposing;

  return (
    <Dialog open={open} onClose={applying ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Change datasets
        {asset && (
          <Typography variant="body2" color="text.secondary">
            {asset.name}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {draft.loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {draft.loadError && (
          <Alert severity="error">
            <AlertTitle>Cannot read this {noun}</AlertTitle>
            {draft.loadError}
          </Alert>
        )}

        {!draft.loading && !draft.loadError && (
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  label="Or describe what you want"
                  placeholder='e.g. "copy this onto the orders_gold dataset"'
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handlePropose();
                    }
                  }}
                  size="small"
                  fullWidth
                  disabled={busy}
                />
                <Button
                  variant="outlined"
                  onClick={handlePropose}
                  disabled={busy || !ask.trim()}
                  startIcon={proposing ? <CircularProgress size={16} color="inherit" /> : undefined}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Propose
                </Button>
              </Stack>
              {proposeError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {proposeError}
                </Alert>
              )}
              {proposal && (
                <Alert severity={proposal.intent === 'unclear' ? 'warning' : 'info'} sx={{ mt: 1 }}>
                  <AlertTitle>
                    {proposal.intent === 'unclear'
                      ? 'The planner could not turn that into a dataset change'
                      : `Proposal from ${proposal.model.provider}`}
                  </AlertTitle>
                  {proposal.reason}
                  {proposal.unmapped.length > 0 && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Still needs a decision:{' '}
                      {proposal.unmapped.map((u) => `${u.column} (${u.reason})`).join('; ')}
                    </Typography>
                  )}
                </Alert>
              )}
            </Box>

            <Divider />

            <RadioGroup
              row
              value={draft.mode}
              onChange={(e) => draft.setMode(e.target.value as RebindMode)}
            >
              <FormControlLabel
                value="clone"
                control={<Radio size="small" />}
                label={`Create a copy of this ${noun}`}
                disabled={applying}
              />
              <FormControlLabel
                value="update"
                control={<Radio size="small" />}
                label={`Change this ${noun} in place`}
                disabled={applying}
              />
            </RadioGroup>

            <TextField
              label={draft.mode === 'clone' ? 'Name for the copy' : 'Name'}
              value={draft.name}
              onChange={(e) => draft.setName(e.target.value)}
              size="small"
              fullWidth
              disabled={applying}
              helperText={
                draft.mode === 'update' ? 'Leave as is to keep the current name' : undefined
              }
            />

            {draft.datasets.length === 0 && (
              <Alert severity="info">This {noun} declares no datasets.</Alert>
            )}

            {draft.datasets.map((dataset) => {
              const datasetPlan = draft.plan?.datasets.find(
                (d) => d.identifier === dataset.identifier
              );
              const suggestions =
                datasetPlan?.columns.filter((c) => c.status === 'suggested').length ?? 0;
              return (
                <Box
                  key={dataset.identifier}
                  sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: typography.fontWeight.semibold }}
                    >
                      {dataset.identifier}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${dataset.columns.length} column${dataset.columns.length === 1 ? '' : 's'} used`}
                    />
                    {dataset.calculatedFields.length > 0 && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${dataset.calculatedFields.length} calculated`}
                      />
                    )}
                  </Stack>

                  <TargetDatasetPicker
                    value={draft.targets[dataset.identifier] ?? null}
                    onChange={(next) => draft.setTarget(dataset.identifier, next)}
                    currentId={dataset.dataSetId}
                    disabled={applying}
                  />

                  {datasetPlan && (
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {datasetPlan.summary.matched} matched, {datasetPlan.summary.mapped}{' '}
                          renamed, {datasetPlan.summary.suggested} to decide,{' '}
                          {datasetPlan.summary.missing} missing
                        </Typography>
                        {draft.planning && <CircularProgress size={14} />}
                        <Box sx={{ flex: 1 }} />
                        {suggestions > 0 && (
                          <Button
                            size="small"
                            onClick={() => draft.acceptSuggestions(dataset.identifier)}
                            disabled={applying}
                          >
                            Accept {suggestions} suggestion{suggestions === 1 ? '' : 's'}
                          </Button>
                        )}
                      </Stack>
                      <Divider sx={{ mb: 1 }} />
                      <ColumnResolutionTable
                        plan={datasetPlan}
                        columnMap={draft.columnMaps[dataset.identifier] ?? {}}
                        onMap={(from, to) => draft.mapColumn(dataset.identifier, from, to)}
                        disabled={applying}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}

            {draft.planError && <Alert severity="error">{draft.planError}</Alert>}
            {applyError && (
              <Alert severity="error">
                <AlertTitle>QuickSight rejected the change</AlertTitle>
                {applyError}
              </Alert>
            )}

            {draft.mode === 'update' && draft.rebinds.length > 0 && (
              <Alert severity="warning">
                This rewrites the {noun} in place
                {assetType === 'dashboard' ? ' and publishes a new version' : ''}. Everyone who uses
                it will see the new dataset.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={applying}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={!draft.canApply || busy}
          startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {draft.mode === 'clone' ? 'Create copy' : 'Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
