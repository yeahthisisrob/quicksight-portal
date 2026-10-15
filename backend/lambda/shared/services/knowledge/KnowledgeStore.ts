/**
 * What the portal and its people know about the things in the account,
 * kept by graph entity id so it survives renames, copies and rebuilds. The
 * tokens spent understanding a thing are spent once: what a person said
 * and what the portal did are confirmed as written; what a model read into
 * a thing stays a draft until a person confirms it.
 *
 * Reads are bounded (newest first, a cap per entity) so a prompt built from
 * notes stays small, and every note says who said it and when.
 */
import { randomBytes } from 'node:crypto';

import type { NoteKind, NoteRow, NoteSource, NoteStatus } from '../store/portalTable';
import { portal } from '../store/portalTable';

export type { NoteKind, NoteStatus } from '../store/portalTable';

export interface Note {
  entityId: string;
  noteId: string;
  kind: NoteKind;
  text: string;
  source: NoteSource;
  status: NoteStatus;
  by: string;
  at: string;
  details?: Record<string, unknown>;
}

export interface NewNote {
  entityId: string;
  kind: NoteKind;
  text: string;
  source: NoteSource;
  /** Confirmed unless said otherwise; a model's reading is a draft. */
  status?: NoteStatus;
  by: string;
  at?: string;
  details?: Record<string, unknown>;
}

/** The most notes one entity returns, newest first. */
const MAX_NOTES_PER_ENTITY = 100;
/** The most notes a review across the account returns. */
const MAX_REVIEW = 500;
const MAX_TEXT = 2_000;
const RANDOM_BYTES = 4;

function rowToNote(row: NoteRow): Note {
  return {
    entityId: row.entityId,
    noteId: row.noteId,
    kind: row.kind,
    text: row.text,
    source: row.source,
    status: row.status,
    by: row.by,
    at: row.at,
    ...(row.details && typeof row.details === 'object'
      ? { details: row.details as Record<string, unknown> }
      : {}),
  };
}

export class KnowledgeStore {
  /** Keep a note; the id orders it after everything said before. */
  public async add(input: NewNote): Promise<Note> {
    const at = input.at ?? new Date().toISOString();
    const row: NoteRow = {
      entityId: input.entityId,
      noteId: `${at}-${randomBytes(RANDOM_BYTES).toString('hex')}`,
      kind: input.kind,
      text: input.text.trim().slice(0, MAX_TEXT),
      source: input.source,
      status: input.status ?? 'confirmed',
      by: input.by,
      at,
      ...(input.details ? { details: input.details } : {}),
    };
    await portal().note.put(row).go();
    return rowToNote(row);
  }

  /** Several at once (a write's change list, say); failures never reach the caller. */
  public async addAll(inputs: NewNote[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.add(input)));
  }

  /** An entity's notes, newest first, capped; confirmed only when asked. */
  public async list(
    entityId: string,
    options: { status?: NoteStatus; limit?: number } = {}
  ): Promise<Note[]> {
    const { data } = await portal().note.query.byEntity({ entityId }).go({ pages: 'all' });
    const limit = Math.min(options.limit ?? MAX_NOTES_PER_ENTITY, MAX_NOTES_PER_ENTITY);
    return data
      .map(rowToNote)
      .filter((n) => !options.status || n.status === options.status)
      .sort((a, b) => (a.noteId < b.noteId ? 1 : -1))
      .slice(0, limit);
  }

  /** Everything of a status across the account, newest first: what there is to review, or what is known. */
  public async listAll(status: NoteStatus, limit = MAX_REVIEW): Promise<Note[]> {
    const { data } = await portal()
      .note.query.byStatus({ status })
      .go({ order: 'desc', limit: Math.min(limit, MAX_REVIEW) });
    return data.map(rowToNote);
  }

  /** Confirmed notes across several entities, keyed by entity, for a prompt. */
  public async confirmedFor(entityIds: string[]): Promise<Map<string, Note[]>> {
    const unique = [...new Set(entityIds)];
    const lists = await Promise.all(
      unique.map((id) => this.list(id, { status: 'confirmed' }).catch(() => [] as Note[]))
    );
    return new Map(unique.map((id, i) => [id, lists[i]!]));
  }

  public async get(entityId: string, noteId: string): Promise<Note | null> {
    const { data } = await portal().note.get({ entityId, noteId }).go();
    return data ? rowToNote(data) : null;
  }

  /** A draft becomes a person's confirmed note, in the person's name, with their edit if any. */
  public async confirm(
    entityId: string,
    noteId: string,
    by: string,
    text?: string
  ): Promise<Note | null> {
    const current = await this.get(entityId, noteId);
    if (!current) return null;
    const patch = {
      status: 'confirmed' as const,
      source: 'person' as const,
      by,
      ...(text?.trim() ? { text: text.trim().slice(0, MAX_TEXT) } : {}),
    };
    await portal().note.patch({ entityId, noteId }).set(patch).go();
    return { ...current, ...patch };
  }

  public async remove(entityId: string, noteId: string): Promise<void> {
    await portal().note.delete({ entityId, noteId }).go();
  }
}

export const knowledge = new KnowledgeStore();
