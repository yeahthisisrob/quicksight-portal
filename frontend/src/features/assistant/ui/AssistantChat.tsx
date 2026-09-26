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
  type AppendMessage,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  type ThreadMessageLike,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
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
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  type ConversationEntry,
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

/** The questions an answer asked (AG-UI input_required interrupts). */
function questionsOf(result: AssistantChatResult) {
  return result.outcome?.type === 'interrupt'
    ? (result.outcome.interrupts ?? []).filter((i) => i.reason === 'input_required')
    : [];
}

/** The reply as prose; empty when it only repeats the question drawn as a card. */
function replyText(result: AssistantChatResult): string {
  return questionsOf(result).some((q) => q.message?.trim() === result.reply.trim())
    ? ''
    : result.reply;
}

/** One answer: the reply, what it drew, the changes to confirm, and what it cost. */
export function AnswerView({
  result,
  runs = {},
  onRun = () => undefined,
  onFollowUp,
  answerFor = () => undefined,
  onAnswer,
  showReply = true,
}: {
  result: AssistantChatResult;
  /** The answer a later message gave to one of this answer's questions. */
  answerFor?: (interruptId: string) => AgUiResumeEntry | undefined;
  onAnswer?: (interrupt: AgUiInterrupt, selected: string[], other?: string) => void;
  /** False inside the thread, which renders the reply as the message's text. */
  showReply?: boolean;
} & Partial<ActionCallbacks>) {
  const linked = new Set(result.actions.map((a) => a.previewId).filter(Boolean));
  const loose = result.artifacts.filter((a) => !linked.has(a.id));
  const questions = questionsOf(result);
  const reply = showReply ? replyText(result) : '';
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

/** What the thread's message parts need from the conversation. */
interface ChatContextValue {
  conversation: ReturnType<typeof useConversation>['conversation'];
  busy: boolean;
  recordRun: ReturnType<typeof useConversation>['recordRun'];
  answer: ReturnType<typeof useConversation>['answer'];
  submit: (text: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('Assistant message parts render inside AssistantChat');
  return value;
}

/**
 * One conversation entry as an assistant-ui message: the person's text, or
 * the reply as markdown text plus an `answer` data part that draws
 * everything else the answer carries (cards, plan, actions, questions).
 */
export function toThreadMessage(entry: ConversationEntry, index: number): ThreadMessageLike {
  if (entry.role === 'user') {
    return { id: `u${index}`, role: 'user', content: entry.text };
  }
  const text = replyText(entry.result);
  return {
    id: `a${index}`,
    role: 'assistant',
    content: [
      ...(text ? [{ type: 'text' as const, text }] : []),
      { type: 'data-answer' as const, data: { index } },
    ],
  };
}

function MarkdownPart({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}

function AnswerPart({ data }: { data: { index: number } }) {
  const { conversation, busy, recordRun, answer, submit } = useChat();
  const entry = conversation.entries[data.index];
  if (entry?.role !== 'assistant') return null;
  return (
    <AnswerView
      result={entry.result}
      showReply={false}
      runs={conversation.runs}
      onRun={recordRun}
      onFollowUp={busy ? undefined : submit}
      answerFor={(id) => answerTo(conversation, id)}
      onAnswer={busy ? undefined : answer}
    />
  );
}

const ASSISTANT_PARTS = { Text: MarkdownPart, data: { by_name: { answer: AnswerPart } } };

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <Box
        sx={{
          ml: 'auto',
          width: 'fit-content',
          maxWidth: '80%',
          bgcolor: 'action.selected',
          borderRadius: 2,
          px: 1.5,
          py: 1,
          typography: 'body2',
          whiteSpace: 'pre-wrap',
        }}
      >
        <MessagePrimitive.Parts />
      </Box>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <Stack spacing={1.25} sx={{ minWidth: 0 }}>
        <MessagePrimitive.Parts components={ASSISTANT_PARTS} />
      </Stack>
    </MessagePrimitive.Root>
  );
}

/**
 * The chat, on assistant-ui: its thread, message list, auto-scroll and
 * composer, fed from our conversation (an external store: the job and its
 * polling stay ours). Each answer's cards render as a message part.
 */
export function AssistantChat() {
  const { conversation, status, error, busy, ask, answer, retry, recordRun, reset } =
    useConversation();
  const entries = conversation.entries;
  const total = entries.reduce((sum, e) => sum + (e.role === 'assistant' ? e.result.cost : 0), 0);
  const last = entries[entries.length - 1];
  const lastAnswerPromises = last?.role === 'assistant' && endsOnAPromise(last.text);

  const submit = useCallback(
    (text: string) => {
      if (text.trim() && !busy) ask(text);
    },
    [ask, busy]
  );

  const runtime = useExternalStoreRuntime<ConversationEntry>({
    messages: entries,
    isRunning: busy,
    convertMessage: toThreadMessage,
    onNew: async (message: AppendMessage) => {
      const text = message.content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('\n');
      submit(text);
    },
  });

  const chat = useMemo(
    () => ({ conversation, busy, recordRun, answer, submit }),
    [conversation, busy, recordRun, answer, submit]
  );

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
      <AssistantRuntimeProvider runtime={runtime}>
        <ChatContext.Provider value={chat}>
          <ThreadPrimitive.Root>
            <Stack spacing={2}>
              <ThreadPrimitive.Viewport
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}
              >
                <ThreadPrimitive.Empty>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {SUGGESTIONS.map((s) => (
                      <Chip key={s} label={s} onClick={() => submit(s)} variant="outlined" />
                    ))}
                  </Stack>
                </ThreadPrimitive.Empty>
                <ThreadPrimitive.Messages>
                  {({ message }) =>
                    message.role === 'user' ? <UserMessage /> : <AssistantMessage />
                  }
                </ThreadPrimitive.Messages>
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
                {busy && (
                  <Working status={status ?? 'Thinking'} since={conversation.pending?.since} />
                )}
                {error && (
                  <Alert
                    severity="error"
                    action={
                      last?.role === 'user' ? (
                        <Button color="inherit" size="small" startIcon={<Replay />} onClick={retry}>
                          Try again
                        </Button>
                      ) : undefined
                    }
                  >
                    {error}
                  </Alert>
                )}
              </ThreadPrimitive.Viewport>
              <ComposerPrimitive.Root>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
                  <Box
                    sx={(theme) => ({
                      flex: 1,
                      display: 'flex',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 1.5,
                      py: 1,
                      '&:focus-within': { borderColor: 'primary.main' },
                      '& textarea': {
                        flex: 1,
                        border: 0,
                        outline: 0,
                        resize: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        fontSize: theme.typography.body2.fontSize,
                      },
                    })}
                  >
                    <ComposerPrimitive.Input
                      rows={1}
                      maxRows={6}
                      placeholder="Ask about a dashboard, a dataset, a calculated field, or what you want built"
                      aria-label="Message the assistant"
                      submitMode="enter"
                    />
                  </Box>
                  <ComposerPrimitive.Send asChild>
                    <Button variant="contained" startIcon={<Send />}>
                      Send
                    </Button>
                  </ComposerPrimitive.Send>
                </Stack>
              </ComposerPrimitive.Root>
            </Stack>
          </ThreadPrimitive.Root>
        </ChatContext.Provider>
      </AssistantRuntimeProvider>
      {total > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          This conversation so far: about {formatCost(total)} at list price.
        </Typography>
      )}
    </Container>
  );
}
