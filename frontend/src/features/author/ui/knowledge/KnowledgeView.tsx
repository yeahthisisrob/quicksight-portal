/**
 * Knowledge - what the portal knows across the account, to review: the
 * questions a model could not answer, the readings it drafted and nobody
 * has confirmed, and what is known, each grouped under the thing it is
 * about with a way to open that thing in the editor. Confirm, answer or
 * remove here; the assistant and the planner read what is confirmed.
 */
import { OpenInNew } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { getApiErrorMessage, knowledgeApi } from '@/shared/api';
import type { Note } from '@/shared/api/modules/knowledge';

import { Panel } from '../primitives/Panel';
import { NoteRow } from './NoteRow';

/** Where an entity id points in the portal: the asset it is or sits in. */
function editorLinkOf(entityId: string): { href: string; label: string } | null {
  const [type, ...rest] = entityId.split(':');
  if (type === 'dashboard' || type === 'analysis') {
    const id = rest.join(':');
    return {
      href: `/author?tab=studio&view=editor&type=${type}&id=${encodeURIComponent(id)}`,
      label: `${type} ${id}`,
    };
  }
  if (type === 'visual') {
    const [assetType, assetId, visualId] = rest;
    if ((assetType === 'dashboard' || assetType === 'analysis') && assetId) {
      return {
        href: `/author?tab=studio&view=editor&type=${assetType}&id=${encodeURIComponent(assetId)}`,
        label: `visual ${visualId ?? ''} of ${assetType} ${assetId}`,
      };
    }
  }
  if (type === 'dataset') {
    return {
      href: `/author?tab=studio&view=editor&dataset=${encodeURIComponent(rest.join(':'))}`,
      label: `dataset ${rest.join(':')}`,
    };
  }
  return null;
}

function groupByEntity(notes: Note[]): Array<[string, Note[]]> {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    groups.set(note.entityId, [...(groups.get(note.entityId) ?? []), note]);
  }
  return [...groups];
}

function EntityGroup({
  entityId,
  notes,
  onConfirm,
  onRemove,
  onAnswer,
  busy,
}: {
  entityId: string;
  notes: Note[];
  onConfirm: (note: Note) => void;
  onRemove: (note: Note) => void;
  onAnswer: (note: Note) => void;
  busy: boolean;
}) {
  const link = editorLinkOf(entityId);
  return (
    <Box data-testid={`knowledge-${entityId}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
          {link?.label ?? entityId}
        </Typography>
        {link && (
          <Button
            size="small"
            component={RouterLink}
            to={link.href}
            endIcon={<OpenInNew fontSize="small" />}
          >
            Open
          </Button>
        )}
      </Stack>
      {notes.map((note, i) => (
        <Box key={note.noteId}>
          {i > 0 && <Divider />}
          <NoteRow
            note={note}
            busy={busy}
            onConfirm={onConfirm}
            onRemove={onRemove}
            onAnswer={onAnswer}
          />
        </Box>
      ))}
    </Box>
  );
}

export function KnowledgeView() {
  const queryClient = useQueryClient();
  const drafts = useQuery({
    queryKey: ['knowledge', 'all', 'draft'],
    queryFn: () => knowledgeApi.listAll('draft'),
  });
  const confirmed = useQuery({
    queryKey: ['knowledge', 'all', 'confirmed'],
    queryFn: () => knowledgeApi.listAll('confirmed', 100),
  });
  const [answering, setAnswering] = useState<Note | null>(null);
  const [answer, setAnswer] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['knowledge'] });
  const confirm = useMutation({
    mutationFn: (note: Note) => knowledgeApi.confirm(note.entityId, note.noteId),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (note: Note) => knowledgeApi.remove(note.entityId, note.noteId),
    onSuccess: refresh,
  });
  const reply = useMutation({
    mutationFn: (note: Note) =>
      knowledgeApi.add(note.entityId, { kind: 'meaning', text: answer, resolves: note.noteId }),
    onSuccess: () => {
      setAnswering(null);
      setAnswer('');
      void refresh();
    },
  });
  const busy = confirm.isPending || remove.isPending || reply.isPending;
  const questions = (drafts.data ?? []).filter((n) => n.kind === 'question');
  const readings = (drafts.data ?? []).filter((n) => n.kind !== 'question');
  const error = drafts.error ?? confirmed.error ?? confirm.error ?? remove.error ?? reply.error;

  const section = (
    title: string,
    help: string,
    notes: Note[],
    loading: boolean,
    empty: string,
    testId: string
  ) => (
    <Panel title={title} description={help} actions={<Chip size="small" label={notes.length} />}>
      <Box data-testid={testId}>
        {loading ? (
          <Skeleton variant="rounded" height={72} />
        ) : notes.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {empty}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {groupByEntity(notes).map(([entityId, group]) => (
              <EntityGroup
                key={entityId}
                entityId={entityId}
                notes={group}
                busy={busy}
                onConfirm={(n) => confirm.mutate(n)}
                onRemove={(n) => remove.mutate(n)}
                onAnswer={(n) => setAnswering(n)}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Panel>
  );

  return (
    <Stack spacing={2} data-testid="knowledge-view">
      {error && <Alert severity="error">{getApiErrorMessage(error, 'Something failed')}</Alert>}
      {answering && (
        <Panel title="Answer a question">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {answering.text}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {answering.entityId}
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            sx={{ mt: 1 }}
            placeholder="Your answer, in your words; it is kept on that thing and the question closes"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => reply.mutate(answering)}
              disabled={!answer.trim() || busy}
            >
              Keep the answer
            </Button>
            <Button size="small" onClick={() => setAnswering(null)} disabled={busy}>
              Cancel
            </Button>
          </Stack>
        </Panel>
      )}
      {section(
        'Questions to answer',
        'What a model could not tell from a definition and only a person can: answer it once and it is known.',
        questions,
        drafts.isLoading,
        'No open questions. Learn an asset in the editor, or run the "Learn what they are for" playbook.',
        'knowledge-questions'
      )}
      {section(
        'Readings to confirm',
        'What a model read into an asset or a visual. Confirm what is right, remove what is not; nothing reaches the planner until it is confirmed.',
        readings,
        drafts.isLoading,
        'Nothing waits for confirmation.',
        'knowledge-readings'
      )}
      {section(
        'Known',
        'What people said and what the portal did, newest first. The assistant and the planner read this.',
        confirmed.data ?? [],
        confirmed.isLoading,
        'Nothing yet. What you tell the assistant, confirm here, or change through the portal lands here.',
        'knowledge-known'
      )}
    </Stack>
  );
}
