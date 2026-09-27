/**
 * The steps a spec can take on one asset. Each has a plan half (what it
 * would do, read live, changing nothing) and an apply half (do it). Plans
 * run in order and share what they found: a match step's matches are what
 * a rebind step rebinds and a tag step tags.
 */

import { normalFieldName } from '../../../../../shared/lib/expressionPlacement';
import { repairErrors } from '../catalog/repairErrors';
import { authoringPath } from '../portalPaths';
import type { ItemPlan, PlaybookContext, PlaybookTarget } from '../types';
import { applyFieldOps, planDropUnused, planRenameToStandard } from './calcHygiene';
import { applyRenameDatasetCalcs, planRenameDatasetCalcs } from './datasetCalcNames';
import { inferMatch, type Offered } from './inferMatch';
import { resolve, resolveBoolean, resolveText } from './inputs';
import { planReplaceMaterialised } from './materialisedCalcs';
import type { DatasetRef, SpecSession } from './session';
import type { MatchDatasetStep, SpecStep, TagStep } from './types';

export interface StepPlan {
  kind: SpecStep['kind'];
  verdict: ItemPlan['verdict'];
  summary: string;
  changes: string[];
  data?: unknown;
}

interface DatasetMatch {
  identifier: string;
  from: DatasetRef;
  to: DatasetRef;
  /** Used column name -> the candidate's column name, where they differ. */
  columnMap: Record<string, string>;
  how: 'exact' | 'inferred';
  confidence: number;
}

/** What earlier steps found, for the ones after them. */
export interface SpecState {
  matches: DatasetMatch[];
}

interface DefinitionDatasets {
  datasets: Array<{ identifier: string; dataSetId: string; columns: Array<{ name: string }> }>;
}

const MISSING_NAMED = 5;
/** Candidates whose columns are read for one dataset, the closest-named first. */
const MAX_CANDIDATES_READ = 25;
/** How many of the closest candidates a model is shown. */
const OFFERED = 3;
/** Inferred mappings below this go to review unless the spec asks otherwise. */
const DEFAULT_MIN_CONFIDENCE = 0.8;

/** Names that differ only in case, spacing or separators are the same column. */

/** Candidates ordered by how many name words they share with the dataset being replaced. */
function closestFirst<T extends { name: string }>(candidates: T[], name: string): T[] {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    );
  const mine = words(name);
  const shared = (c: T) => [...words(c.name)].filter((w) => mine.has(w)).length;
  return [...candidates].sort((a, b) => shared(b) - shared(a));
}

/** How well a candidate's columns cover the used ones, and the renames exact names need. */
function coverage(used: string[], columns: Array<{ name: string }>) {
  const byNormal = new Map(columns.map((c) => [normalFieldName(c.name), c.name]));
  const columnMap: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of used) {
    const found = byNormal.get(normalFieldName(name));
    if (!found) missing.push(name);
    else if (found !== name) columnMap[name] = found;
  }
  return { missing, columnMap };
}

