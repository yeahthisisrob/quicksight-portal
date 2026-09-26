/**
 * Ask the portal. A conversation with the assistant, which reads and
 * previews through this API as the person, shows what it found (wireframes
 * of previews, lineage of calculated fields), and prepares writes the
 * person confirms against the wireframe and runs themselves. While it
 * works it says what it is doing; an action that starts a job is followed
 * to the end and can be handed back to the assistant. The conversation is
 * kept in the browser, so a reload picks it up where it was.
 */
import {
  AddComment,
  ArrowForward,
  CheckCircle,
  ErrorOutlined,
  PlayArrow,
  Replay,
  Send,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { assistantApi, getApiErrorMessage, jobsApi } from '@/shared/api';
import type {
  AgUiInterrupt,
  AgUiResumeEntry,
  AssistantAction,
  AssistantArtifact,
  AssistantChatResult,
} from '@/shared/api/modules/assistant';
import { Container } from '@/shared/design-system';
import { Markdown } from '@/shared/ui';

import {
  type ActionRun,
  answerTo,
  CONTINUE_MESSAGE,
  createdAsset,
  endsOnAPromise,
  followUpFor,
  jobIdOf,
} from '../model/conversation';
import { useConversation } from '../model/useConversation';
import { AssistantArtifactView } from './AssistantArtifactView';
import { formatCost } from './costFormat';
import { QuestionCard } from './QuestionCard';

const SUGGESTIONS = [
  'Which dashboards read the orders gold dataset?',
  'Where does the margin calculated field come from?',
  'Copy the sales overview dashboard onto sales gold and show me before you publish',
];

const JOB_POLL_MS = 1_500;
const TICK_MS = 1_000;
const MS_PER_S = 1_000;
const RESULT_PREVIEW_CHARS = 2_000;
const TERMINAL = new Set(['completed', 'failed', 'stopped']);

/** Seconds since `since`, ticking. */
function useElapsed(since: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [since]);
  return since ? Math.max(0, Math.round((now - since) / MS_PER_S)) : 0;
}

export interface ActionCallbacks {
  runs: Record<string, ActionRun>;
  onRun: (actionId: string, run: ActionRun) => void;
  onFollowUp?: (text: string) => void;
}

/** Follows the job an action queued until it settles, and records how it ended. */
function useFollowJob(
  action: AssistantAction,
  run: ActionRun | undefined,
  onRun: ActionCallbacks['onRun']
) {
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
    if (!following || !data || !TERMINAL.has(data.status) || !run?.jobId) {
      return;
    }
    if (settled.current === run.jobId) {
      return;
    }
    settled.current = run.jobId;
    if (data.status !== 'completed') {
      onRun(action.id, {
        ...run,
        status: 'failed',
        error: data.error || data.message || data.status,
      });
      return;
    }
    jobsApi
      .getJobResult(run.jobId)
      .then((result) =>
        onRun(action.id, { ...run, status: 'completed', message: data.message, result })
      )
      .catch(() => onRun(action.id, { ...run, status: 'completed', message: data.message }));
  }, [job.data, following, run, action.id, onRun]);
  return job.data;
}

