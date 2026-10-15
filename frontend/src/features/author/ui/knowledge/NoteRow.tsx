/**
 * One note as a row: its kind, who said it and when, the text, and what can
 * be done with it (confirm a draft, answer a question, remove it). Shared
 * by the editor's Notes panel and the account-wide Knowledge view.
 */
import { Check, Delete, Reply } from '@mui/icons-material';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';

import type { Note } from '@/shared/api/modules/knowledge';

const NOTE_KIND_LABEL: Record<Note['kind'], string> = {
  meaning: 'means',
  rule: 'rule',
  identity: 'identity',
  preference: 'preference',
  change: 'changed',
  description: 'is for',
  question: 'question',
};

/** The date of a note, for a row. */
function noteDate(at: string): string {
  return at.slice(0, 'YYYY-MM-DD'.length);
}

export function NoteRow({
  note,
  onConfirm,
  onRemove,
  onAnswer,
  busy,
}: {
  note: Note;
  onConfirm: (note: Note) => void;
  onRemove: (note: Note) => void;
  onAnswer: (note: Note) => void;
  busy: boolean;
}) {
  const draft = note.status === 'draft';
  const question = note.kind === 'question';
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', py: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip
            size="small"
            variant="outlined"
            color={question ? 'warning' : draft ? 'info' : 'default'}
            label={NOTE_KIND_LABEL[note.kind]}
            sx={{ height: 20, fontSize: '0.6875rem' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {note.by} · {noteDate(note.at)}
            {draft && !question ? ' · unconfirmed' : ''}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
          {note.text}
        </Typography>
      </Box>
      {question ? (
        <Tooltip title="Answer it">
          <IconButton size="small" onClick={() => onAnswer(note)} disabled={busy}>
            <Reply fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        draft && (
          <Tooltip title="Confirm, in your name">
            <IconButton
              size="small"
              color="success"
              onClick={() => onConfirm(note)}
              disabled={busy}
            >
              <Check fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      )}
      {note.kind !== 'change' && (
        <Tooltip title="Remove">
          <IconButton size="small" onClick={() => onRemove(note)} disabled={busy}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
