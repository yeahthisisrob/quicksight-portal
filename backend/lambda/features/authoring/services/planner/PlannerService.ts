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

import {
  type AuthoringGuidance,
  type GuidanceFocus,
  guidanceSection,
} from '../../../../shared/ai/authoringGuidance';
import { vocabularySection } from '../../../../shared/ai/authoringVocabulary';
import { getSmusConfig } from '../../../../shared/config/smusConfig';
import { ValidationError } from '../../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../../shared/services/aws/ClientFactory';
import { CacheService, cacheService } from '../../../../shared/services/cache/CacheService';
import { SmusService } from '../../../../shared/services/smus/SmusService';
import { AssetStatusFilter } from '../../../../shared/types/assetFilterTypes';
import { ASSET_TYPES } from '../../../../shared/types/assetTypes';
import { logger } from '../../../../shared/utils/logger';
import {
  BUILDABLE_VISUAL_TYPES,
  type BuilderDataset,
  type FilterSpec,
  type VisualSpec,
} from '../../lib/definitionBuilder';
import {
  CONTROL_PLACEMENTS,
  type ControlPlacement,
  FILTER_CONTROLS,
  type FilterControlKind,
} from '../../lib/definitionFilters';
import {
  applyOps,
  type DefinitionOp,
  EDITABLE_VISUAL_TYPES,
  parseOps,
} from '../../lib/definitionOps';
import type { SheetOutline } from '../../lib/definitionOutline';
import { ACTION_KINDS, ACTION_TRIGGERS, type VisualActionSpec } from '../../lib/visualActions';
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

interface CandidateDataset {
  id: string;
  name: string;
  /** Set when the dataset reads a published SMUS listing (the Data Catalog's link). */
  governed?: { listing: string; project?: string };
}

/**
 * Which datasets read a published SMUS listing, and which listing and
 * project: the same links the Data Catalog shows. Empty when SMUS is off
 * or has not been exported; the planner then sees plain names.
 */
async function governedDatasetIndex(): Promise<Map<string, { listing: string; project?: string }>> {
  const index = new Map<string, { listing: string; project?: string }>();
  try {
    const config = getSmusConfig();
    if (!config.enabled) {
      return index;
    }
    const smus = new SmusService(
      CacheService.getInstance(),
      config,
      ClientFactory.getQuickSightService(process.env.AWS_ACCOUNT_ID || '')
    );
    for (const asset of (await smus.listAssets()).assets) {
      for (const dataset of asset.datasets) {
        if (!index.has(dataset.id)) {
          index.set(dataset.id, {
            listing: asset.name,
            ...(asset.projectName ? { project: asset.projectName } : {}),
          });
        }
      }
    }
  } catch (error) {
    logger.warn('Planner: SMUS links unavailable, candidates go unlabelled', { error });
  }
  return index;
}

/** Governed datasets first, so a long account never truncates them away. */
export function rankCandidates(
  datasets: Array<{ id: string; name: string }>,
  governed: Map<string, { listing: string; project?: string }>
): CandidateDataset[] {
  return datasets
    .map((d): CandidateDataset => {
      const link = governed.get(d.id);
      return link ? { ...d, governed: link } : d;
    })
    .sort(
      (a, b) =>
        Number(Boolean(b.governed)) - Number(Boolean(a.governed)) || a.name.localeCompare(b.name)
    );
}

type CandidateLoader = () => Promise<CandidateDataset[]>;

const MAX_CANDIDATES = 400;
/** Room for a precise brief, and the reasons a previous draft failed. */
const MAX_ASK_LENGTH = 4000;
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
      description: 'true when the ask includes layout, visual or filter changes beyond datasets.',
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
const VISUALS_MAX_TOKENS = 4096;
const MAX_PLANNED_VISUALS = 24;
const MAX_COLUMNS_PER_DATASET = 150;

/**
 * A filter, visual and action as the planner writes them. Flat, every
 * field required, '' / [] / false meaning "not used" (see the header).
 */