/** What a finished action made, named, with a way to open it, and any warnings it came back with. */
function CreatedNote({ result }: { result: unknown }) {
  const created = createdAsset(result);
  const warnings = (result as { warnings?: unknown } | null)?.warnings;
  const list = Array.isArray(warnings)
    ? warnings.filter((w): w is string => typeof w === 'string')
    : [];
  if (!created && list.length === 0) {
    return null;
  }
  return (
    <Stack spacing={0.75}>
      {created && (
        <Alert
          severity="success"
          action={
            <Button
              size="small"
              color="inherit"
              href={`/author?type=${created.assetType}&id=${encodeURIComponent(created.assetId)}`}
              target="_blank"
              rel="noopener"
            >
              Open in Author
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

function ActionCard({
  action,
  preview,
  runs,
  onRun,
  onFollowUp,
}: { action: AssistantAction; preview?: AssistantArtifact } & ActionCallbacks) {
  const run = runs[action.id];
  const queryClient = useQueryClient();
  // A write changed the account: lists and searches on this page are stale.
  useEffect(() => {
    if (run?.status === 'completed') {
      void queryClient.invalidateQueries({
        predicate: (query) => !String(query.queryKey[0] ?? '').startsWith('assistant'),
      });
    }
  }, [run?.status, queryClient]);
  const [starting, setStarting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const job = useFollowJob(action, run, onRun);

  const start = async () => {
    setStarting(true);
    try {
      const response = await assistantApi.runAction(action);
      const jobId = jobIdOf(response);
      onRun(
        action.id,
        jobId
          ? { status: 'running', jobId, message: 'Queued' }
          : { status: 'completed', result: (response as any)?.data ?? response }
      );
    } catch (e) {
      onRun(action.id, { status: 'failed', error: getApiErrorMessage(e, 'The action failed') });
    } finally {
      setStarting(false);
    }
  };

  const running = run?.status === 'running';
  const tone =
    run?.status === 'completed'
      ? 'success.main'
      : run?.status === 'failed'
        ? 'error.main'
        : 'primary.main';
  const resultText =
    run?.result === undefined
      ? ''
      : JSON.stringify(run.result, null, 2).slice(0, RESULT_PREVIEW_CHARS);

  return (
    <Box sx={{ border: 1, borderColor: tone, borderRadius: 2, p: 1.5, minWidth: 0 }}>
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {action.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {action.why}
            </Typography>
          </Box>
          {run?.status === 'completed' ? (
            <Chip color="success" icon={<CheckCircle />} label="Done" />
          ) : run?.status === 'failed' ? (
            <Chip color="error" icon={<ErrorOutlined />} label="Failed" />
          ) : running ? (
            <Chip
              icon={<CircularProgress size={12} />}
              label={job?.message || run?.message || 'Running'}
            />
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={starting ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
              disabled={starting}
              onClick={() => void start()}
              sx={{ flexShrink: 0 }}
            >
              {preview ? 'Looks right, run it' : 'Run it'}
            </Button>
          )}
        </Stack>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {action.method} {action.path}
          {run?.jobId ? ` · job ${run.jobId}` : ''}
        </Typography>
        {running && (
          <LinearProgress
            variant={job?.progress ? 'determinate' : 'indeterminate'}
            value={job?.progress ?? 0}
          />
        )}
        {preview && !run && <AssistantArtifactView artifact={preview} />}
        {run?.status === 'failed' && <Alert severity="error">{run.error}</Alert>}
        {run?.status === 'completed' && <CreatedNote result={run.result} />}
        {(run?.status === 'completed' || run?.status === 'failed') && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {resultText && (
              <Button size="small" onClick={() => setShowResult((v) => !v)}>
                {showResult ? 'Hide the result' : 'Show the result'}
              </Button>
            )}
            {onFollowUp && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddComment />}
                onClick={() => onFollowUp(followUpFor(action.title, run))}
              >
                Tell the assistant
              </Button>
            )}
          </Stack>
        )}
        <Collapse in={showResult} unmountOnExit>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1,
              fontSize: 12,
              borderRadius: 1,
              bgcolor: 'action.hover',
              overflowX: 'auto',
              maxHeight: 280,
            }}
          >
            {resultText}
          </Box>
        </Collapse>
      </Stack>
    </Box>
  );
}

/** One answer: the reply, what it drew, the changes to confirm, and what it cost. */
export function AnswerView({
  result,
  runs = {},
  onRun = () => undefined,
  onFollowUp,
  answerFor = () => undefined,
  onAnswer,
}: {
  result: AssistantChatResult;
  /** The answer a later message gave to one of this answer's questions. */
  answerFor?: (interruptId: string) => AgUiResumeEntry | undefined;
  onAnswer?: (interrupt: AgUiInterrupt, selected: string[], other?: string) => void;
} & Partial<ActionCallbacks>) {
  const linked = new Set(result.actions.map((a) => a.previewId).filter(Boolean));
  const loose = result.artifacts.filter((a) => !linked.has(a.id));
  const questions =
    result.outcome?.type === 'interrupt'
      ? (result.outcome.interrupts ?? []).filter((i) => i.reason === 'input_required')
      : [];
  // The question is drawn as a card; do not repeat it as prose.
  const reply = questions.some((q) => q.message?.trim() === result.reply.trim())
    ? ''
    : result.reply;
  return (
    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
      {reply && <Markdown>{reply}</Markdown>}
      {questions.map((interrupt) => (
        <QuestionCard
          key={interrupt.id}
          interrupt={interrupt}
          answer={answerFor(interrupt.id)}
          onAnswer={
            onAnswer ? (selected, other) => onAnswer(interrupt, selected, other) : undefined
          }
        />
      ))}
      {loose.map((artifact) => (
        <AssistantArtifactView key={artifact.id} artifact={artifact} />
      ))}
      {result.actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          preview={result.artifacts.find((a) => a.id === action.previewId)}
          runs={runs}
          onRun={onRun}
          onFollowUp={onFollowUp}
        />
      ))}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        <Tooltip
          title={`${result.usage.inputTokens.toLocaleString()} tokens in, ${result.usage.outputTokens.toLocaleString()} out, at list price`}
        >
          <Chip
            size="small"
            variant="outlined"
            label={`${result.model.label} · ${formatCost(result.cost)}`}
          />
        </Tooltip>
        {(result.helpers ?? []).map((helper) => (
          <Tooltip key={helper.modelId} title={`The planner answered with ${helper.modelId}`}>
            <Chip size="small" variant="outlined" label={`Planner: ${helper.label}`} />
          </Tooltip>
        ))}
        {result.calls.length > 0 && (
          <Tooltip
            title={result.calls.map((c) => `${c.method} ${c.path} → ${c.status}`).join('\n')}
          >
            <Chip
              size="small"
              variant="outlined"
              label={`Looked at ${result.calls.length} thing${result.calls.length === 1 ? '' : 's'}`}
            />
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

/** What the assistant is doing right now, and for how long. */
function Working({ status, since }: { status: string; since?: number }) {
  const seconds = useElapsed(since);
  return (
    <Stack spacing={0.75} data-testid="assistant-working">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
        <CircularProgress size={14} />
        <Typography variant="body2">
          {status}
          {seconds > 0 ? ` · ${seconds}s` : ''}
        </Typography>
      </Stack>
      <LinearProgress sx={{ maxWidth: 360 }} />
    </Stack>
  );
}

export function AssistantChat() {
  const { conversation, status, error, busy, ask, answer, retry, recordRun, reset } =
    useConversation();
  const [draft, setDraft] = useState('');
  const entries = conversation.entries;
  const total = entries.reduce((sum, e) => sum + (e.role === 'assistant' ? e.result.cost : 0), 0);
  const last = entries[entries.length - 1];
  const lastAnswerPromises = last?.role === 'assistant' && endsOnAPromise(last.text);

  const submit = (text: string) => {
    if (!text.trim() || busy) {
      return;
    }
    ask(text);
    setDraft('');
  };

  return (
    <Container
      header="Ask the portal"
      description="It reads and previews through this API as you, draws what it found, and prepares changes for you to confirm and run. It never publishes by itself. The conversation is kept in this browser."
      actions={
        entries.length > 0 ? (
          <Button size="small" onClick={reset} disabled={busy}>
            New conversation
          </Button>
        ) : undefined
      }
    >
      <Stack spacing={2}>
        {entries.length === 0 && !busy ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onClick={() => submit(s)} variant="outlined" />
            ))}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {entries.map((entry, index) =>
              entry.role === 'user' ? (
                <Box
                  key={`u-${index}-${entry.text.slice(0, 16)}`}
                  sx={{
                    alignSelf: 'flex-end',
                    maxWidth: '80%',
                    bgcolor: 'action.selected',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {entry.text}
                  </Typography>
                </Box>
              ) : (
                <AnswerView
                  key={`a-${index}-${entry.result.rounds}`}
                  result={entry.result}
                  runs={conversation.runs}
                  onRun={recordRun}
                  onFollowUp={busy ? undefined : submit}
                  answerFor={(id) => answerTo(conversation, id)}
                  onAnswer={busy ? undefined : answer}
                />
              )
            )}
            {!busy && lastAnswerPromises && (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<ArrowForward />}
                    onClick={() => submit(CONTINUE_MESSAGE)}
                  >
                    Continue
                  </Button>
                }
              >
                It stopped after saying what it would do next. Nothing is running.
              </Alert>
            )}
            {busy && <Working status={status ?? 'Thinking'} since={conversation.pending?.since} />}
            {error && (
              <Alert
                severity="error"
                action={
                  entries[entries.length - 1]?.role === 'user' ? (
                    <Button color="inherit" size="small" startIcon={<Replay />} onClick={retry}>
                      Try again
                    </Button>
                  ) : undefined
                }
              >
                {error}
              </Alert>
            )}
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={6}
            size="small"
            placeholder="Ask about a dashboard, a dataset, a calculated field, or what you want built"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            slotProps={{ htmlInput: { 'aria-label': 'Message the assistant' } }}
          />
          <Button
            variant="contained"
            onClick={() => submit(draft)}
            disabled={!draft.trim() || busy}
            startIcon={<Send />}
          >
            Send
          </Button>
        </Stack>
        {total > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            This conversation so far: about {formatCost(total)} at list price.
          </Typography>
        )}
      </Stack>
    </Container>
  );
}
