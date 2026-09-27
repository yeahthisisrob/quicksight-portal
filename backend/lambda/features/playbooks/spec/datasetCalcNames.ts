/**
 * Dataset calculated fields to the organisation's names (c_ds_ by default).
 *
 * Dashboards and analyses read a dataset's columns by name, so this is a
 * migration, one field at a time, each phase read from live state so a run
 * that stops anywhere resumes where it was:
 *
 *   copy     the dataset serves the field under both names;
 *   repoint  each dashboard and analysis reading the old name moves to the
 *            new one (a same-dataset rebind with a column map, dry-run
 *            first); on SPICE only once a refresh has loaded the new
 *            column, so a visual never reads a column with no data;
 *   retire   the old name goes once nothing reads it (the API re-reads
 *            every reader live and refuses otherwise).
 *
 * A reader tagged to opt out of playbooks holds its field back for review,
 * as does one that cannot be read. A run goes as far as it safely can: on
 * direct query the whole way; on SPICE it copies, and the next run (after
 * the refresh) moves the readers and retires the old name.
 */

import { errorMessage } from '../../../shared/utils/errorMessage';
import { OPT_OUT_TAG } from '../engine/gates';
import { authoringPath, datasetFieldsPath } from '../portalPaths';
import type { PlaybookContext, PlaybookTarget } from '../types';
import { DEFAULT_DATASET_CALC_PREFIX, standardName } from './calcHygiene';
import { resolveText } from './inputs';
import type { StepPlan } from './steps';
import type { RenameDatasetCalcsStep } from './types';

interface Reader {
  assetType: 'dashboard' | 'analysis';
  assetId: string;
  name: string;
  identifier: string;
}

interface LiveField {
  name: string;
  expression: string;
  readers?: Reader[];
}

interface LiveDataset {
  dataSetId: string;
  importMode: string;
  latestRefresh?: 'running' | 'completed' | 'failed' | 'none';
  fields: LiveField[];
  unreadable?: Array<{ assetType: string; name: string }>;
}

type Move =
  | { phase: 'copy'; from: string; to: string }
  | { phase: 'repoint'; from: string; to: string; readers: Reader[] }
  | { phase: 'retire'; from: string; to: string }
  | { phase: 'hold'; from: string; to: string; why: string };

/** copy, repoint, retire: a direct-query dataset finishes in three rounds. */
const MAX_ROUNDS = 3;

const live = (ctx: PlaybookContext, dataSetId: string) =>
  ctx.call<LiveDataset>('GET', `${datasetFieldsPath(dataSetId)}?readers=true`);

/** Where each field that is off-standard stands, from the dataset as it is now. */
export function movesOf(
  dataset: LiveDataset,
  prefix: string,
  optedOut: Set<string> = new Set()
): Move[] {
  const byName = new Map(dataset.fields.map((f) => [f.name, f]));
  const claimed = new Set<string>();
  const moves: Move[] = [];
  for (const field of dataset.fields) {
    const to = standardName(field.name, prefix);
    if (to === field.name) continue;
    const hold = (why: string) => moves.push({ phase: 'hold', from: field.name, to, why });
    if (claimed.has(to)) {
      hold(`another field is also becoming ${to}`);
      continue;
    }
    claimed.add(to);
    const copy = byName.get(to);
    const readers = field.readers ?? [];
    if (!copy) {
      moves.push({ phase: 'copy', from: field.name, to });
    } else if (copy.expression !== field.expression) {
      hold(`${to} already exists and computes something else`);
    } else if (dataset.unreadable?.length) {
      hold(
        `could not read ${dataset.unreadable.map((u) => `${u.assetType} ${u.name}`).join(', ')}`
      );
    } else if (readers.length === 0) {
      moves.push({ phase: 'retire', from: field.name, to });
    } else if (readers.some((r) => optedOut.has(`${r.assetType}:${r.assetId}`))) {
      hold(
        `${readers
          .filter((r) => optedOut.has(`${r.assetType}:${r.assetId}`))
          .map((r) => r.name)
          .join(', ')} opted out of playbooks`
      );
    } else if (dataset.importMode === 'SPICE' && dataset.latestRefresh !== 'completed') {
      hold(
        dataset.latestRefresh === 'failed'
          ? `the last refresh failed, so ${to} has no data yet`
          : `waiting for the refresh that loads ${to}; run again once it completes`
      );
    } else {
      moves.push({ phase: 'repoint', from: field.name, to, readers });
    }
  }
  return moves;
}

