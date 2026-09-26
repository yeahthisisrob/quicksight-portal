/**
 * One playbook, from setup to done: its parameters and gates, a preview
 * (a job) and its rows, which rows to change, a run (a job) and its rows as
 * they finish. The playbook, preview and run are in the URL, so a preview
 * or a run is a link and a reload lands back on it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getApiErrorMessage, jobsApi, playbooksApi } from '@/shared/api';
import type { JobMetadata } from '@/shared/api/modules/jobs';
import type {
  GateValues,
  Playbook,
  PlaybookItem,
  PlaybookItemsPage,
  RunLimits,
} from '@/shared/api/modules/playbooks';
import { useAiModel } from '@/shared/lib';
import { announceAssetChanges, type ChangedAssetType } from '@/shared/lib/assetChanges';

const POLL_MS = 2000;
const ACTIVE = new Set(['queued', 'processing', 'stopping']);

export type PlaybookStage = 'setup' | 'previewing' | 'scope' | 'running' | 'ran';

export interface PlaybookFlow {
  playbook: Playbook | null;
  stage: PlaybookStage;
  params: Record<string, unknown>;
  setParam: (key: string, value: unknown) => void;
  gates: GateValues;
  setGate: (key: string, value: number | string | boolean | null) => void;
  /** Every required parameter has a value. */
  ready: boolean;
  preview: { job: JobMetadata | null; page: PlaybookItemsPage | null };
  run: { job: JobMetadata | null; page: PlaybookItemsPage | null };
  /** The 'change' rows chosen to run. */
  selected: Set<string>;
  setSelected: (keys: Set<string>) => void;
  startPreview: () => void;
  startRun: (limits?: RunLimits, canary?: number) => void;
  /** Only once the preview completed: the server refuses to run any other. */
  canRun: boolean;
  /** Chosen rows the last run did not handle, and a run of just those. */
  remaining: string[];
  runRest: (limits?: RunLimits) => void;
  retryFailed: () => void;
  stop: () => void;
  /** Back to setup, keeping the parameters. */
  edit: () => void;
  close: () => void;
  busy: boolean;
  error: string | null;
}

function gateDefaults(playbook: Playbook | null): GateValues {
  const values: GateValues = {};
  for (const gate of playbook?.gates ?? []) {
    if (gate.default !== undefined) values[gate.key] = gate.default as never;
  }
  return values;
}

function paramDefaults(playbook: Playbook | null): Record<string, unknown> {
  return Object.fromEntries(
    (playbook?.params ?? []).filter((p) => p.default !== undefined).map((p) => [p.key, p.default])
  );
}

/** Pickers hold what they show (a folder's name too); the API takes the id. */
function sendable(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      value && typeof value === 'object' && 'id' in value ? (value as { id: string }).id : value,
    ])
  );
}

/** A job and, once it has rows, its rows; both polled while it runs. */
function useJobRows(jobId: string | null) {
  const job = useQuery({
    queryKey: ['playbook-job', jobId],
    queryFn: () => jobsApi.getJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (q) => (q.state.data && !ACTIVE.has(q.state.data.status) ? false : POLL_MS),
  });
  const running = job.data ? ACTIVE.has(job.data.status) : true;
  const page = useQuery({
    queryKey: ['playbook-items', jobId],
    queryFn: () => playbooksApi.items(jobId!),
    enabled: jobId !== null && job.data !== undefined,
    refetchInterval: running ? POLL_MS : false,
  });
  // One last read once it ends, so the rows match the finished job.
  const status = job.data?.status;
  const refetchPage = page.refetch;
  useEffect(() => {
    if (status && !ACTIVE.has(status)) void refetchPage();
  }, [status, refetchPage]);
  return { job: job.data ?? null, page: page.data ?? null, running: jobId !== null && running };
}

