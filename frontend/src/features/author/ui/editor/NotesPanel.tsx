/**
 * Notes - what is known about the open asset and, when one is selected on
 * the canvas, about that visual: what people said it means or is for, what
 * the portal changed and when, what a model read into it (a draft until
 * confirmed) and the questions it could not answer. A person adds a note in
 * their own words, confirms or edits a draft, answers a question, or asks
 * the portal to learn the asset.
 */
import { AutoAwesome } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getApiErrorMessage, knowledgeApi } from '@/shared/api';
import type { Note } from '@/shared/api/modules/knowledge';
import { useAiModel } from '@/shared/lib';

import type { Studio } from '../../model/useStudio';
import { NoteRow } from '../knowledge/NoteRow';

type PersonKind = 'meaning' | 'rule' | 'identity' | 'preference' | 'description';

const KINDS: Array<{ value: PersonKind; label: string }> = [
  { value: 'description', label: 'What it is for' },
  { value: 'meaning', label: 'What it means' },
  { value: 'rule', label: 'A rule for building with it' },
  { value: 'identity', label: 'Which one is the real one' },
  { value: 'preference', label: 'A preference' },
];

/** The notes on one entity, with a composer to add one. */
function EntityNotes({ entityId, title }: { entityId: string; title: string }) {
  const queryClient = useQueryClient();
  const notes = useQuery({
    queryKey: ['knowledge', entityId],
    queryFn: () => knowledgeApi.list(entityId),
  });
  const [kind, setKind] = useState<PersonKind>('description');
  const [text, setText] = useState('');
  const [answering, setAnswering] = useState<Note | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['knowledge', entityId] });
  const add = useMutation({
    mutationFn: () =>
      knowledgeApi.add(entityId, {
        kind: answering ? 'meaning' : kind,
        text,
        ...(answering ? { resolves: answering.noteId } : {}),
      }),
    onSuccess: () => {
      setText('');
      setAnswering(null);
      void refresh();
    },
  });
  const confirm = useMutation({
    mutationFn: (note: Note) => knowledgeApi.confirm(entityId, note.noteId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (note: Note) => knowledgeApi.remove(entityId, note.noteId),
    onSuccess: refresh,
  });
  const busy = add.isPending || confirm.isPending || remove.isPending;
  const list = notes.data ?? [];
  return (
    <Box data-testid={`notes-${entityId}`}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
        {entityId}
      </Typography>
      {notes.isLoading ? (
        <CircularProgress size={18} sx={{ my: 1 }} />
      ) : notes.error ? (
        <Alert severity="error" sx={{ my: 1 }}>
          {getApiErrorMessage(notes.error, 'The notes could not be read')}
        </Alert>
      ) : list.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', my: 1 }}>
          Nothing is known about it yet.
        </Typography>
      ) : (
        <Box>
          {list.map((note, i) => (
            <Box key={note.noteId}>
              {i > 0 && <Divider />}
              <NoteRow
                note={note}
                busy={busy}
                onConfirm={(n) => confirm.mutate(n)}
                onRemove={(n) => remove.mutate(n)}
                onAnswer={(n) => setAnswering(n)}
              />
            </Box>
          ))}
        </Box>
      )}
      <Stack spacing={1} sx={{ mt: 1 }}>
        {answering ? (
          <Alert severity="info" onClose={() => setAnswering(null)}>
            Answering: {answering.text}
          </Alert>
        ) : (
          <TextField
            select
            size="small"
            label="This is"
            value={kind}
            onChange={(e) => setKind(e.target.value as PersonKind)}
          >
            {KINDS.map((k) => (
              <MenuItem key={k.value} value={k.value}>
                {k.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          size="small"
          multiline
          minRows={2}
          placeholder={
            answering
              ? 'Your answer, in your words'
              : 'In your words; the planner reads it from now on'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {add.error && (
          <Alert severity="error">
            {getApiErrorMessage(add.error, 'The note could not be saved')}
          </Alert>
        )}
        <Box>
          <Button
            size="small"
            variant="contained"
            onClick={() => add.mutate()}
            disabled={!text.trim() || busy}
          >
            {answering ? 'Answer' : 'Keep'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export function NotesPanel({ studio }: { studio: Studio }) {
  const source = studio.state.source;
  const selected = studio.state.selectedElement;
  const queryClient = useQueryClient();
  const [authoringModel] = useAiModel('authoring');
  const learn = useMutation({
    mutationFn: () => knowledgeApi.learn(source!.type, source!.id, authoringModel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });
  if (!source) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Open a dashboard or analysis to see what is known about it.
      </Typography>
    );
  }
  const assetEntity = `${source.type}:${source.id}`;
  return (
    <Stack spacing={2} data-testid="notes-panel">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
          What people and the portal have said, and what a model read into it. Confirmed notes are
          read by the assistant and the planner on every later change.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            learn.isPending ? <CircularProgress size={14} color="inherit" /> : <AutoAwesome />
          }
          onClick={() => learn.mutate()}
          disabled={learn.isPending}
        >
          {learn.isPending ? 'Learning…' : 'Learn it'}
        </Button>
      </Stack>
      {learn.error && (
        <Alert severity="error">{getApiErrorMessage(learn.error, 'It could not be learned')}</Alert>
      )}
      {learn.data && (
        <Alert severity="success">
          {learn.data.drafts.length} reading{learn.data.drafts.length === 1 ? '' : 's'} drafted,{' '}
          {learn.data.questions.length} question{learn.data.questions.length === 1 ? '' : 's'} to
          answer. Confirm the readings you agree with; edit or remove the rest.
        </Alert>
      )}
      <EntityNotes entityId={assetEntity} title={`The ${source.type} "${source.name}"`} />
      {selected && (
        <>
          <Divider />
          <EntityNotes
            entityId={`visual:${source.type}:${source.id}:${selected.elementId}`}
            title={`The selected visual (${selected.elementId})`}
          />
        </>
      )}
    </Stack>
  );
}