async function planMatch(
  ctx: PlaybookContext,
  session: SpecSession,
  target: PlaybookTarget,
  step: MatchDatasetStep,
  state: SpecState
): Promise<StepPlan> {
  if (target.assetType !== 'dashboard' && target.assetType !== 'analysis') {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: 'Matching applies to dashboards and analyses',
      changes: [],
    };
  }
  const engine = resolveText(step.engine, ctx.params).toUpperCase();
  const governed = step.governed === undefined ? false : resolveBoolean(step.governed, ctx.params);
  const suits = (c: { engines: string[]; governed: boolean }) =>
    (!engine || c.engines.includes(engine)) && (!governed || c.governed);

  const [definition, candidates] = await Promise.all([
    ctx.call<DefinitionDatasets>('GET', `${authoringPath(target)}/datasets`),
    session.candidates(),
  ]);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const wanted = candidates.filter(suits);
  const need = [engine ? engine : '', governed ? 'SMUS-governed' : ''].filter(Boolean).join(', ');

  const changes: string[] = [];
  const doubts: string[] = [];
  for (const dataset of definition.datasets) {
    const current = byId.get(dataset.dataSetId);
    if (current && suits(current)) continue;
    const used = dataset.columns.map((c) => c.name);
    const scored: Array<Offered & { columnMap: Record<string, string>; missing: string[] }> = [];
    for (const candidate of closestFirst(wanted, current?.name ?? dataset.dataSetId).slice(
      0,
      MAX_CANDIDATES_READ
    )) {
      if (candidate.id === dataset.dataSetId) continue;
      const { columns } = await session.columns(candidate.id);
      scored.push({
        to: { id: candidate.id, name: candidate.name },
        columns,
        ...coverage(used, columns),
      });
      if (scored.at(-1)!.missing.length === 0) break;
    }
    scored.sort((a, b) => a.missing.length - b.missing.length);
    const best = scored[0];
    const from = { id: dataset.dataSetId, name: current?.name ?? dataset.dataSetId };
    if (best && best.missing.length > 0 && resolveBoolean(step.infer, ctx.params)) {
      const inferred = await inferMatch(
        ctx,
        session,
        from,
        used,
        scored.slice(0, OFFERED),
        confidenceOf(step, ctx.params)
      );
      if (inferred.match) {
        state.matches.push({
          identifier: dataset.identifier,
          from,
          to: inferred.match.to,
          columnMap: inferred.match.columnMap,
          how: 'inferred',
          confidence: inferred.match.confidence,
        });
        changes.push(
          `${from.name} → ${inferred.match.to.name} (inferred, confidence ${inferred.match.confidence.toFixed(2)}${inferred.match.notes.length ? `: ${inferred.match.notes.join('; ')}` : ''})`
        );
      } else {
        doubts.push(`${from.name}: ${inferred.doubt}`);
      }
      continue;
    }
    if (best && best.missing.length === 0) {
      state.matches.push({
        identifier: dataset.identifier,
        from,
        to: best.to,
        columnMap: best.columnMap,
        how: 'exact',
        confidence: 1,
      });
      changes.push(`${from.name} → ${best.to.name} (all ${used.length} columns)`);
    } else if (best) {
      doubts.push(
        `${from.name}: closest is ${best.to.name}, missing ${best.missing.slice(0, MISSING_NAMED).join(', ')}${best.missing.length > MISSING_NAMED ? ` and ${best.missing.length - MISSING_NAMED} more` : ''}`
      );
    } else {
      doubts.push(`${from.name}: no ${need || 'other'} dataset to move to`);
    }
  }
  if (changes.length === 0 && doubts.length === 0) {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: `Already reads ${need || 'suitable'} datasets`,
      changes: [],
    };
  }
  if (doubts.length > 0) {
    return { kind: step.kind, verdict: 'review', summary: doubts.join('; '), changes };
  }
  return {
    kind: step.kind,
    verdict: 'change',
    summary: `${changes.length} dataset${changes.length === 1 ? '' : 's'} matched`,
    changes,
  };
}

async function planRebind(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  state: SpecState
): Promise<StepPlan> {
  if (state.matches.length === 0) {
    return {
      kind: 'rebind',
      verdict: 'skip',
      summary: 'Nothing matched to rebind onto',
      changes: [],
    };
  }
  const rebinds = state.matches.map((m) => ({
    identifier: m.identifier,
    targetDataSetId: m.to.id,
    ...(Object.keys(m.columnMap).length ? { columnMap: m.columnMap } : {}),
  }));
  const plan = await ctx.call<{
    canApply: boolean;
    datasets: Array<{ identifier: string; columns: Array<{ name: string; status: string }> }>;
  }>('POST', `${authoringPath(target)}/rebind/plan`, { rebinds });
  const changes = state.matches.map((m) => `Rebind ${m.identifier}: ${m.from.name} → ${m.to.name}`);
  if (!plan.canApply) {
    const missing = plan.datasets.flatMap((d) =>
      d.columns.filter((c) => c.status === 'missing').map((c) => `${d.identifier}.${c.name}`)
    );
    return {
      kind: 'rebind',
      verdict: 'review',
      summary: `The rebind would not resolve ${missing.slice(0, MISSING_NAMED).join(', ') || 'every column'}`,
      changes,
    };
  }
  return {
    kind: 'rebind',
    verdict: 'change',
    summary: 'Rebind checked',
    changes,
    data: { rebinds },
  };
}

async function tagTargets(
  session: SpecSession,
  target: PlaybookTarget,
  step: TagStep,
  state: SpecState
): Promise<Array<{ type: string; id: string; name: string; note?: string }>> {
  if (step.target === 'asset') {
    return [{ type: target.assetType, id: target.assetId, name: target.name }];
  }
  const replaced = state.matches.map((m) => m.from);
  if (step.target === 'replaced-datasets') {
    return replaced.map((d) => ({ type: 'dataset', id: d.id, name: d.name }));
  }
  const sources = new Map<string, { type: string; id: string; name: string; note?: string }>();
  const replacedIds = new Set(replaced.map((d) => d.id));
  for (const dataset of replaced) {
    for (const source of await session.sourcesOf(dataset.id)) {
      if (sources.has(source.id)) continue;
      // Tagging is only a marker; say what still reads it, so nobody retires it too soon.
      const others = (await session.readersOf(source.id)).filter((d) => !replacedIds.has(d.id));
      sources.set(source.id, {
        type: 'datasource',
        id: source.id,
        name: source.name,
        ...(others.length
          ? {
              note: `still read by ${others.length} other dataset${others.length === 1 ? '' : 's'}`,
            }
          : {}),
      });
    }
  }
  return [...sources.values()];
}

