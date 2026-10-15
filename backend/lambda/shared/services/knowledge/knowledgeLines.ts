/**
 * Notes as the lines a prompt or a person reads: one per note, newest
 * first, grouped under the entity they are about, with who said it. Pure.
 */
import type { Note, NoteKind } from './KnowledgeStore';

/** The kinds a planner should read: what things mean and how to build with them, never the change log. */
export const PLANNER_NOTE_KINDS: readonly NoteKind[] = [
  'meaning',
  'rule',
  'identity',
  'preference',
  'description',
];

const KIND_LABEL: Record<NoteKind, string> = {
  meaning: 'means',
  rule: 'rule',
  identity: 'identity',
  preference: 'preference',
  change: 'changed',
  description: 'is',
  question: 'open question',
};

function noteLine(note: Note): string {
  const when = note.at.slice(0, 'YYYY-MM-DD'.length);
  return `- (${KIND_LABEL[note.kind]}, ${note.by}, ${when}${note.status === 'draft' ? ', unconfirmed' : ''}) ${note.text}`;
}

/**
 * The notes for a set of entities as one block, with a heading naming each
 * entity, limited per entity; empty when there is nothing to say.
 */
export function knowledgeBlock(
  notesByEntity: Map<string, Note[]>,
  options: { kinds?: readonly NoteKind[]; perEntity?: number; label?: (id: string) => string } = {}
): string {
  const perEntity = options.perEntity ?? DEFAULT_PER_ENTITY;
  const sections: string[] = [];
  for (const [entityId, notes] of notesByEntity) {
    const kept = notes
      .filter((n) => !options.kinds || options.kinds.includes(n.kind))
      .slice(0, perEntity);
    if (kept.length === 0) continue;
    sections.push([`${options.label?.(entityId) ?? entityId}:`, ...kept.map(noteLine)].join('\n'));
  }
  return sections.length
    ? `What people have said about these (confirmed; use it, and do not contradict it):\n${sections.join('\n')}`
    : '';
}

const DEFAULT_PER_ENTITY = 12;
