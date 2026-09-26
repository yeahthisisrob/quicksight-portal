/**
 * prepare_action: a write the assistant prepared, for the person to run
 * with their own session. The tool call's result is how the run went: Run
 * reports it through `addResult`, and when the write queued a job the card
 * follows the job to the end and reports again. A finished run can be told
 * back to the assistant, which carries on from it.
 */
import { type ToolCallMessagePartComponent, useAui, useAuiState } from '@assistant-ui/react';
import {
  AddComment,
  CheckCircle,
  ErrorOutlined,
  PlayArrow,
  UnfoldLess,
  UnfoldMore,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { assistantApi, getApiErrorMessage, jobsApi } from '@/shared/api';
import { pal } from '@/shared/design-system';
import { announceAssetChanges } from '@/shared/lib/assetChanges';

import { type ActionRun, createdAsset, followUpFor, jobIdOf } from '../../model/conversation';
import type { ActionArgs } from '../../model/thread';
import { WireframeArtifact } from './ArtifactTools';

const JOB_POLL_MS = 1_500;
const RESULT_PREVIEW_CHARS = 2_000;
const TERMINAL = new Set(['completed', 'failed', 'stopped']);

type Report = (run: ActionRun) => void;

/** Follows the job a run queued until it settles, and reports how it ended. */
function useFollowJob(run: ActionRun | undefined, report: Report) {
  const following = run?.status === 'running' && Boolean(run.jobId);
  const settled = useRef<string | null>(null);
  const job = useQuery({
    queryKey: ['assistant-action-job', run?.jobId],
    queryFn: () => jobsApi.getJob(run?.jobId ?? ''),
    enabled: following,
    refetchInterval: (query) =>
      query.state.data && TERMINAL.has(query.state.data.status) ? false : JOB_POLL_MS,
  });
  useEffect(() => {
    const data = job.data;
    if (!following || !data || !TERMINAL.has(data.status) || !run?.jobId) return;
    if (settled.current === run.jobId) return;
    settled.current = run.jobId;
    if (data.status !== 'completed') {
      report({ ...run, status: 'failed', error: data.error || data.message || data.status });
      return;
    }
    jobsApi
      .getJobResult(run.jobId)
      .then((result) => report({ ...run, status: 'completed', message: data.message, result }))
      .catch(() => report({ ...run, status: 'completed', message: data.message }));
  }, [job.data, following, run, report]);
  return job.data;
}

/** What a finished action made, with a way to open it, and any warnings it came back with. */
function CreatedNote({ result }: { result: unknown }) {
  const created = createdAsset(result);
  const warnings = (result as { warnings?: unknown } | null)?.warnings;
  const list = Array.isArray(warnings)
    ? warnings.filter((w): w is string => typeof w === 'string')
    : [];
  if (!created && list.length === 0) return null;
  return (
    <Stack spacing={0.75}>
      {created && (
        <Alert
          severity="success"
          action={
            <Button
              size="small"
              color="inherit"
              href={`/author?tab=studio&type=${created.assetType}&id=${encodeURIComponent(created.assetId)}`}
              target="_blank"
              rel="noopener"
            >
              Edit in Studio
            </Button>
          }
        >
          Created {created.assetType} {created.name ?? created.assetId}
        </Alert>
      )}
      {list.length > 0 && (
        <Alert severity="warning">
          {list.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </Alert>
      )}
    </Stack>
  );
}

function RunState({
  run,
  jobMessage,
  starting,
  hasPreview,
  onStart,
}: {
  run: ActionRun | undefined;
  jobMessage?: string;
  starting: boolean;
  hasPreview: boolean;
  onStart: () => void;
}) {
  if (run?.status === 'completed') {
    return <Chip color="success" size="small" icon={<CheckCircle />} label="Done" />;
  }
  if (run?.status === 'failed') {
    return <Chip color="error" size="small" icon={<ErrorOutlined />} label="Failed" />;
  }
  if (run?.status === 'running') {
    return (
      <Chip
        size="small"
        icon={<CircularProgress size={12} />}
        label={jobMessage || run.message || 'Running'}
        sx={{ maxWidth: 280 }}
      />
    );
  }
  return (
    <Button
      variant="contained"
      size="small"
      disableElevation
      startIcon={starting ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
      disabled={starting}
      onClick={onStart}
      sx={{ flexShrink: 0 }}
    >
      {hasPreview ? 'Looks right, run it' : 'Run it'}
    </Button>
  );
}

export const ActionTool: ToolCallMessagePartComponent<ActionArgs, ActionRun> = ({
  args,
  result: run,
  addResult,
}) => {
  const action = args?.action;
  const preview = args?.preview;
  const aui = useAui();
  const busy = useAuiState((s) => s.thread.isRunning);
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const job = useFollowJob(run, addResult);

  // A write changed the account: lists and searches on this page are stale.
  useEffect(() => {
    if (run?.status === 'completed') {
      void queryClient.invalidateQueries({
        predicate: (query) => !String(query.queryKey[0] ?? '').startsWith('assistant'),
      });
      announceAssetChanges();
    }
  }, [run?.status, queryClient]);

  if (!action) return null;

  const start = async () => {
    setStarting(true);
    try {
      const response = await assistantApi.runAction(action);
      const jobId = jobIdOf(response);
      addResult(
        jobId
          ? { status: 'running', jobId, message: 'Queued' }
          : { status: 'completed', result: (response as any)?.data ?? response }
      );
    } catch (e) {
      addResult({ status: 'failed', error: getApiErrorMessage(e, 'The action failed') });
    } finally {
      setStarting(false);
    }
  };

  const settled = run?.status === 'completed' || run?.status === 'failed';
  const resultText =
    run?.result === undefined
      ? ''
      : JSON.stringify(run.result, null, 2).slice(0, RESULT_PREVIEW_CHARS);

  return (
    <Box
      data-testid="prepared-action"
      sx={(theme) => ({
        border: `1px solid ${
          run?.status === 'completed'
            ? theme.palette.success.main
            : run?.status === 'failed'
              ? theme.palette.error.main
              : pal(theme).line.default
        }`,
        borderLeft: `3px solid ${
          run?.status === 'completed'
            ? theme.palette.success.main
            : run?.status === 'failed'
              ? theme.palette.error.main
              : theme.palette.primary.main
        }`,
        borderRadius: `${Number(theme.shape.borderRadius) * 2}px`,
        bgcolor: 'background.paper',
        p: 1.5,
        minWidth: 0,
      })}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
              Prepared change
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {action.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {action.why}
            </Typography>
          </Box>
          <RunState
            run={run}
            jobMessage={job?.message}
            starting={starting}
            hasPreview={Boolean(preview)}
            onStart={() => void start()}
          />
        </Stack>
        <Typography
          variant="caption"
          sx={{ fontFamily: 'monospace', color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {action.method} {action.path}
          {run?.jobId ? ` · job ${run.jobId}` : ''}
        </Typography>
        {run?.status === 'running' && (
          <LinearProgress
            variant={job?.progress ? 'determinate' : 'indeterminate'}
            value={job?.progress ?? 0}
            sx={{ borderRadius: 1 }}
          />
        )}
        {preview && !run && <WireframeArtifact artifact={preview} />}
        {run?.status === 'failed' && <Alert severity="error">{run.error}</Alert>}
        {run?.status === 'completed' && <CreatedNote result={run.result} />}
        {settled && run && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {resultText && (
              <Button
                size="small"
                startIcon={showResult ? <UnfoldLess /> : <UnfoldMore />}
                onClick={() => setShowResult((v) => !v)}
              >
                {showResult ? 'Hide the result' : 'Show the result'}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddComment />}
              disabled={busy}
              onClick={() => aui.thread().append(followUpFor(action.title, run))}
            >
              Tell the assistant
            </Button>
          </Stack>
        )}
        <Collapse in={showResult} unmountOnExit>
          <Box
            component="pre"
            sx={(theme) => ({
              m: 0,
              p: 1.25,
              fontSize: 12,
              borderRadius: 1,
              border: `1px solid ${pal(theme).line.divider}`,
              bgcolor: pal(theme).surface.hover,
              overflow: 'auto',
              maxHeight: 280,
            })}
          >
            {resultText}
          </Box>
        </Collapse>
      </Stack>
    </Box>
  );
};
