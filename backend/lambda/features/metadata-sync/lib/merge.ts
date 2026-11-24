/**
 * The three-way merge, pure: what the portal keeps, what each place showed
 * after the last sync, and what each place shows now go in; what to adopt,
 * what conflicts and what each place should show come out.
 *
 * The rules, per field of the table or of one column:
 *
 * - A place is **edited** when it shows text that is neither what the sync
 *   would write there nor what the sync left there.
 * - One edit, or several that agree, is **adopted**: it becomes the kept text
 *   and is copied everywhere else.
 * - Edits that disagree are a **conflict**. So is text in a place the sync
 *   has never written, when the portal already keeps something else. A
 *   conflict writes nothing, anywhere, until a person picks.
 * - An empty field is never an edit: text is not lost because a copy lost it.
 *   That is what puts the words back on a table that was dropped and created
 *   again.
 */
import {
  type Adoption,
  type Conflict,
  type FieldWrite,
  kindOf,
  type RecordChange,
  type Shown,
  type SideId,
  SYNC_FIELDS,
  type SyncField,
  TABLE_KEY,
  type TableRecord,
} from '../types';

/** Glue's own limits: a column comment and a table description. */
export const GLUE_COMMENT_MAX = 255;
const GLUE_DESCRIPTION_MAX = 2048;
/** How many changes a table's record remembers. */
const HISTORY_MAX = 50;

const cut = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/**
 * A kept text as one place would show it, or undefined when the place has
 * nowhere to put that field. Glue cuts long text and has no business names:
 * those live in SMUS alone, and are kept so a recreated asset gets them back.
 */
export function shownAs(
  side: SideId,
  key: string,
  field: SyncField,
  value: string
): string | undefined {
  if (kindOf(side) === 'smus') {
    return value;
  }
  if (field === 'businessName') {
    return undefined;
  }
  return cut(value, key === TABLE_KEY ? GLUE_DESCRIPTION_MAX : GLUE_COMMENT_MAX);
}

export interface MergeResult {
  /** The record as it stands once the adoptions are taken; baselines are not moved here. */
  record: TableRecord;
  adoptions: Adoption[];
  conflicts: Conflict[];
  /** Per place read, the fields whose text differs from what should be there. */
  writes: Record<SideId, FieldWrite[]>;
}

export function emptyRecord(database: string, table: string, now: string): TableRecord {
  return { version: 1, database, table, text: {}, left: {}, history: [], updatedAt: now };
}

const textOf = (shown: Shown | undefined, key: string, field: SyncField): string | undefined =>
  shown?.[key]?.[field]?.trim() || undefined;

/** Every table-or-column key any place or the record names, the table first. */
function keysOf(record: TableRecord, shown: Record<SideId, Shown>): string[] {
  const keys = new Set<string>(Object.keys(record.text));
  for (const side of Object.values(shown)) {
    for (const key of Object.keys(side)) keys.add(key);
  }
  return [...keys].sort((a, b) =>
    a === TABLE_KEY ? -1 : b === TABLE_KEY ? 1 : a.localeCompare(b)
  );
}

/**
 * Merge one table. `shown` holds only the places that were read: a place
 * that is missing or could not be read is absent, and is neither read for
 * edits nor written.
 */
