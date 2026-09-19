/**
 * PlannerService - "make this dashboard read from the gold dataset" in, a
 * validated proposal out.
 *
 * Model proposes, code decides. The model is asked exactly two narrow
 * questions, each answered as JSON against a flat schema:
 *
 *   1. Which dataset(s) should each identifier read from, and is this a copy
 *      or an in-place change? (It picks from a list the account actually has.)
 *   2. Only if the server's dry run leaves columns unresolved: which target
 *      column does each unresolved source column mean? (It picks from the
 *      target's unused columns, or says it cannot.)
 *
 * Everything else - what the definition references, whether the target
 * satisfies it, the rewrite itself - is deterministic code in RebindService,
 * and the same `plan` the UI shows is what comes back here. The proposal is
 * never applied by this service; a person, a CLI or an agent reads the plan
 * and calls apply.
 *
 * Schemas are flat with every field required and '' meaning "none": the
 * structured-output grammars behind several providers cap optional and
 * union-typed fields, and a rejected request is worse than a sentinel.
 */

import { ValidationError } from '../../../../shared/errors/ValidationError';
import { cacheService } from '../../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../../shared/types/assetFilterTypes';
import { ASSET_TYPES } from '../../../../shared/types/assetTypes';
import { logger } from '../../../../shared/utils/logger';
import {
  applyOps,
  type DefinitionOp,
  EDITABLE_VISUAL_TYPES,
  parseOps,
} from '../../lib/definitionOps';
import type { SheetOutline } from '../../lib/definitionOutline';
import type {
  ApplyMode,
  AuthorableAssetType,
  DefinitionDataset,
  Proposal,
  ProposedRebind,
  ProposeRequest,
  RebindPlan,
  UnmappedColumn,
} from '../../types';
import type { RebindService } from '../RebindService';
import type { PlannerModel } from './PlannerModel';

export interface CandidateDataset {
  id: string;
  name: string;
}

export type CandidateLoader = () => Promise<CandidateDataset[]>;

const MAX_CANDIDATES = 400;
const MAX_ASK_LENGTH = 2000;
const CHOICE_MAX_TOKENS = 1024;
const MAPPING_MAX_TOKENS = 2048;
const EDITS_MAX_TOKENS = 2048;
const MAX_OPS = 40;

const PREAMBLE = `You help an analyst re-point Amazon QuickSight dashboards and analyses at different datasets.
A definition reads columns from one or more datasets, each declared under an identifier.
You never write QuickSight JSON. You answer narrow questions with JSON that fits the given schema, and deterministic code validates and applies the result.
Be literal about names: pick datasets and columns only from the lists you are given, using their exact ids and names. If the ask does not fit, say so rather than guessing.`;

const CHOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'mode', 'name', 'reason', 'rebinds', 'wantsEdits'],
  properties: {
    wantsEdits: {
      type: 'boolean',
      description: 'true when the ask includes layout or visual changes beyond datasets.',
    },
    intent: {
      type: 'string',
      enum: ['rebind', 'unclear'],
      description: 'rebind when the ask is to point this asset (or a copy) at other datasets',
    },
    mode: {
      type: 'string',
      enum: ['clone', 'update'],
      description:
        'clone = create a copy; update = change this asset in place. Default to clone unless the ask clearly says in place.',
    },
    name: {
      type: 'string',
      description:
        'Name for the result. Empty string keeps the current name (update) or lets the server pick (clone).',
    },
    reason: { type: 'string', description: 'One sentence.' },
    rebinds: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['identifier', 'targetDataSetId', 'reason'],
        properties: {
          identifier: { type: 'string', description: 'A declared identifier of this definition.' },
          targetDataSetId: { type: 'string', description: 'The id of a candidate dataset.' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

const MAPPING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mappings'],
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['identifier', 'source', 'target', 'reason'],
        properties: {
          identifier: { type: 'string' },
          source: {
            type: 'string',
            description: 'The unresolved source column, exactly as given.',
          },
          target: {
            type: 'string',
            description:
              'One of the available target columns, exactly as given, or empty string if none means the same thing.',
          },
          reason: { type: 'string', description: 'One sentence.' },
        },
      },
    },
  },
} as const;

