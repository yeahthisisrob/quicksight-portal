/**
 * The thread's messages. The person's are bubbles on the right. The
 * assistant's are its parts in order (markdown text, then the tool UIs for
 * what it drew, prepared or asked), with a footer carrying the model that
 * answered, what it cost, what it looked at, and a copy button. While an
 * answer is being worked on, its empty message says what the assistant is
 * doing and for how long.
 */
import {
  ActionBarPrimitive,
  type EmptyMessagePartProps,
  MessagePrimitive,
  useAuiState,
} from '@assistant-ui/react';
import { AutoAwesome, Check, ContentCopy } from '@mui/icons-material';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { pal } from '@/shared/design-system';

import { answerMetaOf } from '../../model/thread';
import { formatCost } from '../costFormat';
import { useChatStatus } from './chatStatus';
import { MarkdownText } from './MarkdownText';

const TICK_MS = 1_000;
const MS_PER_S = 1_000;

/** Seconds since `since`, ticking. */
function useElapsed(since: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [since]);
  return since ? Math.max(0, Math.round((now - since) / MS_PER_S)) : 0;
}

/** What the assistant is doing right now, and for how long. */
function Working({ status }: EmptyMessagePartProps) {
  const { status: doing, since } = useChatStatus();
  const seconds = useElapsed(since);
  if (status.type !== 'running') return null;
  return (
    <Stack
      direction="row"
      spacing={1.25}
      data-testid="assistant-working"
      role="status"
      aria-live="polite"
      sx={{ alignItems: 'center', color: 'text.secondary', minHeight: 28 }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          display: 'flex',
          gap: 0.5,
          '& span': {
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: pal(theme).brand.primary,
            animation: 'assistant-dot 1.2s infinite ease-in-out',
          },
          '& span:nth-of-type(2)': { animationDelay: '0.15s' },
          '& span:nth-of-type(3)': { animationDelay: '0.3s' },
          '@keyframes assistant-dot': {
            '0%, 80%, 100%': { opacity: 0.25, transform: 'scale(0.8)' },
            '40%': { opacity: 1, transform: 'scale(1)' },
          },
          '@media (prefers-reduced-motion: reduce)': { '& span': { animation: 'none' } },
        })}
      >
        <span />
        <span />
        <span />
      </Box>
      <Typography variant="body2">
        {doing ?? 'Thinking'}
        {seconds > 0 ? ` · ${seconds}s` : ''}
      </Typography>
    </Stack>
  );
}

const ASSISTANT_PARTS = { Text: MarkdownText, Empty: Working };

export function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <Box
        sx={(theme) => ({
          ml: 'auto',
          width: 'fit-content',
          maxWidth: 'min(80%, 640px)',
          px: 1.75,
          py: 1,
          borderRadius: `${Number(theme.shape.borderRadius) * 2.5}px`,
          borderBottomRightRadius: `${theme.shape.borderRadius}px`,
          bgcolor: pal(theme).brand.subtle,
          color: 'text.primary',
          typography: 'body2',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        })}
      >
        <MessagePrimitive.Parts />
      </Box>
    </MessagePrimitive.Root>
  );
}

function chip(label: string) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      sx={{ height: 22, fontSize: '0.6875rem', color: 'text.secondary' }}
    />
  );
}

/** Which model answered, what it cost, what it looked at; and copy. */
function AnswerFooter() {
  const meta = answerMetaOf(useAuiState((s) => s.message.metadata.custom));
  if (!meta) return null;
  const looked = meta.calls.length;
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
      <Tooltip
        title={`${meta.usage.inputTokens.toLocaleString()} tokens in, ${meta.usage.outputTokens.toLocaleString()} out, at list price`}
      >
        {chip(`${meta.model.label} · ${formatCost(meta.cost)}`)}
      </Tooltip>
      {meta.helpers.map((helper) => (
        <Tooltip key={helper.modelId} title={`The planner answered with ${helper.modelId}`}>
          {chip(`Planner: ${helper.label}`)}
        </Tooltip>
      ))}
      {looked > 0 && (
        <Tooltip
          title={
            <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
              {meta.calls.map((c) => `${c.method} ${c.path} → ${c.status}`).join('\n')}
            </Box>
          }
        >
          {chip(`Looked at ${looked} thing${looked === 1 ? '' : 's'}`)}
        </Tooltip>
      )}
      <ActionBarPrimitive.Root hideWhenRunning autohide="never">
        <ActionBarPrimitive.Copy asChild copiedDuration={1_500}>
          <IconButton
            size="small"
            aria-label="Copy the reply"
            sx={{
              color: 'text.secondary',
              '& .copied': { display: 'none' },
              '&[data-copied] .copied': { display: 'inline-flex' },
              '&[data-copied] .copy': { display: 'none' },
            }}
          >
            <ContentCopy className="copy" sx={{ fontSize: 16 }} />
            <Check className="copied" sx={{ fontSize: 16 }} />
          </IconButton>
        </ActionBarPrimitive.Copy>
      </ActionBarPrimitive.Root>
    </Stack>
  );
}

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 28,
            height: 28,
            mt: 0.25,
            flexShrink: 0,
            borderRadius: '50%',
            color: pal(theme).text.onBrand,
            bgcolor: pal(theme).brand.primary,
          })}
        >
          <AutoAwesome sx={{ fontSize: 16 }} />
        </Box>
        <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <MessagePrimitive.Parts components={ASSISTANT_PARTS} />
          <AnswerFooter />
        </Stack>
      </Stack>
    </MessagePrimitive.Root>
  );
}
