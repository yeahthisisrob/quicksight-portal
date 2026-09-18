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
import { useCallback, useEffect, useMemo, useState } from 'react';

import { authoringApi, getApiErrorMessage } from '@/shared/api';
import type {
  ApplyRebindRequest,
  AuthorableAssetType,
  DefinitionDataset,
  Proposal,
  RebindPlan,
  RebindRequest,
} from '@/shared/api/modules/authoring';
import { colors, typography } from '@/shared/design-system/theme';
import { useDebounce } from '@/shared/lib/useDebounce';

import { ColumnResolutionTable } from './ColumnResolutionTable';
import { type DatasetOption, TargetDatasetPicker } from './TargetDatasetPicker';

interface RebindDialogProps {
  open: boolean;
  onClose: () => void;
  assetType: AuthorableAssetType;
  asset: { id: string; name: string } | null;
  /** Called with the written asset after a successful apply. */
  onApplied?: (result: { assetId: string; name: string; mode: ApplyRebindRequest['mode'] }) => void;
}

const PLAN_DEBOUNCE_MS = 400;

/**
 * Point a dashboard or analysis at different datasets, in place or as a copy.
 *
 * The flow is plan-then-apply. Every change to a target or a column rename
 * re-runs the server's dry run, and the apply button only lights up when the
 * server says every column resolves. Nothing here decides a rename on its own:
 * a near match is shown as a suggestion until someone picks it.
 */