export function mergeTable(
  current: TableRecord,
  shown: Record<SideId, Shown>,
  now: string
): MergeResult {
  const record: TableRecord = structuredClone(current);
  const adoptions: Adoption[] = [];
  const conflicts: Conflict[] = [];
  const writes: Record<SideId, FieldWrite[]> = Object.fromEntries(
    Object.keys(shown).map((side) => [side, [] as FieldWrite[]])
  );
  const history: RecordChange[] = [];

  for (const key of keysOf(record, shown)) {
    for (const field of SYNC_FIELDS) {
      const kept = record.text[key]?.[field]?.value;
      const edits: Array<{ side: SideId; value: string; known: boolean }> = [];
      for (const [side, sideShown] of Object.entries(shown)) {
        const value = textOf(sideShown, key, field);
        if (!value || (kept !== undefined && shownAs(side, key, field, kept) === undefined)) {
          continue;
        }
        if (kept !== undefined && value === shownAs(side, key, field, kept)) {
          continue;
        }
        const left = textOf(record.left[side], key, field);
        if (left !== undefined && value === left) {
          continue;
        }
        edits.push({ side, value, known: left !== undefined });
      }

      const distinct = new Set(edits.map((e) => e.value));
      // Text in a place the sync never wrote, against text already kept, is not known to be newer.
      const unproven = kept !== undefined && edits.some((e) => !e.known);
      if (distinct.size > 1 || (distinct.size === 1 && unproven)) {
        conflicts.push({
          key,
          field,
          ...(kept !== undefined ? { kept } : {}),
          sides: Object.fromEntries(edits.map((e) => [e.side, e.value])),
        });
        continue;
      }

      let value = kept;
      if (distinct.size === 1) {
        const edit = edits[0] as (typeof edits)[number];
        value = edit.value;
        adoptions.push({
          key,
          field,
          value,
          from: edit.side,
          ...(kept !== undefined ? { replaced: kept } : {}),
        });
        record.text[key] = {
          ...record.text[key],
          [field]: { value, from: kindOf(edit.side), at: now },
        };
        history.push({
          at: now,
          key,
          field,
          from: kindOf(edit.side),
          value,
          ...(kept !== undefined ? { replaced: kept } : {}),
        });
      }
      if (value === undefined) {
        continue;
      }
      for (const [side, sideShown] of Object.entries(shown)) {
        const wanted = shownAs(side, key, field, value);
        const was = textOf(sideShown, key, field);
        if (wanted !== undefined && wanted !== was) {
          writes[side]?.push({ key, field, value: wanted, ...(was ? { was } : {}) });
        }
      }
    }
  }

  if (history.length > 0) {
    record.history = [...history.reverse(), ...record.history].slice(0, HISTORY_MAX);
    record.updatedAt = now;
  }
  return { record, adoptions, conflicts, writes };
}

/**
 * The baseline for one place once the sync has finished there: what it shows
 * now, except for a field in conflict, whose baseline stays where it was so
 * the disagreement is still seen on the next pass.
 */
export function baselineAfter(
  before: Shown | undefined,
  shownNow: Shown,
  conflicts: readonly Conflict[],
  side: SideId
): Shown {
  const next: Shown = structuredClone(shownNow);
  for (const conflict of conflicts) {
    if (!(side in conflict.sides)) {
      continue;
    }
    const previous = before?.[conflict.key]?.[conflict.field];
    const entry = { ...next[conflict.key] };
    if (previous === undefined) {
      delete entry[conflict.field];
    } else {
      entry[conflict.field] = previous;
    }
    next[conflict.key] = entry;
  }
  return next;
}

/** What a place shows once `writes` are applied to what it showed. */
export function applyWrites(shown: Shown, writes: readonly FieldWrite[]): Shown {
  const next: Shown = structuredClone(shown);
  for (const write of writes) {
    next[write.key] = { ...next[write.key], [write.field]: write.value };
  }
  return next;
}

/**
 * A person's pick for a conflict: the value becomes the kept text, and what
 * each place showed when they picked becomes its baseline, so the next pass
 * copies the pick over them instead of reading them as edits again.
 */
export function resolveConflict(
  current: TableRecord,
  pick: { key: string; field: SyncField; value: string; sides: Record<SideId, string>; by: string },
  now: string
): TableRecord {
  const record: TableRecord = structuredClone(current);
  const replaced = record.text[pick.key]?.[pick.field]?.value;
  record.text[pick.key] = {
    ...record.text[pick.key],
    [pick.field]: { value: pick.value, from: 'resolved', at: now, by: pick.by },
  };
  for (const [side, value] of Object.entries(pick.sides)) {
    const left = { ...record.left[side] };
    left[pick.key] = { ...left[pick.key], [pick.field]: value };
    record.left[side] = left;
  }
  record.history = [
    {
      at: now,
      key: pick.key,
      field: pick.field,
      from: 'resolved' as const,
      value: pick.value,
      by: pick.by,
      ...(replaced !== undefined ? { replaced } : {}),
    },
    ...record.history,
  ].slice(0, HISTORY_MAX);
  record.updatedAt = now;
  return record;
}
