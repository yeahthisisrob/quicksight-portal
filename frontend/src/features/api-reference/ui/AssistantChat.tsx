/**
 * Ask the portal. A conversation with the assistant, which reads and
 * previews through this API as the person, shows what it found (wireframes
 * of previews, lineage of calculated fields), and prepares writes the
 * person confirms against the wireframe and runs themselves. Each answer
 * says which model gave it and roughly what it cost.
 */
import { CheckCircle, PlayArrow, Send } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { assistantApi, getApiErrorMessage } from '@/shared/api';
import type {
  AssistantAction,
  AssistantArtifact,
  AssistantChatResult,
} from '@/shared/api/modules/assistant';
import { Container } from '@/shared/design-system';
import { useAiModel } from '@/shared/lib';

import { AssistantArtifactView } from './AssistantArtifactView';
import { formatCost } from './costFormat';

type Entry =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; result: AssistantChatResult };

const SUGGESTIONS = [
  'Which dashboards read the orders gold dataset?',
  'Where does the margin calculated field come from?',
  'Copy the sales overview dashboard onto sales gold and show me before you publish',
];

function ActionCard({ action, preview }: { action: AssistantAction; preview?: AssistantArtifact }) {
  const run = useMutation({ mutationFn: () => assistantApi.runAction(action) });
  const done = run.isSuccess;
  const jobId = (run.data as any)?.jobId ?? (run.data as any)?.data?.jobId;
  return (
    <Box
      sx={{
        border: 1,
        borderColor: done ? 'success.main' : 'primary.main',
        borderRadius: 2,
        p: 1.5,
        minWidth: 0,
      }}
    >
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
          {done ? (
            <Chip
              color="success"
              icon={<CheckCircle />}
              label={jobId ? `Queued ${jobId}` : 'Done'}
            />
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={
                run.isPending ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />
              }
              disabled={run.isPending}
              onClick={() => run.mutate()}
              sx={{ flexShrink: 0 }}
            >
              {preview ? 'Looks right, run it' : 'Run it'}
            </Button>
          )}
        </Stack>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {action.method} {action.path}
        </Typography>
        {preview && <AssistantArtifactView artifact={preview} />}
        {run.error && (
          <Alert severity="error">{getApiErrorMessage(run.error, 'The action failed')}</Alert>
        )}
      </Stack>
    </Box>
  );
}

/** One answer: the reply, what it drew, the changes to confirm, and what it cost. */
export function AnswerView({ result }: { result: AssistantChatResult }) {
  const linked = new Set(result.actions.map((a) => a.previewId).filter(Boolean));
  const loose = result.artifacts.filter((a) => !linked.has(a.id));
  return (
    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {result.reply}
      </Typography>
      {loose.map((artifact) => (
        <AssistantArtifactView key={artifact.id} artifact={artifact} />
      ))}
      {result.actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          preview={result.artifacts.find((a) => a.id === action.previewId)}
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

export function AssistantChat() {
  const [model] = useAiModel('chat');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const send = useMutation({
    mutationFn: (history: Entry[]) =>
      assistantApi.chat({
        model,
        messages: history.map((e) => ({ role: e.role, text: e.text })),
      }),
    onSuccess: (result) =>
      setEntries((prev) => [...prev, { role: 'assistant', text: result.reply, result }]),
  });
  const total = entries.reduce((sum, e) => sum + (e.role === 'assistant' ? e.result.cost : 0), 0);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) {
      return;
    }
    const next: Entry[] = [...entries, { role: 'user', text: trimmed }];
    setEntries(next);
    setDraft('');
    send.mutate(next);
  };

  return (
    <Container
      header="Ask the portal"
      description="It reads and previews through this API as you, draws what it found, and prepares changes for you to confirm and run. It never publishes by itself."
    >
      <Stack spacing={2}>
        {entries.length === 0 ? (
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
                  // biome-ignore lint/suspicious/noArrayIndexKey: an append-only transcript
                  key={index}
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
                // biome-ignore lint/suspicious/noArrayIndexKey: an append-only transcript
                <AnswerView key={index} result={entry.result} />
              )
            )}
            {send.isPending && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', color: 'text.secondary' }}
              >
                <CircularProgress size={14} />
                <Typography variant="caption">Looking…</Typography>
              </Stack>
            )}
            {send.error && (
              <Alert severity="error">
                {getApiErrorMessage(send.error, 'The assistant did not answer')}
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
            disabled={!draft.trim() || send.isPending}
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