const FILTER_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: [
    'identifier',
    'column',
    'title',
    'control',
    'placement',
    'appliesTo',
    'values',
    'hasRange',
    'min',
    'max',
    'lastDays',
  ],
  properties: {
    identifier: { type: 'string' },
    column: { type: 'string' },
    title: { type: 'string', description: 'The control title; "" for the column name.' },
    control: {
      type: 'string',
      enum: ['', ...FILTER_CONTROLS],
      description:
        'text: dropdown (default), singleSelect, list; date: dateRange (default), relativeDate; number: slider (needs hasRange). "" for the default.',
    },
    placement: {
      type: 'string',
      enum: ['', ...CONTROL_PLACEMENTS],
      description: 'controlBar (the strip at the top, the default) or canvas; "" for the default.',
    },
    appliesTo: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keys (or titles) of the visuals it narrows; [] for every visual.',
    },
    values: {
      type: 'array',
      items: { type: 'string' },
      description: 'Text columns: values selected to start with, when the ask names them; else [].',
    },
    hasRange: { type: 'boolean', description: 'True when min and max are set (a slider).' },
    min: { type: 'number' },
    max: { type: 'number' },
    lastDays: { type: 'integer', description: 'relativeDate: the last N days; else 0.' },
  },
} as const;

const ACTION_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'trigger', 'targets', 'fields', 'sheet'],
  properties: {
    kind: {
      type: 'string',
      enum: ['', ...ACTION_KINDS],
      description:
        'filter: clicking a data point filters other visuals (an action filter, cross-filter); navigate: opens a sheet. "" when unused.',
    },
    trigger: { type: 'string', enum: [...ACTION_TRIGGERS] },
    targets: {
      type: 'array',
      items: { type: 'string' },
      description: 'filter: keys of the visuals it filters; [] for every other visual.',
    },
    fields: {
      type: 'array',
      items: { type: 'string' },
      description: 'filter: columns the selection filters by; [] for all its fields.',
    },
    sheet: { type: 'string', description: 'navigate: the sheet name; else "".' },
  },
} as const;

const VISUAL_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: [
    'key',
    'type',
    'title',
    'identifier',
    'category',
    'granularity',
    'values',
    'color',
    'actions',
  ],
  properties: {
    key: {
      type: 'string',
      description: 'A short id filters and actions refer to it by, e.g. "byRegion".',
    },
    type: { type: 'string', enum: [...BUILDABLE_VISUAL_TYPES] },
    title: { type: 'string', description: 'Short, in the words of the ask.' },
    identifier: {
      type: 'string',
      description: 'The dataset identifier every column belongs to.',
    },
    category: {
      type: 'string',
      description: 'The dimension column (x axis, group-by, rows); "" for a KPI.',
    },
    granularity: {
      type: 'string',
      enum: ['', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'],
      description: 'When the category is a date; else "".',
    },
    values: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['column', 'aggregation'],
        properties: {
          column: { type: 'string' },
          aggregation: {
            type: 'string',
            enum: ['SUM', 'AVERAGE', 'COUNT', 'DISTINCT_COUNT', 'MIN', 'MAX'],
          },
        },
      },
    },
    color: {
      type: 'string',
      description: 'A second dimension (colours, pivot columns) or "".',
    },
    actions: { type: 'array', items: ACTION_ITEM, description: 'Interactions; [] for none.' },
  },
} as const;

