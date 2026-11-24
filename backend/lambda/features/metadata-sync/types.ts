/**
 * Metadata sync: the words that say what a table and its columns mean, kept
 * the same in every catalog that shows them.
 *
 * AWS keeps that text in more than one place and copies it nowhere: a Glue
 * table carries column comments and a description, a SageMaker Unified Studio
 * asset carries business names and descriptions, and an edit in one never
 * reaches the other. A table dropped and created again starts blank. Until
 * AWS offers one plane, this slice is the bridge: it keeps the text in the
 * portal's bucket, adopts an edit made in any place, and copies it to the
 * rest.
 *
 * Everything is told three ways: what the portal keeps, what each place
 * showed after the last sync, and what each place shows now. A place that
 * differs from what the sync left there was edited by hand.
 */

/** A place the text lives: `glue`, or `smus:<asset id>` for one asset of the table. */
export type SideId = string;
export type SideKind = 'glue' | 'smus';

export const GLUE_SIDE: SideId = 'glue';
export const smusSide = (assetId: string): SideId => `smus:${assetId}`;
export const kindOf = (side: SideId): SideKind => (side === GLUE_SIDE ? 'glue' : 'smus');

export type SyncField = 'description' | 'businessName';
export const SYNC_FIELDS: readonly SyncField[] = ['description', 'businessName'];

/** The key of the table's own text; every other key is a column name. */
export const TABLE_KEY = '#table';

/** What one place shows: per table or column, the text of each field it holds. */
export type Shown = Record<string, Partial<Record<SyncField, string>>>;

/** One kept text: what it says, where it was first written, and when it was taken. */
interface KeptText {
  value: string;
  from: SideKind | 'resolved';
  at: string;
  by?: string;
}

/** One line of a table's history: a text taken from a place, or a conflict settled. */
export interface RecordChange {
  at: string;
  key: string;
  field: SyncField;
  from: SideKind | 'resolved';
  value: string;
  replaced?: string;
  by?: string;
}

/**
 * What the portal keeps for one table. `left` is what each place showed when
 * the sync last finished there: the baseline a hand edit is told from.
 */
export interface TableRecord {
  version: 1;
  database: string;
  table: string;
  text: Record<string, Partial<Record<SyncField, KeptText>>>;
  left: Record<SideId, Shown>;
  history: RecordChange[];
  updatedAt: string;
}

/** A text found in one place and taken as the table's. */
export interface Adoption {
  key: string;
  field: SyncField;
  value: string;
  from: SideId;
  replaced?: string;
}

/** A field two places disagree on since the last sync; nothing is written until a person picks. */
export interface Conflict {
  key: string;
  field: SyncField;
  /** What the portal keeps now, when it keeps anything. */
  kept?: string;
  /** What each disagreeing place shows. */
  sides: Record<SideId, string>;
}

/** One field the sync writes, or would write, into one place. */
export interface FieldWrite {
  key: string;
  field: SyncField;
  value: string;
  was?: string;
}

type SideOutcome = 'written' | 'unchanged' | 'would-write' | 'missing' | 'skipped' | 'failed';

export interface SideResult {
  side: SideId;
  kind: SideKind;
  /** The asset or table as a person names it. */
  label: string;
  outcome: SideOutcome;
  writes: FieldWrite[];
  /** Why it failed, or why it was skipped. */
  error?: string;
}

export interface TableResult {
  database: string;
  table: string;
  adoptions: Adoption[];
  conflicts: Conflict[];
  sides: SideResult[];
}

export type SyncMode = 'preview' | 'run';

/** One pass over every table in scope: what was found and what was, or would be, written. */
export interface SyncReport {
  version: 1;
  mode: SyncMode;
  jobId?: string;
  startedBy?: string;
  startedAt: string;
  finishedAt: string;
  /** When the SMUS snapshot the pass read was taken. */
  snapshotAt: string;
  totals: {
    tables: number;
    adoptions: number;
    conflicts: number;
    writes: number;
    failed: number;
  };
  /** Only the tables with something to say: an adoption, a conflict, a write or a failure. */
  tables: TableResult[];
}
