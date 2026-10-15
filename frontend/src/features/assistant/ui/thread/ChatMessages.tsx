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
import { Box, Chip, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import { Fragment, useEffect, useState } from 'react';

import { formatCost } from '@/entities/ai-model';

import { pal } from '@/shared/design-system';

import { type AnswerMeta, answerMetaOf } from '../../model/thread';
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

/** How many of the steps taken so far are shown under the status line. */
const RECENT_EVENTS = 6;

/** What the assistant is doing right now, for how long, and the steps it took to get here. */
function Working({ status }: EmptyMessagePartProps) {
  const { status: doing, since, events = [] } = useChatStatus();
  const seconds = useElapsed(since);
  if (status.type !== 'running') return null;
  const recent = events.slice(-RECENT_EVENTS);
  return (
    <Stack spacing={0.75} data-testid="assistant-working" role="status" aria-live="polite">
      <WorkingLine doing={doing} seconds={seconds} />
      {recent.length > 0 && (
        <Box component="ol" sx={{ m: 0, pl: 2.25, color: 'text.secondary' }}>
          {recent.map((event, i) => (
            <Box component="li" key={`${events.length - recent.length + i}-${event.message}`}>
              <Typography variant="caption" component="span">
                {event.message}
                {event.ms !== undefined ? ` · ${ms(event.ms)}` : ''}
              </Typography>
              {event.note && (
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ display: 'block', fontStyle: 'italic', opacity: 0.8 }}
                >
                  {event.note}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function WorkingLine({ doing, seconds }: { doing: string | null; seconds: number }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
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

const ms = (value: number | undefined) =>
  value === undefined ? '' : value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;

/** A trace row that is a model turn, not a call to the portal (the contract's MODEL method). */
const isModelTurn = (call: AnswerMeta['calls'][number]) => call.method === 'MODEL';

/** Every call and model turn behind an answer, in order: what for, which, how it went, how long. */
function CallTrace({ calls }: { calls: AnswerMeta['calls'] }) {
  const total = calls.reduce((sum, c) => sum + (c.ms ?? 0), 0);
  const looked = calls.filter((c) => !isModelTurn(c)).length;
  const thought = calls.filter(isModelTurn).length;
  return (
    <Box sx={{ p: 1.5, maxWidth: 560, maxHeight: 420, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Looked at {looked} thing{looked === 1 ? '' : 's'}
        {thought > 0 ? `, thought ${thought} time${thought === 1 ? '' : 's'}` : ''}
        {total > 0 ? `, ${ms(total)} in all` : ''}
      </Typography>
      <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <tbody>
          {calls.map((call, i) => (
            <Fragment key={`${i}-${call.path}`}>
              <Box component="tr" sx={{ '& td': { py: 0.5, pr: 1.5, verticalAlign: 'top' } }}>
                <td>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {call.step ?? (call.method === 'GET' ? 'Reading' : 'Working')}
                  </Typography>
                </td>
                <td style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {isModelTurn(call) ? call.path : `${call.method} ${call.path}`}
                  {call.note && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', fontFamily: 'inherit', fontStyle: 'italic' }}
                    >
                      {call.note}
                    </Typography>
                  )}
                </td>
                <td>
                  <Typography
                    variant="caption"
                    sx={{ color: call.ok ? 'success.main' : 'error.main', whiteSpace: 'nowrap' }}
                  >
                    {call.status}
                  </Typography>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ms(call.ms)}</td>
              </Box>
              {call.detail?.map((d) => (
                <Box
                  component="tr"
                  key={`${i}-${d.label}`}
                  sx={{ '& td': { py: 0.25, pr: 1.5, color: 'text.secondary' } }}
                >
                  <td />
                  <td style={{ paddingLeft: 16 }}>↳ {d.label}</td>
                  <td />
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ms(d.ms)}</td>
                </Box>
              ))}
            </Fragment>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

/** Which model answered, what it cost, what it looked at; and copy. */
function AnswerFooter() {
  const meta = answerMetaOf(useAuiState((s) => s.message.metadata.custom));
  const [traceAt, setTraceAt] = useState<HTMLElement | null>(null);
  if (!meta) return null;
  const looked = meta.calls.filter((c) => !isModelTurn(c)).length;
  const spent = meta.calls.reduce((sum, c) => sum + (c.ms ?? 0), 0);
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
      {meta.calls.length > 0 && (
        <>
          <Chip
            size="small"
            variant="outlined"
            clickable
            onClick={(e) => setTraceAt(e.currentTarget)}
            label={`${looked > 0 ? `Looked at ${looked} thing${looked === 1 ? '' : 's'}` : `${meta.calls.length} step${meta.calls.length === 1 ? '' : 's'}`}${spent > 0 ? ` · ${ms(spent)}` : ''}`}
            sx={{ height: 22, fontSize: '0.6875rem', color: 'text.secondary' }}
          />
          <Popover
            open={Boolean(traceAt)}
            anchorEl={traceAt}
            onClose={() => setTraceAt(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <CallTrace calls={meta.calls} />
          </Popover>
        </>
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
