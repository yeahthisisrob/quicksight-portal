/**
 * Ask the portal. A conversation with the assistant, which reads and
 * previews through this API as the person, shows what it found (wireframes
 * of previews, lineage of calculated fields, plans), and prepares writes
 * the person confirms and runs themselves.
 *
 * Built on assistant-ui. The conversation (and the job the answer runs as)
 * stays ours: it is an external store the runtime reads. Each answer is a
 * model message of parts (text, and a tool call per thing drawn, prepared
 * or asked) and the registered tool UIs draw them. A tool UI that reports a
 * result (a run, an answer to a question) goes through `onAddToolResult`
 * back into the conversation. The conversation is kept in the browser, so
 * a reload picks it up where it was.
 */
import {
  type AddToolResultOptions,
  type AppendMessage,
  AssistantRuntimeProvider,
  AuiConfig,
  AuiIf,
  ComposerPrimitive,
  type ThreadMessageLike,
  ThreadPrimitive,
  Tools,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import {
  ArrowDownward,
  ArrowForward,
  ArrowUpward,
  AutoAwesome,
  Replay,
  Stop,
} from '@mui/icons-material';
import { Alert, Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useMemo } from 'react';

import { Container, pal } from '@/shared/design-system';

import { CONTINUE_MESSAGE, endsOnAPromise } from '../model/conversation';
import { resultTarget, threadOf } from '../model/thread';
import { useConversation } from '../model/useConversation';
import { formatCost } from './costFormat';
import { AssistantMessage, UserMessage } from './thread/ChatMessages';
import { ChatStatusContext } from './thread/chatStatus';
import { assistantToolkit } from './tools/toolkit';

const SUGGESTIONS = [
  {
    title: 'Which dashboards read the orders gold dataset?',
    detail: 'Finds them through the context graph',
  },
  {
    title: 'Where does the margin calculated field come from?',
    detail: 'Traces its lineage',
  },
  {
    title: 'Copy the sales overview dashboard onto sales gold and show me before you publish',
    detail: 'Previews the copy as a wireframe, then prepares it',
  },
];

/** The tool UIs, installed next to the runtime. Plain data, so it lives at module scope. */
const TOOLS = AuiConfig({ tools: Tools({ toolkit: assistantToolkit }) });

const identity = (m: ThreadMessageLike) => m;

function Welcome() {
  return (
    <Stack spacing={2.5} sx={{ m: 'auto', py: 4, maxWidth: 720, width: '100%' }}>
      <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            borderRadius: '50%',
            color: pal(theme).brand.primary,
            bgcolor: pal(theme).brand.subtle,
          })}
        >
          <AutoAwesome />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          What do you need?
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520 }}>
          Ask about a dashboard, a dataset or a calculated field, or say what you want built. It
          shows the plan and a preview first; nothing is written until you run it.
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {SUGGESTIONS.map((s) => (
          <ThreadPrimitive.Suggestion key={s.title} prompt={s.title} send asChild>
            <Box
              component="button"
              type="button"
              sx={(theme) => ({
                all: 'unset',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: 0.5,
                textAlign: 'left',
                cursor: 'pointer',
                p: 1.5,
                borderRadius: `${Number(theme.shape.borderRadius) * 2}px`,
                border: `1px solid ${pal(theme).line.default}`,
                bgcolor: 'background.paper',
                transition: 'border-color 120ms, background-color 120ms',
                '&:hover': {
                  borderColor: pal(theme).brand.primary,
                  bgcolor: pal(theme).surface.hover,
                },
                '&:focus-visible': {
                  outline: `2px solid ${pal(theme).line.focus}`,
                  outlineOffset: 2,
                },
              })}
            >
              <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                {s.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {s.detail}
              </Typography>
            </Box>
          </ThreadPrimitive.Suggestion>
        ))}
      </Box>
    </Stack>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root>
      <Box
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          pl: 1.75,
          pr: 0.75,
          py: 0.75,
          borderRadius: `${Number(theme.shape.borderRadius) * 3}px`,
          border: `1px solid ${pal(theme).line.default}`,
          bgcolor: pal(theme).surface.input,
          boxShadow: theme.shadows[1],
          transition: 'border-color 120ms',
          '&:focus-within': { borderColor: pal(theme).brand.primary },
          '& textarea': {
            flex: 1,
            minWidth: 0,
            py: 0.75,
            border: 0,
            outline: 0,
            resize: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontSize: theme.typography.body2.fontSize,
            lineHeight: 1.5,
          },
          '& textarea::placeholder': { color: pal(theme).text.muted },
        })}
      >
        <ComposerPrimitive.Input
          rows={1}
          maxRows={8}
          autoFocus
          placeholder="Ask about a dashboard, a dataset, a calculated field, or what you want built"
          aria-label="Message the assistant"
          submitMode="enter"
        />
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <IconButton
              color="primary"
              aria-label="Send"
              sx={(theme) => ({
                bgcolor: pal(theme).brand.primary,
                color: pal(theme).text.onBrand,
                '&:hover': { bgcolor: pal(theme).brand.hover },
                '&.Mui-disabled, &:disabled': {
                  bgcolor: pal(theme).surface.disabled,
                  color: pal(theme).text.disabled,
                },
              })}
            >
              <ArrowUpward fontSize="small" />
            </IconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <Tooltip title="Stop waiting for this answer">
            <ComposerPrimitive.Cancel asChild>
              <IconButton aria-label="Stop" color="primary">
                <Stop fontSize="small" />
              </IconButton>
            </ComposerPrimitive.Cancel>
          </Tooltip>
        </AuiIf>
      </Box>
    </ComposerPrimitive.Root>
  );
}

function ScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <IconButton
        aria-label="Scroll to the latest message"
        size="small"
        sx={(theme) => ({
          position: 'absolute',
          top: -44,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'background.paper',
          border: `1px solid ${pal(theme).line.default}`,
          boxShadow: theme.shadows[2],
          '&:hover': { bgcolor: pal(theme).surface.hover },
          '&:disabled': { visibility: 'hidden' },
        })}
      >
        <ArrowDownward fontSize="small" />
      </IconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
}

/**
 * The chat. Answers run as jobs; the conversation hook sends, polls and
 * keeps them, and the runtime is fed from it.
 */
export function AssistantChat() {
  const { conversation, status, error, busy, ask, answer, retry, recordRun, cancel, reset } =
    useConversation();
  const entries = conversation.entries;
  const total = entries.reduce((sum, e) => sum + (e.role === 'assistant' ? e.result.cost : 0), 0);
  const last = entries[entries.length - 1];
  const lastAnswerPromises = last?.role === 'assistant' && endsOnAPromise(last.text);

  const messages = useMemo(() => threadOf(conversation), [conversation]);

  const onAddToolResult = useCallback(
    ({ toolName, toolCallId, result }: AddToolResultOptions) => {
      const target = resultTarget(conversation, toolName, toolCallId, result);
      if (target.kind === 'run') recordRun(target.actionId, target.run);
      if (target.kind === 'answer') answer(target.interrupt, target.selected, target.other);
    },
    [conversation, recordRun, answer]
  );

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    isRunning: busy,
    convertMessage: identity,
    onNew: async (message: AppendMessage) => {
      ask(message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n'));
    },
    onCancel: async () => cancel(),
    onAddToolResult,
  });

  const chatStatus = useMemo(
    () => ({ status, since: conversation.pending?.since }),
    [status, conversation.pending?.since]
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
      <AssistantRuntimeProvider runtime={runtime} config={TOOLS}>
        <ChatStatusContext.Provider value={chatStatus}>
          <ThreadPrimitive.Root asChild>
            <Box
              sx={(theme) => ({
                display: 'flex',
                flexDirection: 'column',
                height: 'min(74vh, 820px)',
                minHeight: 440,
                borderRadius: `${Number(theme.shape.borderRadius) * 2}px`,
                border: `1px solid ${pal(theme).line.divider}`,
                bgcolor: pal(theme).surface.page,
                overflow: 'hidden',
              })}
            >
              <ThreadPrimitive.Viewport asChild>
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    overflowY: 'auto',
                    overflowAnchor: 'none',
                    scrollbarGutter: 'stable',
                    px: { xs: 1.5, md: 3 },
                    pt: 3,
                  }}
                >
                  <AuiIf condition={(s) => s.thread.isEmpty}>
                    <Welcome />
                  </AuiIf>
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
                          onClick={() => ask(CONTINUE_MESSAGE)}
                        >
                          Continue
                        </Button>
                      }
                    >
                      It stopped after saying what it would do next. Nothing is running.
                    </Alert>
                  )}
                  {error && (
                    <Alert
                      severity="error"
                      action={
                        last?.role === 'user' ? (
                          <Button
                            color="inherit"
                            size="small"
                            startIcon={<Replay />}
                            onClick={retry}
                          >
                            Try again
                          </Button>
                        ) : undefined
                      }
                    >
                      {error}
                    </Alert>
                  )}
                  <ThreadPrimitive.ViewportFooter asChild>
                    <Box
                      sx={(theme) => ({
                        position: 'sticky',
                        bottom: 0,
                        mt: 'auto',
                        pb: 2,
                        pt: 1,
                        background: `linear-gradient(to bottom, transparent, ${pal(theme).surface.page} 24px)`,
                      })}
                    >
                      <Box sx={{ position: 'relative' }}>
                        <ScrollToBottom />
                        <Composer />
                      </Box>
                      {total > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', display: 'block', mt: 0.75, px: 1 }}
                        >
                          This conversation so far: about {formatCost(total)} at list price.
                        </Typography>
                      )}
                    </Box>
                  </ThreadPrimitive.ViewportFooter>
                </Box>
              </ThreadPrimitive.Viewport>
            </Box>
          </ThreadPrimitive.Root>
        </ChatStatusContext.Provider>
      </AssistantRuntimeProvider>
    </Container>
  );
}