/** Readers carrying the opt-out tag, as `type:id`. */
async function optedOutReaders(ctx: PlaybookContext, dataset: LiveDataset): Promise<Set<string>> {
  const readers = new Map<string, Reader>();
  for (const field of dataset.fields) {
    for (const r of field.readers ?? []) readers.set(`${r.assetType}:${r.assetId}`, r);
  }
  const out = new Set<string>();
  await Promise.all(
    [...readers].map(async ([key, r]) => {
      const tags = await ctx.call<Array<{ key: string }>>(
        'GET',
        `/api/tags/${r.assetType}/${encodeURIComponent(r.assetId)}`
      );
      if ((tags ?? []).some((t) => t.key === OPT_OUT_TAG)) out.add(key);
    })
  );
  return out;
}

/** One rebind per reader asset: each identifier on the dataset, with the renames it needs. */
function rebindsByAsset(dataSetId: string, moves: Move[]) {
  const assets = new Map<
    string,
    { reader: Reader; rebinds: Map<string, Record<string, string>> }
  >();
  for (const move of moves) {
    if (move.phase !== 'repoint') continue;
    for (const r of move.readers) {
      const key = `${r.assetType}:${r.assetId}`;
      const asset = assets.get(key) ?? { reader: r, rebinds: new Map() };
      asset.rebinds.set(r.identifier, {
        ...(asset.rebinds.get(r.identifier) ?? {}),
        [move.from]: move.to,
      });
      assets.set(key, asset);
    }
  }
  return [...assets.values()].map(({ reader, rebinds }) => ({
    reader,
    rebinds: [...rebinds].map(([identifier, columnMap]) => ({
      identifier,
      targetDataSetId: dataSetId,
      columnMap,
    })),
  }));
}

type DatasetOp =
  | { op: 'copyCalculatedField'; name: string; to: string }
  | { op: 'retireCalculatedField'; name: string; replacedBy: string };

const datasetOps = (moves: Move[]): DatasetOp[] =>
  moves.flatMap((m): DatasetOp[] =>
    m.phase === 'copy'
      ? [{ op: 'copyCalculatedField', name: m.from, to: m.to }]
      : m.phase === 'retire'
        ? [{ op: 'retireCalculatedField', name: m.from, replacedBy: m.to }]
        : []
  );

function describe(move: Move): string {
  switch (move.phase) {
    case 'copy':
      return `Add ${move.to} beside ${move.from}`;
    case 'repoint':
      return `Move ${move.readers.map((r) => r.name).join(', ')} from ${move.from} to ${move.to}`;
    case 'retire':
      return `Remove ${move.from}; everything reads ${move.to}`;
    default:
      return `${move.from} → ${move.to} held: ${move.why}`;
  }
}

async function dryRun(ctx: PlaybookContext, dataSetId: string, moves: Move[]): Promise<string[]> {
  const refusals: string[] = [];
  const ops = datasetOps(moves);
  if (ops.length > 0) {
    await ctx
      .call('POST', datasetFieldsPath(dataSetId), { ops, dryRun: true })
      .catch((error) => refusals.push(`The dataset change was refused: ${errorMessage(error)}`));
  }
  for (const { reader, rebinds } of rebindsByAsset(dataSetId, moves)) {
    try {
      const preview = await ctx.call<{ plan?: { canApply?: boolean } }>(
        'POST',
        `${authoringPath(reader)}/rebind/preview`,
        { rebinds }
      );
      if (preview.plan?.canApply === false) {
        refusals.push(`${reader.name} would not resolve every column`);
      }
    } catch (error) {
      refusals.push(`${reader.name} was refused: ${errorMessage(error)}`);
    }
  }
  return refusals;
}