export function usePlaybook(): PlaybookFlow {
  const [urlParams, setUrlParams] = useSearchParams();
  const queryClient = useQueryClient();
  const playbookId = urlParams.get('playbook');
  const previewJobId = urlParams.get('preview');
  const runJobId = urlParams.get('run');

  const catalog = useQuery({ queryKey: ['playbooks'], queryFn: () => playbooksApi.list() });
  const playbook = catalog.data?.find((p) => p.id === playbookId) ?? null;

  const [params, setParams] = useState<Record<string, unknown>>({});
  const [gates, setGates] = useState<GateValues>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reviewModel] = useAiModel('review');

  // New playbook: its defaults.
  useEffect(() => {
    setParams(paramDefaults(playbook));
    setGates(gateDefaults(playbook));
  }, [playbook]);

  const preview = useJobRows(previewJobId);
  const run = useJobRows(runJobId);

  // The preview's 'change' rows start chosen as they arrive; a new preview
  // chooses again. Rows already seen keep whatever the person made of them,
  // so a poll never re-ticks what they unticked.
  const previewItems = preview.page?.items;
  const seen = useRef<{ jobId: string | null; keys: Set<string> }>({
    jobId: null,
    keys: new Set(),
  });
  useEffect(() => {
    if (!previewItems) return;
    const fresh = seen.current.jobId !== previewJobId;
    if (fresh) seen.current = { jobId: previewJobId, keys: new Set() };
    const arrived = previewItems.filter((r) => !seen.current.keys.has(r.key));
    for (const row of arrived) seen.current.keys.add(row.key);
    const toTick = arrived.filter((r) => r.verdict === 'change').map((r) => r.key);
    setSelected((prev) => new Set([...(fresh ? [] : prev), ...toTick]));
  }, [previewItems, previewJobId]);

  // A run that finished changed things: every open list reloads.
  const runStatus = run.job?.status;
  const writes = playbook?.writes;
  useEffect(() => {
    if (runStatus && !ACTIVE.has(runStatus) && writes?.length) {
      announceAssetChanges(writes as ChangedAssetType[]);
    }
  }, [runStatus, writes]);

  const setUrl = useCallback(
    (changes: Record<string, string | null>) =>
      setUrlParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      }),
    [setUrlParams]
  );

  const onError = (e: unknown) => setError(getApiErrorMessage(e, 'The playbook could not start'));

  const previewMutation = useMutation({
    mutationFn: () =>
      playbooksApi.preview(
        playbook!.id,
        sendable(params),
        gates,
        playbook!.infers ? reviewModel : undefined
      ),
    onMutate: () => setError(null),
    onSuccess: (job) => setUrl({ preview: job.jobId, run: null }),
    onError,
  });
  const runMutation = useMutation({
    mutationFn: (input: { keys?: string[]; retryOf?: string; limits?: RunLimits }) =>
      playbooksApi.run(playbook!.id, previewJobId!, input),
    onMutate: () => setError(null),
    onSuccess: (job) => setUrl({ run: job.jobId }),
    onError,
  });
  const stopMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.stopJob(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playbook-job'] }),
    onError,
  });

  const stage: PlaybookStage = run.job
    ? run.running
      ? 'running'
      : 'ran'
    : previewJobId
      ? preview.running
        ? 'previewing'
        : 'scope'
      : 'setup';

  const ready = useMemo(
    () =>
      (playbook?.params ?? []).every(
        (p) => !p.required || (params[p.key] !== undefined && params[p.key] !== '')
      ),
    [playbook, params]
  );

  const changeRows: PlaybookItem[] = useMemo(
    () => (preview.page?.items ?? []).filter((r) => r.verdict === 'change'),
    [preview.page]
  );
  // What the last run did not get to: chosen, and not handled by it (a
  // canary's other rows, or what a stopped or halted run left pending).
  const remaining = useMemo(() => {
    if (!run.page) return [];
    const handled = new Set(run.page.items.filter((r) => r.status !== 'pending').map((r) => r.key));
    return changeRows.filter((r) => selected.has(r.key) && !handled.has(r.key)).map((r) => r.key);
  }, [run.page, changeRows, selected]);

  return {
    playbook,
    stage,
    params,
    setParam: (key, value) => setParams((prev) => ({ ...prev, [key]: value })),
    gates,
    setGate: (key, value) => setGates((prev) => ({ ...prev, [key]: value })),
    ready,
    preview: { job: preview.job, page: preview.page },
    run: { job: run.job, page: run.page },
    selected,
    setSelected,
    startPreview: () => previewMutation.mutate(),
    canRun: preview.job?.status === 'completed',
    startRun: (limits, canary) => {
      const chosen = changeRows.filter((r) => selected.has(r.key)).map((r) => r.key);
      const keys = canary ? chosen.slice(0, canary) : chosen;
      // Everything chosen: send no keys, so the run is exactly the preview's changes.
      const all = keys.length === changeRows.length;
      runMutation.mutate({ ...(all ? {} : { keys }), ...(limits ? { limits } : {}) });
    },
    remaining,
    runRest: (limits) => runMutation.mutate({ keys: remaining, ...(limits ? { limits } : {}) }),
    retryFailed: () => runJobId && runMutation.mutate({ retryOf: runJobId }),
    stop: () => {
      const active = run.running ? runJobId : preview.running ? previewJobId : null;
      if (active) stopMutation.mutate(active);
    },
    edit: () => setUrl({ preview: null, run: null }),
    close: () => setUrl({ playbook: null, preview: null, run: null }),
    busy: previewMutation.isPending || runMutation.isPending,
    error:
      error ??
      (catalog.error ? getApiErrorMessage(catalog.error, 'Could not load the playbooks') : null),
  };
}

/** The catalog alone, for the cards. */
export function usePlaybookCatalog() {
  const [, setUrlParams] = useSearchParams();
  const catalog = useQuery({ queryKey: ['playbooks'], queryFn: () => playbooksApi.list() });
  return {
    playbooks: catalog.data ?? [],
    loading: catalog.isLoading,
    error: catalog.error ? getApiErrorMessage(catalog.error, 'Could not load the playbooks') : null,
    open: (id: string) =>
      setUrlParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('playbook', id);
        next.delete('preview');
        next.delete('run');
        return next;
      }),
  };
}