export async function planStep(
  ctx: PlaybookContext,
  session: SpecSession,
  target: PlaybookTarget,
  step: SpecStep,
  state: SpecState
): Promise<StepPlan> {
  switch (step.kind) {
    case 'matchDataset':
      return await planMatch(ctx, session, target, step, state);
    case 'rebind':
      return await planRebind(ctx, target, state);
    case 'tag': {
      const key = resolveText(step.key, ctx.params);
      const value = resolveText(step.value, ctx.params);
      const targets = await tagTargets(session, target, step, state);
      if (!key || targets.length === 0) {
        return { kind: 'tag', verdict: 'skip', summary: 'Nothing to tag', changes: [] };
      }
      if (!value) {
        // QuickSight refuses an empty tag value; an input left blank is a question, not a tag.
        return {
          kind: 'tag',
          verdict: 'review',
          summary: `The tag ${key} has no value (an input left empty?)`,
          changes: [],
        };
      }
      return {
        kind: 'tag',
        verdict: 'change',
        summary: `Tag ${targets.length} ${key}=${value}`,
        changes: targets.map(
          (t) => `Tag ${t.type} ${t.name} ${key}=${value}${t.note ? ` (${t.note})` : ''}`
        ),
        data: { key, value, targets },
      };
    }
    case 'addToFolder': {
      const folderId = resolveText(step.folder, ctx.params);
      if (!folderId) {
        return { kind: 'addToFolder', verdict: 'review', summary: 'No folder chosen', changes: [] };
      }
      const folder = await session.folder(folderId);
      const memberType = target.assetType.toUpperCase();
      if (folder.members.has(`${memberType}:${target.assetId}`)) {
        return {
          kind: 'addToFolder',
          verdict: 'skip',
          summary: `Already in ${folder.name}`,
          changes: [],
        };
      }
      return {
        kind: 'addToFolder',
        verdict: 'change',
        summary: `Add to ${folder.name}`,
        changes: [`Add to folder ${folder.name}`],
        data: { folderId, memberType },
      };
    }
    case 'replaceMaterialisedCalcs':
      return await planReplaceMaterialised(ctx, session, target, step);
    case 'dropUnusedCalcs':
      return await planDropUnused(ctx, target, step);
    case 'renameCalcsToStandard':
      return await planRenameToStandard(ctx, target, step);
    case 'renameDatasetCalcsToStandard':
      return await planRenameDatasetCalcs(ctx, target, step);
    case 'repair': {
      const plan = await repairErrors.plan(ctx, target);
      return {
        kind: 'repair',
        verdict: plan.verdict,
        summary: plan.summary,
        changes: plan.changes ?? [],
        data: plan,
      };
    }
    default:
      return {
        kind: (step as SpecStep).kind,
        verdict: 'skip',
        summary: 'Unknown step',
        changes: [],
      };
  }
}

export async function applyStep(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  plan: StepPlan
): Promise<string> {
  switch (plan.kind) {
    case 'rebind': {
      const { rebinds } = plan.data as { rebinds: unknown[] };
      const result = await ctx.call<{ versionNumber?: number }>(
        'POST',
        `${authoringPath(target)}/rebind`,
        {
          mode: 'update',
          rebinds,
        }
      );
      return `Rebound${result.versionNumber ? ` (version ${result.versionNumber})` : ''}`;
    }
    case 'tag': {
      const { key, value, targets } = plan.data as {
        key: string;
        value: string;
        targets: Array<{ type: string; id: string }>;
      };
      for (const t of targets) {
        await ctx.call('POST', `/api/tags/${t.type}/${encodeURIComponent(t.id)}`, {
          tags: [{ key, value }],
        });
      }
      return `Tagged ${targets.length}`;
    }
    case 'addToFolder': {
      const { folderId, memberType } = plan.data as { folderId: string; memberType: string };
      await ctx.call('POST', `/api/folders/${encodeURIComponent(folderId)}/members`, {
        memberId: target.assetId,
        memberType,
      });
      return 'Added to the folder';
    }
    case 'replaceMaterialisedCalcs':
      return await applyFieldOps(ctx, target, plan, 'Replaced');
    case 'dropUnusedCalcs':
      return await applyFieldOps(ctx, target, plan, 'Dropped');
    case 'renameCalcsToStandard':
      return await applyFieldOps(ctx, target, plan, 'Renamed');
    case 'renameDatasetCalcsToStandard':
      return await applyRenameDatasetCalcs(ctx, target, plan);
    case 'repair':
      return (await repairErrors.apply(ctx, target, plan.data as ItemPlan)).summary;
    default:
      // A match step only plans; what it found is applied by the steps after it.
      return '';
  }
}

/** The confidence an inferred mapping needs, 0-1. */
function confidenceOf(step: MatchDatasetStep, params: Record<string, unknown>): number {
  const value = Number(resolve(step.minConfidence, params));
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : DEFAULT_MIN_CONFIDENCE;
}