export async function planRenameDatasetCalcs(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  step: RenameDatasetCalcsStep
): Promise<StepPlan> {
  if (target.assetType !== 'dataset') {
    return { kind: step.kind, verdict: 'skip', summary: 'Applies to datasets', changes: [] };
  }
  const prefix = resolveText(step.prefix, ctx.params) || DEFAULT_DATASET_CALC_PREFIX;
  const dataset = await live(ctx, target.assetId);
  const moves = movesOf(dataset, prefix, await optedOutReaders(ctx, dataset));
  const held = moves.filter((m) => m.phase === 'hold');
  const actionable = moves.filter((m) => m.phase !== 'hold');
  if (moves.length === 0) {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: `Every calculated field starts ${prefix}`,
      changes: [],
    };
  }
  const heldText = held.map(describe).join('; ');
  if (actionable.length === 0) {
    const waiting = held.every((m) => m.phase === 'hold' && m.why.startsWith('waiting'));
    return {
      kind: step.kind,
      verdict: waiting ? 'skip' : 'review',
      summary: heldText,
      changes: [],
    };
  }
  const changes = actionable.map(describe);
  const refusals = await dryRun(ctx, target.assetId, actionable);
  if (refusals.length > 0) {
    return { kind: step.kind, verdict: 'review', summary: refusals.join('; '), changes };
  }
  return {
    kind: step.kind,
    verdict: 'change',
    summary: `${actionable.length} step${actionable.length === 1 ? '' : 's'} toward ${prefix} names${held.length ? `; held: ${heldText}` : ''}`,
    changes,
    data: { prefix, fields: [...new Set(actionable.map((m) => m.from))] },
  };
}

/**
 * Re-read live each round and take the next phase for the fields the plan
 * named, until nothing is left that can safely go now.
 */
export async function applyRenameDatasetCalcs(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  plan: StepPlan
): Promise<string> {
  const { prefix, fields: planned } = plan.data as { prefix: string; fields: string[] };
  const fields = new Set(planned);
  const done = { copied: 0, moved: 0, removed: 0 };
  let held: Move[] = [];
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const dataset = await live(ctx, target.assetId);
    const moves = movesOf(dataset, prefix, await optedOutReaders(ctx, dataset)).filter((m) =>
      fields.has(m.from)
    );
    held = moves.filter((m) => m.phase === 'hold');
    const copies = moves.filter((m) => m.phase === 'copy');
    const repoints = moves.filter((m) => m.phase === 'repoint');
    const retires = moves.filter((m) => m.phase === 'retire');
    if (copies.length + repoints.length + retires.length === 0) break;

    if (copies.length > 0) {
      await ctx.call('POST', datasetFieldsPath(target.assetId), { ops: datasetOps(copies) });
      done.copied += copies.length;
    }
    for (const { reader, rebinds } of rebindsByAsset(target.assetId, repoints)) {
      await ctx.call('POST', `${authoringPath(reader)}/rebind`, { mode: 'update', rebinds });
      done.moved += 1;
    }
    if (retires.length > 0) {
      await ctx.call('POST', datasetFieldsPath(target.assetId), { ops: datasetOps(retires) });
      done.removed += retires.length;
    }
  }
  const parts = [
    done.copied && `added ${done.copied} under the standard name`,
    done.moved && `moved ${done.moved} reader${done.moved === 1 ? '' : 's'}`,
    done.removed && `removed ${done.removed} old name${done.removed === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const text = parts.join(', ');
  const summary = text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : 'Nothing could move yet';
  return held.length ? `${summary}; ${held.map(describe).join('; ')}` : summary;
}