interface Choice {
  intent: 'rebind' | 'unclear';
  mode: ApplyMode;
  name: string;
  reason: string;
  rebinds: ProposedRebind[];
  /** The ask also wants layout or visual changes, not only datasets. */
  wantsEdits: boolean;
}

/** Flat on purpose: every field required, '' or -1 meaning "not used". */
const EDITS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ops', 'reason'],
  properties: {
    reason: { type: 'string', description: 'One sentence, or why no edits apply.' },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'op',
          'sheetId',
          'elementId',
          'col',
          'row',
          'colSpan',
          'rowSpan',
          'visualType',
          'title',
          'name',
        ],
        properties: {
          op: {
            type: 'string',
            enum: ['move', 'resize', 'retype', 'retitle', 'remove', 'duplicate', 'renameSheet'],
          },
          sheetId: { type: 'string', description: 'A sheetId from the outline.' },
          elementId: {
            type: 'string',
            description: 'An elementId from the outline; "" for renameSheet.',
          },
          col: { type: 'integer', description: 'move/duplicate: 0-35, else -1.' },
          row: { type: 'integer', description: 'move/duplicate: 0 or more, else -1.' },
          colSpan: { type: 'integer', description: 'resize: 1-36, else -1.' },
          rowSpan: { type: 'integer', description: 'resize: 1 or more, else -1.' },
          visualType: {
            type: 'string',
            description: `retype: one of ${EDITABLE_VISUAL_TYPES.join(', ')}; else "".`,
          },
          title: { type: 'string', description: 'retitle/duplicate: the new title; else "".' },
          name: { type: 'string', description: 'renameSheet: the new name; else "".' },
        },
      },
    },
  },
} as const;

interface Mapping {
  identifier: string;
  source: string;
  target: string;
  reason: string;
}