export default function RebindDialog({
  open,
  onClose,
  assetType,
  asset,
  onApplied,
}: RebindDialogProps) {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DefinitionDataset[]>([]);

  const [targets, setTargets] = useState<Record<string, DatasetOption | null>>({});
  const [columnMaps, setColumnMaps] = useState<Record<string, Record<string, string>>>({});

  const [plan, setPlan] = useState<RebindPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [mode, setMode] = useState<ApplyRebindRequest['mode']>('clone');
  const [name, setName] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [ask, setAsk] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const noun = assetType === 'dashboard' ? 'dashboard' : 'analysis';

  const load = useCallback(async () => {
    if (!asset) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    setPlan(null);
    setPlanError(null);
    setApplyError(null);
    setTargets({});
    setColumnMaps({});
    setMode('clone');
    setName(`${asset.name} (copy)`);
    setAsk('');
    setProposal(null);
    setProposeError(null);
    try {
      const result = await authoringApi.getDatasets(assetType, asset.id);
      setDatasets(result.datasets);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, `Failed to read the ${noun}`));
    } finally {
      setLoading(false);
    }
  }, [asset, assetType, noun]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const rebinds = useMemo<RebindRequest[]>(
    () =>
      datasets
        .filter((d) => targets[d.identifier])
        .map((d) => ({
          identifier: d.identifier,
          targetDataSetId: targets[d.identifier]!.id,
          columnMap: columnMaps[d.identifier],
        })),
    [datasets, targets, columnMaps]
  );
  const rebindKey = useDebounce(JSON.stringify(rebinds), PLAN_DEBOUNCE_MS);

  useEffect(() => {
    if (!open || !asset) {
      return;
    }
    const current = JSON.parse(rebindKey) as RebindRequest[];
    if (current.length === 0) {
      setPlan(null);
      setPlanError(null);
      return;
    }
    let cancelled = false;
    setPlanning(true);
    setPlanError(null);
    authoringApi
      .planRebind(assetType, asset.id, current)
      .then((next) => {
        if (!cancelled) {
          setPlan(next);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPlan(null);
          setPlanError(getApiErrorMessage(error, 'Could not check the new dataset'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlanning(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rebindKey, open, asset, assetType]);

  const setTarget = (identifier: string, target: DatasetOption | null) => {
    setTargets((prev) => ({ ...prev, [identifier]: target }));
    // A different target dataset makes the old renames meaningless.
    setColumnMaps((prev) => ({ ...prev, [identifier]: {} }));
  };

  const mapColumn = (identifier: string, source: string, target: string | null) => {
    setColumnMaps((prev) => {
      const next = { ...(prev[identifier] ?? {}) };
      if (target) {
        next[source] = target;
      } else {
        delete next[source];
      }
      return { ...prev, [identifier]: next };
    });
  };

  const acceptSuggestions = (identifier: string) => {
    const dataset = plan?.datasets.find((d) => d.identifier === identifier);
    if (!dataset) {
      return;
    }
    setColumnMaps((prev) => {
      const next = { ...(prev[identifier] ?? {}) };
      for (const column of dataset.columns) {
        if (column.status === 'suggested' && column.suggestion) {
          next[column.name] = column.suggestion;
        }
      }
      return { ...prev, [identifier]: next };
    });
  };

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
      if (result.intent === 'unclear' || !result.plan) {
        return;
      }
      setMode(result.mode);
      if (result.name) {
        setName(result.name);
      }
      setTargets(
        Object.fromEntries(
          result.plan.datasets.map((d) => [
            d.identifier,
            { id: d.target.dataSetId, name: d.target.name },
          ])
        )
      );
      setColumnMaps(
        Object.fromEntries(result.rebinds.map((r) => [r.identifier, r.columnMap ?? {}]))
      );
    } catch (error) {
      setProposeError(getApiErrorMessage(error, 'The planner could not build a proposal'));
    } finally {
      setProposing(false);
    }
  };

  const trimmedName = name.trim();
  const renameOnly = rebinds.length === 0;
  const canApply =
    !applying &&
    !planning &&
    (renameOnly
      ? mode === 'clone'
        ? trimmedName.length > 0
        : trimmedName.length > 0 && trimmedName !== asset?.name
      : Boolean(plan?.canApply) && (mode === 'update' || trimmedName.length > 0));

  const handleApply = async () => {
    if (!asset) {
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const result = await authoringApi.applyRebind(assetType, asset.id, {
        mode,
        rebinds,
        name: trimmedName || undefined,
      });
      enqueueSnackbar(
        mode === 'clone' ? `Created ${noun} "${result.name}"` : `Updated ${noun} "${result.name}"`,
        { variant: 'success' }
      );
      onApplied?.({ assetId: result.assetId, name: result.name, mode });
      onClose();
    } catch (error) {
      setApplyError(getApiErrorMessage(error, `Failed to update the ${noun}`));
    } finally {
      setApplying(false);
    }
  };

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
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {loadError && (
          <Alert severity="error">
            <AlertTitle>Cannot read this {noun}</AlertTitle>
            {loadError}
          </Alert>
        )}

        {!loading && !loadError && (
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
                  disabled={applying || proposing}
                />
                <Button
                  variant="outlined"
                  onClick={handlePropose}
                  disabled={applying || proposing || !ask.trim()}
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
              value={mode}
              onChange={(e) => setMode(e.target.value as ApplyRebindRequest['mode'])}
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
              label={mode === 'clone' ? 'Name for the copy' : 'Name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              fullWidth
              disabled={applying}
              helperText={mode === 'update' ? 'Leave as is to keep the current name' : undefined}
            />

            {datasets.length === 0 && (
              <Alert severity="info">This {noun} declares no datasets.</Alert>
            )}

            {datasets.map((dataset) => {
              const datasetPlan = plan?.datasets.find((d) => d.identifier === dataset.identifier);
              const suggestions =
                datasetPlan?.columns.filter((c) => c.status === 'suggested').length ?? 0;
              return (
                <Box
                  key={dataset.identifier}
                  sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 1, p: 2 }}
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
                    value={targets[dataset.identifier] ?? null}
                    onChange={(next) => setTarget(dataset.identifier, next)}
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
                        {planning && <CircularProgress size={14} />}
                        <Box sx={{ flex: 1 }} />
                        {suggestions > 0 && (
                          <Button
                            size="small"
                            onClick={() => acceptSuggestions(dataset.identifier)}
                            disabled={applying}
                          >
                            Accept {suggestions} suggestion{suggestions === 1 ? '' : 's'}
                          </Button>
                        )}
                      </Stack>
                      <Divider sx={{ mb: 1 }} />
                      <ColumnResolutionTable
                        plan={datasetPlan}
                        columnMap={columnMaps[dataset.identifier] ?? {}}
                        onMap={(source, target) => mapColumn(dataset.identifier, source, target)}
                        disabled={applying}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}

            {planError && <Alert severity="error">{planError}</Alert>}
            {applyError && (
              <Alert severity="error">
                <AlertTitle>QuickSight rejected the change</AlertTitle>
                {applyError}
              </Alert>
            )}

            {mode === 'update' && rebinds.length > 0 && (
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
          disabled={!canApply}
          startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {mode === 'clone' ? 'Create copy' : 'Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