const VISUALS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['visuals', 'filters', 'reason'],
  properties: {
    reason: { type: 'string', description: 'One sentence on the choices, or why nothing fits.' },
    filters: {
      type: 'array',
      description: 'Every filter the ask names, with its control; [] when it needs none.',
      items: FILTER_ITEM,
    },
    visuals: { type: 'array', items: VISUAL_ITEM },
  },
} as const;

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
          'identifier',
          'column',
          'filter',
          'visual',
          'action',
        ],
        properties: {
          op: {
            type: 'string',
            enum: [
              'move',
              'resize',
              'retype',
              'retitle',
              'remove',
              'duplicate',
              'renameSheet',
              'addFilter',
              'addVisual',
              'addAction',
            ],
          },
          sheetId: { type: 'string', description: 'A sheetId from the outline.' },
          elementId: {
            type: 'string',
            description:
              'An elementId from the outline (addAction: the visual that carries it); "" for renameSheet, addFilter, addVisual.',
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
          identifier: {
            type: 'string',
            description:
              'addFilter: the dataset identifier (from the datasets list, never an ARN); else "".',
          },
          column: { type: 'string', description: 'addFilter: the column to filter on; else "".' },
          filter: {
            ...FILTER_ITEM,
            description:
              "addFilter: the filter (its identifier and column repeat the op's); else any filler.",
          },
          visual: {
            ...VISUAL_ITEM,
            description: 'addVisual: the visual to add; else any filler with type "".',
          },
          action: {
            ...ACTION_ITEM,
            description:
              'addAction: the interaction for the visual named by elementId; else kind "".',
          },
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

const defaultCandidateLoader: CandidateLoader = async () => {
  const [entries, governed] = await Promise.all([
    cacheService.getCacheEntries({
      assetType: ASSET_TYPES.dataset,
      statusFilter: AssetStatusFilter.ACTIVE,
    }),
    governedDatasetIndex(),
  ]);
  return rankCandidates(
    entries.map((e) => ({ id: e.assetId, name: e.assetName })),
    governed
  );
};

export class PlannerService {
  public constructor(
    private readonly rebindService: RebindService,
    private readonly model: PlannerModel,
    private readonly loadCandidates: CandidateLoader = defaultCandidateLoader,
    /** The organisation's authoring guidance from Settings, added to the prompts it applies to. */
    private readonly options: { guidance?: AuthoringGuidance } = {}
  ) {}

  /** The preamble, plus the guidance for this kind of decision when the organisation set any. */
  private system(focus: GuidanceFocus[]): string {
    const guidance = this.options.guidance ? guidanceSection(this.options.guidance, focus) : '';
    return guidance ? `${PREAMBLE}\n\n${guidance}` : PREAMBLE;
  }

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
    const { ops, problems } = choice.wantsEdits
      ? await this.planEdits(assetType, assetId, ask)
      : { ops: [], problems: [] };

    if (choice.intent === 'unclear' || (choice.rebinds.length === 0 && ops.length === 0)) {
      return {
        ask,
        intent: 'unclear',
        mode: choice.mode,
        reason: choice.reason,
        rebinds: [],
        unmapped: [],
        ops: [],
        problems,
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
        problems,
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
      problems,
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
  ): Promise<{ ops: DefinitionOp[]; problems: string[] }> {
    const [outline, described] = await Promise.all([
      this.rebindService.loadDefinitionOutline(assetType, assetId),
      this.rebindService.describeDatasets(assetType, assetId).catch(() => null),
    ]);
    // Every column of each dataset, with its type: an added visual or filter
    // may use a column the definition does not read yet.
    const datasets = await Promise.all(
      (described?.datasets ?? []).map(async (d) => {
        const target = await this.rebindService
          .describeTargetDataset(d.dataSetId)
          .catch(() => null);
        return {
          identifier: d.identifier,
          columns: target
            ? target.columns
                .slice(0, MAX_COLUMNS_PER_DATASET)
                .map((c) => `${c.name} (${c.type ?? 'STRING'})`)
            : d.columns.map((c: any) => (typeof c === 'string' ? c : c?.name)).filter(Boolean),
        };
      })
    );
    const user = [
      'The sheets of the definition, with the ids you must use:',
      JSON.stringify(outline),
      '',
      'The datasets it reads, by identifier, with their columns and types:',
      JSON.stringify(datasets),
      '',
      `The ask: ${JSON.stringify(ask)}`,
      '',
      vocabularySection(),
      '',
      'Express every change the ask wants as ops, and nothing it does not: every filter it names with the control and placement it names (addFilter), every visual (addVisual, by column names), every interaction (addAction on the visual that is clicked), and layout changes (move, resize, retype, retitle, remove). The grid is 36 columns wide; rows grow downward. Use only ids from the outline, identifiers and columns from the datasets, and visual titles or ids for appliesTo and targets. Change a visual type only between BarChart, ColumnChart, LineChart, PieChart, DonutChart, Table and PivotTable. If the ask wants no such change, return an empty list.',
    ].join('\n');

    const result = await this.model.complete({
      label: 'plan-edits',
      system: this.system(['explorations', 'visuals']),
      user,
      schemaName: 'plan_edits',
      schemaDescription: 'Layout, visual, filter and interaction edits as ops.',
      schema: EDITS_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: EDITS_MAX_TOKENS,
    });

    const ops = parseEditOps(result.output, outline, new Set(datasets.map((d) => d.identifier)));
    return this.validateOps(assetType, assetId, ops);
  }

  /**
   * From nothing: the visuals a dashboard on these datasets should show,
   * given an ask. The model names columns only; the builder decides the
   * field wells from the columns' types and leaves out what does not exist.
   */
  public async planVisuals(
    ask: string,
    datasets: BuilderDataset[]
  ): Promise<{
    visuals: VisualSpec[];
    filters: FilterSpec[];
    reason: string;
    model: { provider: string; model: string };
  }> {
    const trimmed = ask.trim();
    if (!trimmed) {
      throw new ValidationError('An ask is required');
    }
    if (trimmed.length > MAX_ASK_LENGTH) {
      throw new ValidationError(`The ask must be at most ${MAX_ASK_LENGTH} characters`);
    }
    const listing = datasets.map((d) => ({
      identifier: d.identifier,
      columns: d.columns
        .slice(0, MAX_COLUMNS_PER_DATASET)
        .map((c) => `${c.name} (${c.type ?? 'STRING'})`),
    }));
    const user = [
      'The datasets the dashboard reads, by identifier, with their columns and types:',
      JSON.stringify(listing),
      '',
      `The ask: ${JSON.stringify(trimmed)}`,
      '',
      vocabularySection(),
      '',
      'Propose what this ask should show, most important first. Use only these identifiers and column names, exactly. KPIs for single numbers, line charts over dates, bar or column charts by a category, tables for detail. Aggregate numeric columns with SUM unless the ask says otherwise; count or distinct-count text columns. Every filter the ask names is a filter, with the control and placement it names (the defaults otherwise); a slider needs its range, so use a range the ask gives or pick another control. Every interaction it names is an action on the visual that is clicked, targeting visuals by key. Give each visual a key. Say what to show, not where or how big: the layout and sizes are decided for you. Build exactly what the ask needs, nothing more.',
    ].join('\n');

    const result = await this.model.complete({
      label: 'plan-visuals',
      system: this.system(['explorations', 'visuals']),
      user,
      schemaName: 'plan_visuals',
      schemaDescription: 'The visuals to build, by column names.',
      schema: VISUALS_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: VISUALS_MAX_TOKENS,
    });
    return {
      visuals: parseVisualSpecs(result.output, datasets),
      filters: parseFilterSpecs(result.output, datasets),
      reason: reasonOf(result.output),
      model: { provider: result.provider, model: result.model },
    };
  }

  /** The ops the definition accepts, in order, and why each of the others does not apply. */
  private async validateOps(
    assetType: AuthorableAssetType,
    assetId: string,
    ops: DefinitionOp[]
  ): Promise<{ ops: DefinitionOp[]; problems: string[] }> {
    if (ops.length === 0) {
      return { ops: [], problems: [] };
    }
    const preview = await this.rebindService.preview(assetType, assetId, { rebinds: [] });
    const kept: DefinitionOp[] = [];
    const problems: string[] = [];
    for (const op of ops) {
      try {
        applyOps(preview.definition, [...kept, op]);
        kept.push(op);
      } catch (error) {
        const reason = (error as Error).message.replace(/^Op \d+: /, '');
        problems.push(`${op.op}: ${reason}`);
        logger.warn('Planner op does not apply', { op, error: reason });
      }
    }
    return { ops: kept, problems };
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
      'Datasets in the account (id and name). Those with `governed` read a published SMUS listing, shown with its project; when the ask says SMUS, governed, published, a listing or a project, choose among those:',
      JSON.stringify(candidates),
      '',
      `The ask: """${ask}"""`,
      '',
      'Decide which identifier(s) should read from which candidate dataset, and whether to make a copy or change it in place. Also say whether the ask wants layout or visual changes (moving, resizing, retitling, removing, duplicating or retyping visuals, renaming sheets); those are planned separately.',
    ].join('\n');

    const result = await this.model.complete({
      label: 'choose-target',
      system: this.system(['architecture', 'datasets']),
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
      system: this.system(['datasets']),
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
function reasonOf(output: unknown): string {
  return isRecord(output) && typeof output.reason === 'string' ? output.reason : '';
}

/** A planner action item as a VisualActionSpec; undefined for a filler (kind ""). */
function actionOf(item: unknown): VisualActionSpec | undefined {
  if (!isRecord(item) || !(ACTION_KINDS as readonly string[]).includes(str(item, 'kind'))) {
    return undefined;
  }
  const strings = (key: string) =>
    Array.isArray(item[key])
      ? (item[key] as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
  const trigger = str(item, 'trigger');
  return {
    kind: str(item, 'kind') as VisualActionSpec['kind'],
    ...((ACTION_TRIGGERS as readonly string[]).includes(trigger)
      ? { trigger: trigger as VisualActionSpec['trigger'] }
      : {}),
    ...(strings('targets').length ? { targets: strings('targets') } : {}),
    ...(strings('fields').length ? { fields: strings('fields') } : {}),
    ...(str(item, 'sheet') ? { sheet: str(item, 'sheet') } : {}),
  };
}

/** A planner visual item as a VisualSpec; undefined when it is not one. The builder checks columns. */
function visualOf(item: unknown, identifiers: Set<string>): VisualSpec | undefined {
  if (!isRecord(item)) return undefined;
  const type = str(item, 'type') as VisualSpec['type'];
  const identifier = str(item, 'identifier');
  if (!BUILDABLE_VISUAL_TYPES.includes(type) || !identifiers.has(identifier)) return undefined;
  const values = Array.isArray(item.values)
    ? item.values
        .filter(
          (v): v is Record<string, unknown> =>
            isRecord(v) && typeof v.column === 'string' && v.column.length > 0
        )
        .map((v) => ({
          column: v.column as string,
          ...(typeof v.aggregation === 'string' && v.aggregation
            ? { aggregation: v.aggregation as VisualSpec['values'][number]['aggregation'] }
            : {}),
        }))
    : [];
  if (values.length === 0) return undefined;
  const category = str(item, 'category');
  const granularity = str(item, 'granularity');
  const color = str(item, 'color');
  const actions = (Array.isArray(item.actions) ? item.actions : [])
    .map(actionOf)
    .filter((a): a is VisualActionSpec => Boolean(a));
  return {
    ...(str(item, 'key') ? { key: str(item, 'key') } : {}),
    type,
    title: str(item, 'title') || `${type} of ${values[0]!.column}`,
    identifier,
    ...(category && type !== 'KPI' ? { category } : {}),
    ...(granularity ? { granularity: granularity as VisualSpec['granularity'] } : {}),
    values,
    ...(color ? { color } : {}),
    ...(actions.length ? { actions } : {}),
  };
}

/** A planner filter item as a FilterSpec; undefined when it names no known column. */
function filterOf(item: unknown, identifiers: Set<string>): FilterSpec | undefined {
  if (!isRecord(item)) return undefined;
  const identifier = str(item, 'identifier');
  const column = str(item, 'column');
  if (!identifiers.has(identifier) || !column) return undefined;
  const strings = (key: string) =>
    Array.isArray(item[key])
      ? (item[key] as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
  const control = str(item, 'control');
  const placement = str(item, 'placement');
  const ranged =
    item.hasRange === true && typeof item.min === 'number' && typeof item.max === 'number';
  const lastDays = typeof item.lastDays === 'number' && item.lastDays > 0 ? item.lastDays : 0;
  return {
    identifier,
    column,
    ...(str(item, 'title') ? { title: str(item, 'title') } : {}),
    ...((FILTER_CONTROLS as readonly string[]).includes(control)
      ? { control: control as FilterControlKind }
      : {}),
    ...((CONTROL_PLACEMENTS as readonly string[]).includes(placement)
      ? { placement: placement as ControlPlacement }
      : {}),
    ...(strings('appliesTo').length ? { appliesTo: strings('appliesTo') } : {}),
    ...(strings('values').length ? { values: strings('values') } : {}),
    ...(ranged ? { min: item.min as number, max: item.max as number } : {}),
    ...(lastDays ? { lastDays } : {}),
  };
}

function parseVisualSpecs(output: unknown, datasets: BuilderDataset[]): VisualSpec[] {
  if (!isRecord(output) || !Array.isArray(output.visuals)) {
    return [];
  }
  const identifiers = new Set(datasets.map((d) => d.identifier));
  return output.visuals
    .slice(0, MAX_PLANNED_VISUALS)
    .map((item) => visualOf(item, identifiers))
    .filter((v): v is VisualSpec => Boolean(v));
}

function parseFilterSpecs(output: unknown, datasets: BuilderDataset[]): FilterSpec[] {
  if (!isRecord(output) || !Array.isArray(output.filters)) {
    return [];
  }
  const identifiers = new Set(datasets.map((d) => d.identifier));
  return output.filters
    .map((item) => filterOf(item, identifiers))
    .filter((f): f is FilterSpec => Boolean(f));
}

export function parseEditOps(
  output: unknown,
  outline: SheetOutline[],
  identifiers: Set<string> = new Set()
): DefinitionOp[] {
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
      case 'addFilter': {
        const identifier = text('identifier');
        const column = text('column');
        const filter =
          filterOf(item.filter, new Set([...identifiers, identifier ?? ''])) ??
          (identifier && column ? { identifier, column } : undefined);
        return filter
          ? [{ ...filter, op: 'addFilter', sheetId: base.sheetId, identifier, column }]
          : [];
      }
      case 'addVisual': {
        const visual = visualOf(item.visual, identifiers);
        return visual ? [{ op: 'addVisual', sheetId: base.sheetId, visual }] : [];
      }
      case 'addAction': {
        const action = actionOf(item.action);
        return action ? [{ ...base, action }] : [];
      }
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