export const defaultCandidateLoader: CandidateLoader = async () => {
  const entries = await cacheService.getCacheEntries({
    assetType: ASSET_TYPES.dataset,
    statusFilter: AssetStatusFilter.ACTIVE,
  });
  return entries
    .map((e) => ({ id: e.assetId, name: e.assetName }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export class PlannerService {
  public constructor(
    private readonly rebindService: RebindService,
    private readonly model: PlannerModel,
    private readonly loadCandidates: CandidateLoader = defaultCandidateLoader
  ) {}

  public async propose(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ProposeRequest
  ): Promise<Proposal> {
    const ask = request.ask?.trim() ?? '';
    if (!ask) {
      throw new ValidationError(
        'Say what you want done, e.g. "copy this onto the orders_gold dataset"'
      );
    }
    if (ask.length > MAX_ASK_LENGTH) {
      throw new ValidationError(`The ask must be at most ${MAX_ASK_LENGTH} characters`);
    }

    const [definition, candidates] = await Promise.all([
      this.rebindService.describeDatasets(assetType, assetId),
      this.candidates(request.candidateDataSetIds),
    ]);

    const choice = await this.chooseTargets(
      assetType,
      definition.name,
      definition.datasets,
      candidates,
      ask
    );
    const modelInfo = { provider: this.model.provider, model: '' };

    // Layout and visual edits are planned against the definition's outline,
    // then validated by applying them to a preview - an op that fails is
    // dropped with its reason logged rather than failing the whole proposal.
    const ops = choice.wantsEdits ? await this.planEdits(assetType, assetId, ask) : [];

    if (choice.intent === 'unclear' || (choice.rebinds.length === 0 && ops.length === 0)) {
      return {
        ask,
        intent: 'unclear',
        mode: choice.mode,
        reason: choice.reason,
        rebinds: [],
        unmapped: [],
        ops: [],
        plan: null,
        model: modelInfo,
      };
    }
    if (choice.rebinds.length === 0) {
      return {
        ask,
        intent: 'rebind',
        mode: choice.mode,
        name: choice.name.trim() || undefined,
        reason: choice.reason,
        rebinds: [],
        unmapped: [],
        ops,
        plan: null,
        model: modelInfo,
      };
    }

    let plan = await this.rebindService.plan(assetType, assetId, choice.rebinds);
    let unmapped: UnmappedColumn[] = [];

    if (!plan.canApply) {
      const mappings = await this.mapColumns(plan, ask);
      const rebinds = choice.rebinds.map((r) => ({
        ...r,
        columnMap: Object.fromEntries(
          mappings
            .filter((m) => m.identifier === r.identifier && m.target)
            .map((m) => [m.source, m.target])
        ),
      }));
      choice.rebinds = rebinds;
      unmapped = mappings
        .filter((m) => !m.target)
        .map((m) => ({ identifier: m.identifier, column: m.source, reason: m.reason }));
      plan = await this.rebindService.plan(assetType, assetId, rebinds);
    }

    const name =
      choice.name.trim() || (choice.mode === 'clone' ? `${definition.name} (copy)` : undefined);
    logger.info('Planner proposal', {
      assetType,
      assetId,
      provider: this.model.provider,
      mode: choice.mode,
      rebinds: choice.rebinds.length,
      canApply: plan.canApply,
      unmapped: unmapped.length,
    });

    return {
      ask,
      intent: 'rebind',
      mode: choice.mode,
      name,
      reason: choice.reason,
      rebinds: choice.rebinds,
      unmapped,
      ops,
      plan,
      model: modelInfo,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 3: layout and visual edits, as ops against the outline
  // ---------------------------------------------------------------------------

  private async planEdits(
    assetType: AuthorableAssetType,
    assetId: string,
    ask: string
  ): Promise<DefinitionOp[]> {
    const outline = await this.rebindService.loadDefinitionOutline(assetType, assetId);
    const user = [
      'The sheets of the definition, with the ids you must use:',
      JSON.stringify(outline),
      '',
      `The ask: ${JSON.stringify(ask)}`,
      '',
      'Express the layout and visual changes the ask wants as ops. The grid is 36 columns wide; rows grow downward. Use only ids from the outline. Change a visual type only between BarChart, ColumnChart, LineChart, PieChart, DonutChart, Table and PivotTable. If the ask wants no such change, return an empty list.',
    ].join('\n');

    const result = await this.model.complete({
      label: 'plan-edits',
      system: PREAMBLE,
      user,
      schemaName: 'plan_edits',
      schemaDescription: 'Layout and visual edits as ops.',
      schema: EDITS_SCHEMA,
      maxTokens: EDITS_MAX_TOKENS,
    });

    const ops = parseEditOps(result.output, outline);
    return this.validateOps(assetType, assetId, ops);
  }

  /** Keep only ops the definition accepts, in order; log the rest. */
  private async validateOps(
    assetType: AuthorableAssetType,
    assetId: string,
    ops: DefinitionOp[]
  ): Promise<DefinitionOp[]> {
    if (ops.length === 0) {
      return [];
    }
    const preview = await this.rebindService.preview(assetType, assetId, { rebinds: [] });
    const kept: DefinitionOp[] = [];
    for (const op of ops) {
      try {
        applyOps(preview.definition, [...kept, op]);
        kept.push(op);
      } catch (error) {
        logger.warn('Planner op dropped', { op, error: (error as Error).message });
      }
    }
    return kept;
  }

  private async candidates(restrictTo?: string[]): Promise<CandidateDataset[]> {
    const all = await this.loadCandidates();
    const allowed = restrictTo?.length ? new Set(restrictTo) : null;
    const list = allowed ? all.filter((c) => allowed.has(c.id)) : all;
    if (list.length === 0) {
      throw new ValidationError('No datasets are available to choose from');
    }
    return list.slice(0, MAX_CANDIDATES);
  }

  // ---------------------------------------------------------------------------
  // Step 1: which dataset, copy or in place
  // ---------------------------------------------------------------------------

  private async chooseTargets(
    assetType: AuthorableAssetType,
    assetName: string,
    datasets: DefinitionDataset[],
    candidates: CandidateDataset[],
    ask: string
  ): Promise<Choice> {
    const user = [
      `The ${assetType} "${assetName}" declares these datasets:`,
      JSON.stringify(
        datasets.map((d) => ({
          identifier: d.identifier,
          currentDataSetId: d.dataSetId,
          columnsUsed: d.columns.map((c) => c.name),
        }))
      ),
      '',
      'Datasets in the account (id and name):',
      JSON.stringify(candidates),
      '',
      `The ask: """${ask}"""`,
      '',
      'Decide which identifier(s) should read from which candidate dataset, and whether to make a copy or change it in place. Also say whether the ask wants layout or visual changes (moving, resizing, retitling, removing, duplicating or retyping visuals, renaming sheets); those are planned separately.',
    ].join('\n');

    const result = await this.model.complete({
      label: 'choose-target',
      system: PREAMBLE,
      user,
      schemaName: 'choose_target',
      schemaDescription: 'The datasets to rebind and how.',
      schema: CHOICE_SCHEMA,
      maxTokens: CHOICE_MAX_TOKENS,
    });

    return parseChoice(
      result.output,
      new Set(datasets.map((d) => d.identifier)),
      new Set(candidates.map((c) => c.id))
    );
  }

  // ---------------------------------------------------------------------------
  // Step 2: only what the dry run could not resolve
  // ---------------------------------------------------------------------------

  private async mapColumns(plan: RebindPlan, ask: string): Promise<Mapping[]> {
    const unresolved = plan.datasets
      .map((d) => ({
        identifier: d.identifier,
        targetDataSet: d.target.name,
        unresolved: d.columns
          .filter((c) => c.status === 'suggested' || c.status === 'missing')
          .map((c) => ({ source: c.name, suggestion: c.suggestion ?? '', usedBy: c.usage })),
        availableTargetColumns: d.unusedTargetColumns,
      }))
      .filter((d) => d.unresolved.length > 0);

    const user = [
      'The dry run could not match these source columns to the new dataset:',
      JSON.stringify(unresolved),
      '',
      `The original ask, for context: """${ask}"""`,
      '',
      'For every unresolved source column, name the available target column that means the same thing, or "" if none does. Never invent a column.',
    ].join('\n');

    const result = await this.model.complete({
      label: 'map-columns',
      system: PREAMBLE,
      user,
      schemaName: 'map_columns',
      schemaDescription: 'Source-to-target column mapping for the unresolved columns.',
      schema: MAPPING_SCHEMA,
      maxTokens: MAPPING_MAX_TOKENS,
    });

    return parseMappings(result.output, unresolved);
  }
}

// -----------------------------------------------------------------------------
// Output validation. The model's answer is data from an untrusted source; only
// what passes these checks reaches RebindService.
// -----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function parseChoice(
  output: unknown,
  identifiers: Set<string>,
  candidateIds: Set<string>
): Choice {
  if (!isRecord(output)) {
    throw new ValidationError('The planner returned something that is not an object');
  }
  const intent = str(output, 'intent') === 'unclear' ? 'unclear' : 'rebind';
  const mode: ApplyMode = str(output, 'mode') === 'update' ? 'update' : 'clone';
  const rawRebinds = Array.isArray(output.rebinds) ? output.rebinds : [];

  const rebinds: ProposedRebind[] = [];
  const seen = new Set<string>();
  for (const raw of rawRebinds) {
    if (!isRecord(raw)) {
      continue;
    }
    const identifier = str(raw, 'identifier');
    const targetDataSetId = str(raw, 'targetDataSetId');
    if (!identifiers.has(identifier)) {
      throw new ValidationError(
        `The planner named an identifier this definition does not declare: '${identifier}'`
      );
    }
    if (!candidateIds.has(targetDataSetId)) {
      throw new ValidationError(
        `The planner chose a dataset that is not a candidate: '${targetDataSetId}'`
      );
    }
    if (seen.has(identifier)) {
      continue;
    }
    seen.add(identifier);
    rebinds.push({ identifier, targetDataSetId, reason: str(raw, 'reason') });
  }

  return {
    intent,
    mode,
    name: str(output, 'name'),
    reason: str(output, 'reason'),
    rebinds,
    wantsEdits: output.wantsEdits === true,
  };
}

/** Turn the flat, sentinel-laden edit answer into typed ops the library validates. */
export function parseEditOps(output: unknown, outline: SheetOutline[]): DefinitionOp[] {
  if (!isRecord(output) || !Array.isArray(output.ops)) {
    return [];
  }
  const sheetIds = new Set(outline.map((s) => s.sheetId));
  const raw: unknown[] = output.ops.slice(0, MAX_OPS).flatMap((item): unknown[] => {
    if (!isRecord(item) || !sheetIds.has(str(item, 'sheetId'))) {
      return [];
    }
    const num = (key: string) =>
      typeof item[key] === 'number' && item[key] >= 0 ? item[key] : undefined;
    const text = (key: string) => str(item, key) || undefined;
    const base = {
      op: str(item, 'op'),
      sheetId: str(item, 'sheetId'),
      elementId: text('elementId'),
    };
    switch (base.op) {
      case 'move':
        return [{ ...base, col: num('col'), row: num('row') }];
      case 'resize':
        return [{ ...base, colSpan: num('colSpan'), rowSpan: num('rowSpan') }];
      case 'retype':
        return [{ ...base, visualType: text('visualType') }];
      case 'retitle':
        return [{ ...base, title: text('title') }];
      case 'duplicate':
        return [{ ...base, title: text('title'), col: num('col'), row: num('row') }];
      case 'remove':
        return [base];
      case 'renameSheet':
        return [{ op: 'renameSheet', sheetId: base.sheetId, name: text('name') }];
      default:
        return [];
    }
  });
  // One malformed op should not lose the others: parse them one at a time.
  return raw.flatMap((r) => {
    try {
      return parseOps([r]);
    } catch {
      return [];
    }
  });
}

export function parseMappings(
  output: unknown,
  unresolved: Array<{
    identifier: string;
    unresolved: Array<{ source: string }>;
    availableTargetColumns: string[];
  }>
): Mapping[] {
  if (!isRecord(output) || !Array.isArray(output.mappings)) {
    throw new ValidationError('The planner returned no column mappings');
  }
  const byIdentifier = new Map(unresolved.map((u) => [u.identifier, u]));
  const mappings: Mapping[] = [];
  const seen = new Set<string>();

  for (const raw of output.mappings) {
    if (!isRecord(raw)) {
      continue;
    }
    const identifier = str(raw, 'identifier');
    const source = str(raw, 'source');
    const target = str(raw, 'target');
    const dataset = byIdentifier.get(identifier);
    if (!dataset?.unresolved.some((u) => u.source === source)) {
      // Not a column we asked about; ignore rather than fail the whole proposal.
      continue;
    }
    if (target && !dataset.availableTargetColumns.includes(target)) {
      throw new ValidationError(
        `The planner mapped '${source}' to '${target}', which the target dataset does not have`
      );
    }
    const key = `${identifier}.${source}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    mappings.push({ identifier, source, target, reason: str(raw, 'reason') });
  }

  // Anything the model skipped is reported as unmapped rather than silently dropped.
  for (const dataset of unresolved) {
    for (const column of dataset.unresolved) {
      const key = `${dataset.identifier}.${column.source}`;
      if (!seen.has(key)) {
        mappings.push({
          identifier: dataset.identifier,
          source: column.source,
          target: '',
          reason: 'The planner gave no answer for this column',
        });
      }
    }
  }
  return mappings;
}
