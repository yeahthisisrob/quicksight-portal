/**
 * The assistant: a conversation with a model that knows the portal through
 * its context graph and uses the portal's own API as the person asking. It
 * reads and previews by itself, draws what a change will build before
 * preparing it, and hands every write to the person to run. Bounded in
 * rounds and in how much it reads, so a question costs cents.
 *
 * The pieces: the prompt (assistantPrompt), the tools (assistantTools), the
 * context graph calls (lib/contextTools), plans and field placement
 * (lib/planning), and this loop, which runs a turn, dispatches the tools
 * the model called, and repeats.
 */
import { randomUUID } from 'node:crypto';

import spec from '../../../../../shared/generated/openapi.json';
import type { AuthoringGuidance } from '../../../shared/ai/authoringGuidance';
import type { VocabularyEntry } from '../../../shared/ai/authoringVocabulary';
import {
  AI_MODELS,
  type AiModel,
  aiModel,
  costOf,
  isAiModelKey,
} from '../../../shared/ai/modelCatalog';
import { bodyErrors, bodyFields, matchOperation, queryErrors } from '../../../shared/api/contract';
import type { TagStandard } from '../../../shared/tags/tagStandards';
import { errorMessage } from '../../../shared/utils/errorMessage';
import { logger } from '../../../shared/utils/logger';
import {
  contextGet,
  contextRelated,
  contextSearch,
  datasetColumns,
  entityNames,
  relatedHits,
  searchHits,
} from '../lib/contextTools';
import { conversationOf } from '../lib/conversation';
import {
  builtFilters,
  declaredDatasets,
  type FilterTargets,
  judgeFields,
  missingRequested,
  type PlanTarget,
  parsePlan,
  type RequestedFilter,
  resolveLineage,
  unbuiltClaims,
  verdictsMessage,
  withRequestedFilters,
  writeOf,
} from '../lib/planning';
import { buildBrief, listTemplates } from '../lib/portalBrief';
import { classifyCall, describeOperation } from '../lib/portalCalls';
import { describeRunInput, type RunInput } from '../lib/runInput';
import { announcesMore, CONTINUE_NUDGE, describeStep, MAX_NUDGES } from '../lib/steps';
import type { Understander, Understanding, Understood } from '../lib/understanding';
import type {
  AgUiInterrupt,
  AssistantAction,
  AssistantArtifact,
  AssistantCall,
  AssistantChatResult,
  BuildPlan,
  ChatHistoryMessage,
  PlanBuild,
  QuestionOption,
} from '../types';
import { NO_GUIDANCE, systemPrompt } from './assistantPrompt';
import { ASSISTANT_TOOLS } from './assistantTools';
import type { ChatModel, ChatSystem, ChatTurn, ToolResult } from './ChatModel';

export { parsePlan } from '../lib/planning';
export { announcesMore, CONTINUE_NUDGE, describeStep } from '../lib/steps';

/** Enough for find, plan, preview, prepare, and a correction or two. */
const MAX_ROUNDS = 12;
const MAX_RESULT_CHARS = 12_000;
const MAX_ARTIFACTS = 6;
const HTTP_ERROR_MIN = 400;
const HTTP_OK = 200;
const HTTP_ACCEPTED = 202;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
/** A planner job usually answers in under a minute; give up well inside the worker's 15. */
const MS_PER_MINUTE = 60_000;
const MAX_JOB_WAIT_MINUTES = 5;
const MAX_JOB_WAIT_MS = MAX_JOB_WAIT_MINUTES * MS_PER_MINUTE;
const JOB_POLL_MS = 2_000;
const CREATE_DATASET = '/api/authoring/datasets';
const TERMINAL = new Set(['completed', 'failed', 'stopped']);
const CALCULATED_FIELD = /^\/api\/data-catalog\/calculated-fields\/([^/?]+)$/;
/** Builds only a plan drafts and previews, so there is one wireframe per change: the plan's. */
const PLAN_OWNED =
  /^\/api\/authoring\/(new|(analysis|dashboard)\/[^/]+)\/(propose|preview|rebind\/preview)$/;

const DRAWABLE_PREVIEW =
  /^\/api\/authoring\/(new|definition|(analysis|dashboard)\/[^/]+\/(rebind|definition))\/preview$/;

/** How far along the assistant is, for the person watching. */
type ProgressReporter = (message: string) => Promise<void> | void;

/** A row of the trace, as it happens: a call made, or a model turn taken. */
type CallReporter = (call: AssistantCall) => Promise<void> | void;

/** The `method` of a trace row that is a model turn, not a call to the portal. */
export const MODEL_TURN = 'MODEL';
const TEXT_EXCERPT = 160;

/** Where a plan's data comes from and what it builds, without the build itself. */
type PlanLineage = Omit<BuildPlan, 'build'>;

/** Runs one of the portal's own routes as the person, in-process. */
type PortalDispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

interface AssistantOptions {
  onProgress?: ProgressReporter;
  /** Each trace row as it is made, so the person can watch the work. */
  onCall?: CallReporter;
  /**
   * Says what the message means before anything runs (one quick model call).
   * A visual change to a named asset then goes straight to the planner.
   */
  understand?: Understander;
  /** Whether SMUS is configured: its concepts are only described when it is. */
  smus?: boolean;
  /** The organisation's authoring guidance from Settings. */
  guidance?: AuthoringGuidance;
  /** The organisation's own words for what to build, from Settings. */
  vocabulary?: VocabularyEntry[];
  /** The organisation's tag keys and values, from Settings. */
  tagStandards?: TagStandard[];
  /** Read the account's state (SMUS, catalog, templates) before answering. */
  brief?: boolean;
  /** Sent as `model` on propose calls that do not name one. */
  authoringModel?: string;
  /** What Settings say a change to an existing asset is made on, so the assistant says so too. */
  editMode?: 'clone' | 'update';
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

interface Collected {
  calls: AssistantCall[];
  actions: AssistantAction[];
  artifacts: AssistantArtifact[];
  helpers: NonNullable<AssistantChatResult['helpers']>;
  /** Questions to the person; the run ends once one is asked (AG-UI interrupt). */
  interrupts: AgUiInterrupt[];
  /**
   * What each preview artifact of this answer built, by its id. A plan and
   * the write it prepares name their preview by id, so what the person
   * sees under Run is that write's own preview, never merely the latest.
   */
  previews: Map<string, unknown>;
}

const MAX_OPTIONS = 12;

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'option'
  );
}

/** The model the planner reported in its answer (a proposal, or a from-nothing preview), if any. */
export function plannerModelOf(body: string): { provider: string; model: string } | undefined {
  try {
    const data = JSON.parse(body)?.data;
    const model = data?.model ?? data?.proposal?.model;
    return typeof model?.model === 'string'
      ? { provider: String(model.provider ?? ''), model: model.model }
      : undefined;
  } catch {
    return undefined;
  }
}

function clip(text: string): string {
  return text.length > MAX_RESULT_CHARS
    ? `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated ${text.length - MAX_RESULT_CHARS} characters: narrow the request with limit, pageSize, search or types]`
    : text;
}

/** The start of what the model said while it acted, in one line. */
function excerpt(text: string): string | undefined {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return undefined;
  return line.length > TEXT_EXCERPT ? `${line.slice(0, TEXT_EXCERPT)}…` : line;
}

/** What planning directly from the understanding came to. */
type DirectPlan =
  /** Drawn: the answer is the understanding and the plan. */
  | { reply: string }
  /** The plan could not be drafted; the conversation takes it from here. */
  | { problem: string; about: string };

/** Whether a build changes its asset on a copy or in place, said plainly; nothing for a new asset. */
function describeMode(build: PlanBuild): string {
  if (!('edit' in build)) return '';
  const { request, assetType } = build.edit;
  if (request.mode === 'clone') {
    return `This is made on a copy${request.name ? ` named "${request.name}"` : ''}; the original ${assetType} is untouched (Settings › Authoring decides copy or in place). `;
  }
  return `This changes the ${assetType} in place (Settings › Authoring decides copy or in place). `;
}

/** What the chat model hears about the understanding already given to the person. */
function understoodContext(u: Understanding, direct: DirectPlan | undefined): string {
  const lines = [
    `You already told the person: "${u.understanding}". Carry on from there; do not ask what they meant, and do not say it again.`,
  ];
  if (direct && 'problem' in direct) {
    lines.push(
      `${direct.about} You tried to draw the plan for that change with this brief: ${JSON.stringify(u.brief ?? '')}. It failed:\n${direct.problem}\nFix the brief and draw it again with show_plan (the datasets above as existing), or tell the person what is in the way.`
    );
  }
  return lines.join('\n');
}

function str(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function strings(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}

function int(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
}

const CREATE_NEW = '/api/authoring/new';
/** Drafts the authoring model gets before the chat model hears it cannot be built. */
const MAX_DRAFTS = 3;
/** Within the planner's ask limit, with room for the reasons a draft failed. */
const MAX_BRIEF_CHARS = 4_000;
const EDIT_OPS = '/api/authoring/{assetType}/{assetId}/rebind';

/** What a preview built, in a line: visuals, and the control bar's filters. */
export function describeBuilt(data: any): string | undefined {
  const sheets: any[] = Array.isArray(data?.outline) ? data.outline : [];
  if (sheets.length === 0) return undefined;
  const elements = sheets.flatMap((s) => (Array.isArray(s?.elements) ? s.elements : []));
  const visuals = elements.filter((e: any) => e?.kind === 'visual').length;
  const controls = elements
    .filter((e: any) => e?.kind === 'filterControl' || e?.kind === 'parameterControl')
    .map(
      (e: any) => `${e.title ?? e.elementId}${e.placement === 'canvas' ? ' (on the canvas)' : ''}`
    );
  return `${visuals} visual${visuals === 1 ? '' : 's'}; ${controls.length ? `controls: ${controls.join(', ')}` : 'no filter controls'}`;
}

/** The `data` of a portal answer, when it has one. */
function dataOf(body: string): any {
  try {
    return JSON.parse(body)?.data;
  } catch {
    return undefined;
  }
}

/** Why a preview's result means the write would not go through; empty when it would. */
function previewProblem(data: any): string | undefined {
  if (data?.canRestore === false) {
    const blocking = (data.checks ?? []).filter((c: any) => c?.blocking && !c?.ok);
    return `The restore cannot go ahead:\n${blocking.map((c: any) => `- ${c.label}: ${c.detail}`).join('\n')}\nTell the person what stands in the way, or fix it (a new id, say) and prepare it again.`;
  }
  if (data?.canApply === false) {
    return `The preview says QuickSight would refuse this as it stands:\n${clip(JSON.stringify({ issues: data.issues, warnings: data.warnings, summary: data.summary }))}\nFix it and prepare it again.`;
  }
  return undefined;
}

export class AssistantService {
  /** Plans drawn in earlier answers (the page's working state), for prepare_plan. */
  private earlierPlans: NonNullable<NonNullable<RunInput['state']>['plans']> = [];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  public constructor(
    private readonly chat: ChatModel,
    private readonly model: AiModel,
    private readonly dispatch: PortalDispatch,
    private readonly options: AssistantOptions = {}
  ) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? (() => Date.now());
  }

  public async respond(
    history: ChatHistoryMessage[],
    run: RunInput = {}
  ): Promise<AssistantChatResult> {
    this.earlierPlans = run.state?.plans ?? [];
    const turns: ChatTurn[] = conversationOf(history).map((m) =>
      m.role === 'user'
        ? { role: 'user', text: m.text }
        : { role: 'assistant', text: m.text, toolCalls: [] }
    );
    const out: Collected = {
      calls: [],
      actions: [],
      artifacts: [],
      helpers: [],
      interrupts: [],
      previews: new Map(),
    };
    const usage = { inputTokens: 0, outputTokens: 0 };
    let reply = '';
    let rounds = 0;
    let nudges = 0;

    let brief: string | undefined;
    if (this.options.brief) {
      await this.progress('Reading the portal');
      const started = this.now();
      brief = await buildBrief(this.dispatch).catch(() => undefined);
      await this.record(out, {
        method: 'GET',
        path: 'the account brief',
        status: brief === undefined ? HTTP_SERVER_ERROR : HTTP_OK,
        ok: brief !== undefined,
        step: 'Reading the portal',
        ms: this.now() - started,
      });
    }
    const state = describeRunInput(run);
    // First, what the message means: said to the person at once, then acted
    // on. A visual change to a named asset is planned here and now, with no
    // conversation rounds in between.
    const understood = await this.understand(history, state, out);
    if (understood) {
      usage.inputTokens += understood.usage.inputTokens;
      usage.outputTokens += understood.usage.outputTokens;
      rounds += 1;
      await this.progress(understood.understanding.understanding);
    }
    const direct = understood
      ? await this.planDirectly(understood.understanding, run, out)
      : undefined;
    const planned = direct !== undefined && 'reply' in direct;
    if (direct && 'reply' in direct) {
      reply = direct.reply;
    }
    // The live part of the prompt: the account at a glance, then the page's
    // working state and any answers to the previous run's questions, then
    // what was already said to the person.
    const context = [
      brief,
      this.options.editMode
        ? `Changes to an existing analysis or dashboard are made ${this.options.editMode === 'clone' ? 'on a copy (named the next version, v2, v3...; the original is untouched)' : 'in place'} unless the person says otherwise (Settings › Authoring). Say so when you show such a plan; put mode "copy" or "inPlace" in target.edit only when the person said which.`
        : '',
      state,
      understood ? understoodContext(understood.understanding, direct) : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const prompt: ChatSystem = {
      stable: systemPrompt({
        smus: this.options.smus ?? true,
        guidance: this.options.guidance ?? NO_GUIDANCE,
        vocabulary: this.options.vocabulary,
        tagStandards: this.options.tagStandards,
      }),
      ...(context ? { context } : {}),
    };

    while (!planned && rounds < MAX_ROUNDS) {
      rounds += 1;
      const first = turns.every((t) => t.role === 'user');
      await this.progress(first ? 'Thinking' : 'Thinking about what it found');
      const started = this.now();
      const turn = await this.chat.turn(prompt, turns, ASSISTANT_TOOLS);
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;
      const note = turn.reasoning ?? (turn.toolCalls.length ? excerpt(turn.text) : undefined);
      await this.record(out, {
        method: MODEL_TURN,
        path: this.model.label,
        status: HTTP_OK,
        ok: true,
        step: first ? 'Thinking' : 'Thinking about what it found',
        ms: this.now() - started,
        ...(note ? { note } : {}),
      });
      turns.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });
      if (turn.text) {
        reply = turn.text;
      }
      if (turn.toolCalls.length === 0) {
        // An answer that ends on a promise or on asking leave is pushed to
        // keep going instead of leaving the person to say "continue".
        if (nudges < MAX_NUDGES && rounds < MAX_ROUNDS && announcesMore(turn.text)) {
          nudges += 1;
          turns.push({ role: 'user', text: CONTINUE_NUDGE });
          continue;
        }
        break;
      }
      const results: ToolResult[] = [];
      for (const call of turn.toolCalls) {
        results.push(await this.runTool(call.id, call.name, call.input, out));
      }
      turns.push({ role: 'tool', results });
      if (out.interrupts.length > 0) {
        // A question ends the run; the answer starts the next one.
        reply ||= out.interrupts[0]!.message ?? '';
        break;
      }
      if (rounds === MAX_ROUNDS) {
        reply ||= 'I ran out of steps before finishing; ask me to continue from here.';
      }
    }

    logger.info('Assistant answered', {
      model: this.model.key,
      rounds,
      calls: out.calls.length,
      actions: out.actions.length,
      ...usage,
    });
    return {
      reply: reply || 'Done.',
      calls: out.calls,
      actions: out.actions,
      artifacts: out.artifacts.slice(-MAX_ARTIFACTS),
      model: { key: this.model.key, label: this.model.label, modelId: this.model.modelId },
      usage,
      cost: costOf(this.model, usage),
      rounds,
      outcome: out.interrupts.length
        ? { type: 'interrupt', interrupts: out.interrupts }
        : { type: 'success' },
      ...(out.helpers.length ? { helpers: out.helpers } : {}),
    };
  }

  private async progress(message: string): Promise<void> {
    try {
      await this.options.onProgress?.(message);
    } catch {
      // Progress is a courtesy; never fail the answer over it.
    }
  }

  /** A trace row: kept for the answer, and told to whoever is watching. */
  private async record(out: Collected, call: AssistantCall): Promise<void> {
    out.calls.push(call);
    try {
      await this.options.onCall?.(call);
    } catch {
      // Watching is a courtesy too.
    }
  }

  /** What the message means, in one quick model call; the sentence is the first trace row. */
  private async understand(
    history: ChatHistoryMessage[],
    state: string,
    out: Collected
  ): Promise<Understood | undefined> {
    if (!this.options.understand) return undefined;
    const started = this.now();
    const understood = await this.options.understand(history, state).catch(() => undefined);
    await this.record(out, {
      method: MODEL_TURN,
      path: this.model.label,
      status: understood ? HTTP_OK : HTTP_SERVER_ERROR,
      ok: Boolean(understood),
      step: 'Understanding the ask',
      ms: this.now() - started,
      ...(understood ? { note: understood.understanding.understanding } : {}),
    });
    return understood;
  }

  /**
   * A visual change to one named asset, planned without a conversation:
   * the asset is found in the graph by its name (or the id the conversation
   * gave), its datasets are read from the graph, and the plan is drawn as
   * show_plan would draw it. The answer is the understanding and the plan.
   * Anything that does not resolve cleanly is left to the conversation, and
   * a plan that cannot be drafted goes there with its reason.
   */
  private async planDirectly(
    u: Understanding,
    run: RunInput,
    out: Collected
  ): Promise<DirectPlan | undefined> {
    if (u.change === 'learn' && u.asset && !run.resume?.length) {
      return this.learnDirectly(u, out);
    }
    if (u.change !== 'visual' || !u.asset || !u.brief || run.resume?.length) {
      return undefined;
    }
    const { kind } = u.asset;
    const hit = await this.resolveAsset(u.asset, out);
    if (!hit) {
      return undefined;
    }
    const { assetId } = hit;
    // An earlier plan on it that was not run is revised in conversation, so its changes are kept.
    if (this.earlierPlans.some((p) => 'edit' in p.build && p.build.edit.assetId === assetId)) {
      return undefined;
    }
    const lineageStarted = this.now();
    const datasets = (
      await relatedHits(this.dispatch, {
        entityId: `${kind}:${assetId}`,
        relations: ['uses-dataset'],
        direction: 'out',
        types: ['dataset'],
      })
    ).map((d) => ({ name: d.name || d.entityId, id: d.entityId.replace(/^dataset:/, '') }));
    await this.record(out, {
      method: 'GET',
      path: `context_related ${kind}:${assetId}`,
      status: datasets.length ? HTTP_OK : HTTP_NOT_FOUND,
      ok: datasets.length > 0,
      step: 'Following the lineage',
      ms: this.now() - lineageStarted,
    });
    if (datasets.length === 0) {
      return undefined;
    }
    const assetName = hit.name;
    const about = `The asset is ${kind} "${assetName}" (id ${assetId}); it reads ${datasets
      .map((d) => `${d.name} (id ${d.id})`)
      .join(', ')}.`;
    const drawn = await this.drawPlan(
      {
        title: u.title || `Change to ${assetName}`,
        datasets: datasets.map((d) => ({ ...d, status: 'existing' })),
        asset: { kind, name: assetName, id: assetId, status: 'edited' },
        brief: u.brief,
        filters: u.filters,
        target: {
          edit: { assetType: kind, assetId, ...(u.editMode ? { mode: u.editMode } : {}) },
        },
      },
      out
    );
    return 'problem' in drawn
      ? { problem: drawn.problem, about }
      : { reply: `${u.understanding}\n\n${drawn.summary}` };
  }

  private async runTool(
    id: string,
    name: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    switch (name) {
      case 'context_search':
      case 'context_get':
      case 'context_related':
        return this.context(id, name, input, out);
      case 'list_templates':
        await this.progress('Reading the templates');
        await this.record(out, {
          method: 'GET',
          path: 'list_templates',
          status: HTTP_OK,
          ok: true,
          step: 'Reading the templates',
        });
        return { id, content: await listTemplates(this.dispatch) };
      case 'describe_operation':
        return {
          id,
          content: describeOperation(
            spec as never,
            str(input, 'method').toUpperCase(),
            str(input, 'path')
          ),
        };
      case 'show_plan':
        return this.showPlan(id, input, out);
      case 'ask_person':
        return this.askPerson(id, input, out);
      case 'show_to_person':
        return this.showToPerson(id, input, out);
      case 'prepare_plan':
        return this.preparePlan(id, input, out);
      case 'remember':
        return this.remember(id, input, out);
      case 'propose_action':
        return this.proposeAction(id, input, out);
      case 'call_portal_api':
        return this.callPortal(id, input, out);
      default:
        return { id, content: `Unknown tool ${name}.`, isError: true };
    }
  }

  // --- the context graph -----------------------------------------------------

  private async context(
    id: string,
    name: 'context_search' | 'context_get' | 'context_related',
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const started = this.now();
    const entityId = str(input, 'entityId');
    await this.progress(name === 'context_search' ? 'Searching' : 'Following the lineage');
    const result =
      name === 'context_search'
        ? await contextSearch(this.dispatch, {
            query: str(input, 'query'),
            types: strings(input, 'types'),
            projectId: str(input, 'projectId') || undefined,
            limit: int(input, 'limit'),
          })
        : name === 'context_get'
          ? await contextGet(this.dispatch, entityId)
          : await contextRelated(this.dispatch, {
              entityId,
              relations: strings(input, 'relations'),
              direction: str(input, 'direction') || undefined,
              depth: int(input, 'depth'),
              types: strings(input, 'types'),
              limit: int(input, 'limit'),
            });
    await this.record(out, {
      method: 'GET',
      path: `${name} ${name === 'context_search' ? `"${str(input, 'query')}"` : entityId}`,
      status: result.ok ? HTTP_OK : HTTP_NOT_FOUND,
      ok: result.ok,
      step: name === 'context_search' ? 'Searching' : 'Following the lineage',
      ms: this.now() - started,
    });
    return { id, content: clip(result.text), isError: !result.ok };
  }

  // --- showing ---------------------------------------------------------------

  private async showPlan(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const drawn = await this.drawPlan(input, out);
    return 'problem' in drawn
      ? { id, content: drawn.problem, isError: true }
      : { id, content: drawn.content };
  }

  /**
   * A plan, drawn: drafted by the authoring model from the brief, checked,
   * previewed, judged, and shown with its own Run button. `content` is what
   * the chat model hears; `summary` is what the person reads when no chat
   * model speaks after it.
   */
  private async drawPlan(
    input: Record<string, unknown>,
    out: Collected
  ): Promise<{ planId: string; content: string; summary: string } | { problem: string }> {
    const parsed = parsePlan(input);
    if (typeof parsed === 'string') {
      return { problem: parsed };
    }
    // The authoring model drafts the build from the brief; it is checked and
    // previewed before the plan is shown, so a plan the person sees runs.
    const drafted = await this.draft(
      parsed.target,
      parsed.brief,
      parsed.filters,
      out,
      parsed.lineage
    );
    if ('problem' in drafted) {
      return {
        problem: `The authoring model could not draft a build that works, so no plan was shown:\n${drafted.problem}\nTell the person what is in the way, or change the brief and draw the plan again.`,
      };
    }
    // Names from the cached graph, so the plan never shows a bare id.
    const lineage = await resolveLineage(parsed.lineage, (entityId) =>
      entityNames(this.dispatch, entityId)
    );
    const plan = { ...lineage, build: drafted.build };
    const checked = { built: drafted.built };
    const planId = randomUUID();
    // What the plan shows is what its preview built, not what was asked for.
    const filters = builtFilters(drafted.definition);
    out.artifacts.push({
      id: planId,
      kind: 'plan',
      title: str(input, 'title') || 'The plan',
      ...plan,
      model: drafted.model,
      previewId: drafted.previewId,
      ...(filters.length ? { filters } : {}),
    });
    // A plan is checked and bound to its preview, so it carries its Run button
    // itself: whether the person can run it never depends on the chat model
    // remembering a second step.
    const write = writeOf(plan.build);
    out.actions.push({
      id: randomUUID(),
      title: write.title,
      why: str(input, 'title') || 'The plan',
      method: write.method,
      path: write.path,
      body: write.body,
      planId,
      previewId: drafted.previewId,
    });
    await this.progress('Checking the calculated fields');
    const judged = await judgeFields(
      plan,
      (this.options.guidance ?? NO_GUIDANCE).fieldStrategy,
      (dataSetId) => datasetColumns(this.dispatch, dataSetId)
    );
    if (judged.length > 0) {
      out.artifacts.push({
        id: randomUUID(),
        kind: 'fields',
        title: 'Calculated fields this adds',
        fields: judged,
      });
    }
    return {
      planId,
      content: `${verdictsMessage(judged)}\nPlan id ${planId}, drafted by ${drafted.model.label}${drafted.reason ? `: ${drafted.reason}` : ''}.${checked.built ? ` Its preview built: ${checked.built}.` : ''} Its Run button is under it for the person; to change it, draw it again with a changed brief.`,
      summary: `${describeMode(drafted.build)}The plan is below with its preview${checked.built ? ` (${checked.built})` : ''} and its Run button; nothing has changed yet.${judged.length ? ' The calculated fields it adds are judged beside it.' : ''} Say what to change, or run it when it looks right.`,
    };
  }

  /**
   * The build for a brief, drafted by the authoring model through the
   * planner (the propose endpoints, which run on the person's authoring
   * choice). A draft that does not check or preview goes back to it with
   * the reason, a few times, before the chat model hears it cannot be done.
   */
  private async draft(
    target: PlanTarget,
    brief: string,
    requested: RequestedFilter[],
    out: Collected,
    lineage?: PlanLineage
  ): Promise<
    | {
        build: PlanBuild;
        model: { key: string; label: string };
        built?: string;
        reason?: string;
        previewId: string;
        definition: unknown;
      }
    | { problem: string }
  > {
    const key = this.options.authoringModel;
    const chosen = key && isAiModelKey(key) ? aiModel(key) : undefined;
    // The authoring model hears the requirements too; code holds the build to them either way.
    const required = requested.length
      ? `\n\nFilters the person asked for, each required with its control: ${requested
          .map(
            (f) =>
              `${f.column}${f.dataset ? ` (${f.dataset})` : ''}${f.control ? ` as ${f.control}` : ''}${f.placement ? ` in the ${f.placement}` : ''}`
          )
          .join('; ')}.`
      : '';
    const withRequired = `${brief}${required}`;
    let ask = withRequired;
    let problem = '';
    for (let attempt = 1; attempt <= MAX_DRAFTS; attempt++) {
      await this.progress(
        `${attempt === 1 ? 'Drafting' : 'Drafting again'}${chosen ? ` with ${chosen.label}` : ''}`
      );
      const proposed = await this.proposeDraft(target, ask, out, lineage);
      if ('problem' in proposed) {
        problem = proposed.problem;
      } else {
        const checked = await this.checkPlanned(proposed.build, requested, out);
        if ('previewId' in checked) {
          const helper = out.helpers.at(-1);
          return {
            build: checked.build,
            model: chosen
              ? { key: chosen.key, label: chosen.label }
              : { key: helper?.modelId ?? 'planner', label: helper?.label ?? 'The planner' },
            ...(checked.built ? { built: checked.built } : {}),
            ...(proposed.reason ? { reason: proposed.reason } : {}),
            previewId: checked.previewId,
            definition: checked.definition,
          };
        }
        problem = checked.problem;
      }
      ask =
        `${withRequired}\n\nYour previous draft could not be built:\n${problem}\nDraft it again so that it can.`.slice(
          0,
          MAX_BRIEF_CHARS
        );
    }
    return { problem };
  }

  /** One draft from the planner, as a build, or why there is none. */
  private async proposeDraft(
    target: PlanTarget,
    ask: string,
    out: Collected,
    lineage?: PlanLineage
  ): Promise<{ build: PlanBuild; reason?: string } | { problem: string }> {
    const model = this.options.authoringModel ? { model: this.options.authoringModel } : {};
    const path =
      'create' in target
        ? '/api/authoring/new/propose'
        : `/api/authoring/${target.edit.assetType}/${encodeURIComponent(target.edit.assetId)}/propose`;
    // A change that keeps the asset's datasets is an edit: the planner then
    // spends no model call choosing a dataset, and never talks of rebinding.
    const intent =
      'edit' in target && (await this.keepsDatasets(target.edit, lineage))
        ? { intent: 'edit' }
        : {};
    const body =
      'create' in target
        ? { ...target.create, ask, ...model }
        : {
            ask,
            ...model,
            ...intent,
            ...(target.edit.mode ? { mode: target.edit.mode } : {}),
          };
    const response = await this.run('POST', path, body);
    const ok = response.status < HTTP_ERROR_MIN;
    let data: any;
    try {
      data = JSON.parse(response.body)?.data;
    } catch {
      data = undefined;
    }
    await this.record(out, {
      method: 'POST',
      path,
      status: response.status,
      ok,
      step: describeStep('POST', path),
      ms: response.ms,
      ...(Array.isArray(data?.steps) ? { detail: data.steps } : {}),
    });
    if (!ok) {
      return { problem: clip(response.body) };
    }
    this.recordPlanner(response.body, out);
    if (data === undefined) {
      return { problem: 'The planner answered with something unreadable.' };
    }
    if ('create' in target) {
      const visuals = Array.isArray(data?.visuals) ? data.visuals : [];
      if (visuals.length === 0) {
        return { problem: data?.proposal?.reason || 'The planner proposed no visuals.' };
      }
      return {
        build: {
          create: {
            ...target.create,
            visuals,
            ...(Array.isArray(data.filters) && data.filters.length
              ? { filters: data.filters }
              : {}),
          },
        },
        ...(data.proposal?.reason ? { reason: data.proposal.reason } : {}),
      };
    }
    if (data?.intent === 'unclear') {
      return { problem: data.reason || 'The planner could not tell what to change.' };
    }
    if (Array.isArray(data?.problems) && data.problems.length > 0) {
      return { problem: `Some edits do not apply:\n- ${data.problems.join('\n- ')}` };
    }
    if (Array.isArray(data?.unmapped) && data.unmapped.length > 0) {
      return {
        problem: `Columns with no match on the new dataset: ${data.unmapped.map((u: any) => `${u.identifier}.${u.column}`).join(', ')}.`,
      };
    }
    return {
      build: {
        edit: {
          ...target.edit,
          request: {
            mode: data.mode ?? 'update',
            ...(data.name ? { name: data.name } : {}),
            rebinds: (data.rebinds ?? []).map((r: any) => ({
              identifier: r.identifier,
              targetDataSetId: r.targetDataSetId,
              ...(r.columnMap && Object.keys(r.columnMap).length ? { columnMap: r.columnMap } : {}),
            })),
            ...(Array.isArray(data.ops) && data.ops.length ? { ops: data.ops } : {}),
          },
        },
      },
      ...(data.reason ? { reason: data.reason } : {}),
    };
  }

  /**
   * Whether a plan keeps the asset's datasets as they are: every dataset it
   * names is existing and already read by the asset, per the graph. Then the
   * change is visual or layout only, and the planner is told so.
   */
  private async keepsDatasets(
    target: { assetType: string; assetId: string },
    lineage: PlanLineage | undefined
  ): Promise<boolean> {
    const planned = lineage?.datasets ?? [];
    if (planned.length === 0 || planned.some((d) => d.status !== 'existing' || !d.id)) {
      return false;
    }
    const hits = await relatedHits(this.dispatch, {
      entityId: `${target.assetType}:${target.assetId}`,
      relations: ['uses-dataset'],
      direction: 'out',
      types: ['dataset'],
    }).catch(() => []);
    const current = new Set(hits.map((h) => h.entityId.replace(/^dataset:/, '')));
    return current.size > 0 && planned.every((d) => current.has(d.id as string));
  }

  /**
   * Learn what one named asset is for, with no conversation: the asset is
   * found in the graph, the learn job runs, and the answer lists what was
   * read into it and what only the person can tell. Their answers in the
   * next messages are kept with remember.
   */
  private async learnDirectly(u: Understanding, out: Collected): Promise<DirectPlan | undefined> {
    const hit = await this.resolveAsset(u.asset!, out);
    if (!hit) return undefined;
    const path = `/api/authoring/${hit.kind}/${encodeURIComponent(hit.assetId)}/learn`;
    const model = this.options.authoringModel ? { model: this.options.authoringModel } : {};
    const response = await this.run('POST', path, model);
    await this.record(out, {
      method: 'POST',
      path,
      status: response.status,
      ok: response.status < HTTP_ERROR_MIN,
      step: 'Learning what it is for',
      ms: response.ms,
    });
    if (response.status >= HTTP_ERROR_MIN) {
      return {
        problem: clip(response.body),
        about: `The asset is ${hit.kind} "${hit.name}" (id ${hit.assetId}).`,
      };
    }
    const data = dataOf(response.body) ?? {};
    const drafts: any[] = Array.isArray(data.drafts) ? data.drafts : [];
    const questions: any[] = Array.isArray(data.questions) ? data.questions : [];
    const lines = [
      u.understanding,
      '',
      drafts.length
        ? `What I read into ${hit.kind} "${hit.name}" (unconfirmed until you say so; confirm or edit them in the Studio's Notes panel):\n${drafts.map((d) => `- ${d.text}`).join('\n')}`
        : `I could not say what ${hit.kind} "${hit.name}" is for from its definition alone.`,
      '',
      questions.length
        ? `What I cannot tell from the definition:\n${questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}\nAnswer any of these here and I will keep it on the right thing.`
        : 'Nothing was unclear enough to ask about.',
    ];
    return { reply: lines.join('\n') };
  }

  /** One asset in the graph for a name (or the id the conversation gave), or nothing when it is not one. */
  private async resolveAsset(
    asset: NonNullable<Understanding['asset']>,
    out: Collected
  ): Promise<{ kind: 'dashboard' | 'analysis'; assetId: string; name: string } | undefined> {
    const { kind, name, id } = asset;
    const started = this.now();
    const hits = (await searchHits(this.dispatch, { query: name, types: [kind] })).filter(
      (h) => h.type === kind
    );
    await this.record(out, {
      method: 'GET',
      path: `context_search "${name}"`,
      status: HTTP_OK,
      ok: true,
      step: 'Searching',
      ms: this.now() - started,
    });
    const named = hits.filter((h) => h.name.toLowerCase() === name.toLowerCase());
    const hit =
      (id ? hits.find((h) => h.entityId === `${kind}:${id}`) : undefined) ??
      (named.length === 1 ? named[0] : hits.length === 1 ? hits[0] : undefined);
    return hit
      ? { kind, assetId: hit.entityId.slice(kind.length + 1), name: hit.name || name }
      : undefined;
  }

  /** The planner model an answer used, once, for its chip and its cost. */
  private recordPlanner(body: string, out: Collected): void {
    const planner = plannerModelOf(body);
    if (planner && !out.helpers.some((h) => h.modelId === planner.model)) {
      const known = AI_MODELS.find((m) => m.modelId === planner.model);
      out.helpers.push({
        role: 'planner',
        label: known?.label ?? planner.model,
        modelId: planner.model,
        provider: planner.provider,
      });
    }
  }

  /**
   * The Run button under a plan: its build, exactly. A plan from an earlier
   * answer is previewed again first, since the account may have moved on.
   */
  private async preparePlan(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const wanted = str(input, 'planId');
    const here = out.artifacts.filter(
      (a): a is Extract<AssistantArtifact, { kind: 'plan' }> => a.kind === 'plan'
    );
    const plan =
      (wanted
        ? (here.find((p) => p.id === wanted) ?? this.earlierPlans.find((p) => p.id === wanted))
        : (here.at(-1) ?? this.earlierPlans.at(-1))) ?? undefined;
    if (!plan) {
      return {
        id,
        content: wanted
          ? `No plan ${wanted} in this conversation. Draw it with show_plan.`
          : 'There is no plan to prepare. Draw one with show_plan first.',
        isError: true,
      };
    }
    if (out.actions.some((a) => a.planId === plan.id)) {
      return { id, content: 'Its Run button is already under the plan; nothing more to prepare.' };
    }
    const write = writeOf(plan.build);
    // The Run button shows the plan's own preview. A plan from an earlier
    // answer is checked again (the account may have moved on) and bound to
    // that fresh preview.
    let previewId = here.find((p) => p.id === plan.id)?.previewId;
    if (!previewId) {
      const checked = await this.checkPlanned(plan.build, [], out);
      if ('problem' in checked) {
        return { id, content: checked.problem, isError: true };
      }
      previewId = checked.previewId;
    }
    out.actions.push({
      id: randomUUID(),
      title: write.title,
      why: str(input, 'why') || plan.title,
      method: write.method,
      path: write.path,
      body: write.body,
      planId: plan.id,
      previewId,
    });
    return {
      id,
      content: 'Prepared. The person sees the plan with a Run button; it has not run.',
    };
  }

  /** A write checked against the contract and rehearsed through its preview. */
  private async checkWrite(
    write: { method: string; path: string; body: unknown },
    out: Collected
  ): Promise<{ problem?: string; built?: string; previewId?: string; data?: any }> {
    const template = matchOperation(spec as never, write.method, write.path);
    if (!template) {
      return { problem: `${write.method} ${write.path} is not an operation in the API.` };
    }
    const problems = bodyErrors(spec as never, write.method, template, write.body);
    if (problems.length > 0) {
      return {
        problem: `It does not fit ${write.method} ${template}:\n${problems.map((p) => `- ${p}`).join('\n')}\nThe operation expects:\n${describeOperation(spec as never, write.method, template)}`,
      };
    }
    return await this.rehearse(write.method, write.path, template, write.body, out);
  }

  /**
   * A plan's build, checked as its write and held to what the person asked
   * for. Its preview is run; every requested filter the preview did not
   * build is put into the build by code (on the dataset that has the
   * column, with the control asked for) and it is previewed again. The
   * result is bound to that preview by id. Anything that still is not
   * built, or that the build claims and the preview lacks, is a problem:
   * a plan is never shown saying what the change will not do.
   */
  private async checkPlanned(
    build: PlanBuild,
    requested: RequestedFilter[],
    out: Collected
  ): Promise<
    | { build: PlanBuild; previewId: string; definition: unknown; built?: string }
    | { problem: string }
  > {
    let current = build;
    let checked = await this.checkWrite(writeOf(current), out);
    if (checked.problem) {
      return { problem: checked.problem };
    }
    const missing = missingRequested(requested, checked.data?.definition);
    if (missing.length > 0) {
      const targets = await this.filterTargets(current, checked.data?.definition);
      const placed = withRequestedFilters(current, missing, targets);
      if (placed.problems.length > 0) {
        return { problem: placed.problems.join('\n') };
      }
      current = placed.build;
      checked = await this.checkWrite(writeOf(current), out);
      if (checked.problem) {
        return { problem: checked.problem };
      }
    }
    const definition = checked.data?.definition;
    if (!checked.previewId || !definition) {
      return { problem: 'The preview of this build drew no definition, so it cannot be checked.' };
    }
    const unbuilt = [
      ...missingRequested(requested, definition).map(
        (f) =>
          `The person asked for a filter on ${f.column}${f.control ? ` with a ${f.control} control` : ''}, and the preview still does not build it.`
      ),
      ...unbuiltClaims(current, definition),
    ];
    if (unbuilt.length > 0) {
      return { problem: unbuilt.join('\n') };
    }
    return {
      build: current,
      previewId: checked.previewId,
      definition,
      ...(checked.built ? { built: checked.built } : {}),
    };
  }

  /** The datasets a build reads (with their columns) and its first sheet, from its preview. */
  private async filterTargets(build: PlanBuild, definition: unknown): Promise<FilterTargets> {
    const declared = declaredDatasets(definition);
    const fromBuild: Array<{ identifier: string; dataSetId: string }> =
      'create' in build && Array.isArray(build.create.datasets)
        ? build.create.datasets.filter((d: any) => d?.identifier && d?.dataSetId)
        : [];
    const byIdentifier = new Map(
      [...declared.datasets, ...fromBuild].map((d) => [d.identifier, d.dataSetId])
    );
    const datasets = await Promise.all(
      [...byIdentifier].map(async ([identifier, dataSetId]) => ({
        identifier,
        dataSetId,
        columns: (await datasetColumns(this.dispatch, dataSetId).catch(() => [])).map(
          (c) => c.name
        ),
      }))
    );
    return { datasets, ...(declared.sheetId ? { sheetId: declared.sheetId } : {}) };
  }

  /**
   * A question with options, as an AG-UI interrupt: the page draws the
   * options as cards (with the graph's summary of any entity they name) and
   * sends the choice back as a resume entry matching responseSchema.
   */
  private async askPerson(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    if (out.interrupts.length > 0) {
      return { id, content: 'One question per answer; you already asked one.', isError: true };
    }
    const question = str(input, 'question');
    const raw = Array.isArray(input.options) ? (input.options as unknown[]) : [];
    const multi = input.multi === true;
    const allowOther = input.allowOther === true;
    if (
      !question ||
      raw.length === 0 ||
      raw.length > MAX_OPTIONS ||
      (raw.length < 2 && !allowOther)
    ) {
      return {
        id,
        content: `ask_person needs a question and 2-${MAX_OPTIONS} options (or 1 with allowOther). For an open question, just ask it in your reply.`,
        isError: true,
      };
    }
    const seen = new Set<string>();
    const options: QuestionOption[] = [];
    for (const item of raw) {
      const o = (item ?? {}) as Record<string, unknown>;
      const label = str(o, 'label');
      if (!label) continue;
      const entityId = str(o, 'entityId') || undefined;
      const optionId = entityId ?? (str(o, 'id') || slug(label));
      if (seen.has(optionId)) continue;
      seen.add(optionId);
      options.push({
        id: optionId,
        label,
        ...(str(o, 'description') ? { description: str(o, 'description') } : {}),
        ...(entityId ? { entityId } : {}),
      });
    }
    // Options that name an entity get its one-line summary and portal path from the graph.
    await Promise.all(
      options
        .filter((o) => o.entityId)
        .map(async (o) => {
          try {
            const response = await this.dispatch({
              method: 'GET',
              path: `/api/context/entities/${encodeURIComponent(o.entityId!)}`,
            });
            const entity = JSON.parse(response.body)?.data?.entity;
            if (entity?.summary) o.summary = String(entity.summary);
            if (entity?.path) o.path = String(entity.path);
          } catch {
            // An option without a summary still works.
          }
        })
    );
    const ids = options.map((o) => o.id);
    out.interrupts.push({
      id: randomUUID(),
      reason: 'input_required',
      message: question,
      toolCallId: id,
      responseSchema: {
        type: 'object',
        properties: {
          selected: {
            type: 'array',
            items: { type: 'string', enum: ids },
            minItems: allowOther ? 0 : 1,
            maxItems: multi ? ids.length : 1,
          },
          ...(allowOther ? { other: { type: 'string' } } : {}),
        },
        required: ['selected'],
      },
      metadata: { options, multi, allowOther },
    });
    return {
      id,
      content:
        "Asked. This answer ends here; the person's choice arrives with their next message as an answer to this question.",
    };
  }

  private showToPerson(id: string, input: Record<string, unknown>, out: Collected): ToolResult {
    const kind = str(input, 'kind');
    const title = str(input, 'title') || 'Shown';
    if (kind === 'asset') {
      const assetType = str(input, 'assetType');
      const assetId = str(input, 'assetId');
      if ((assetType !== 'dashboard' && assetType !== 'analysis') || !assetId) {
        return {
          id,
          content: 'asset needs assetType (dashboard or analysis) and assetId.',
          isError: true,
        };
      }
      out.artifacts.push({ id: randomUUID(), kind: 'asset', title, assetType, assetId });
      return { id, content: 'Shown as a wireframe.' };
    }
    if (kind === 'lineage') {
      const fieldKey = str(input, 'fieldKey').replace(/^calculated-field:/, '');
      if (!fieldKey) {
        return { id, content: 'lineage needs the fieldKey.', isError: true };
      }
      out.artifacts.push({ id: randomUUID(), kind: 'lineage', title, fieldKey });
      return { id, content: 'Lineage shown.' };
    }
    return { id, content: "kind must be 'asset' or 'lineage'.", isError: true };
  }

  // --- what the person said, kept ---------------------------------------------

  /** A fact the person stated, kept on the thing it is about, in their name. */
  private async remember(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const entityId = str(input, 'entityId');
    const kind = str(input, 'kind');
    const text = str(input, 'text');
    if (!entityId || !kind || !text) {
      return { id, content: 'remember needs entityId, kind and text.', isError: true };
    }
    await this.progress('Keeping what you said');
    const path = `/api/knowledge/${encodeURIComponent(entityId)}`;
    const resolves = str(input, 'resolves');
    const response = await this.run('POST', path, {
      kind,
      text,
      ...(resolves ? { resolves } : {}),
    });
    const ok = response.status < HTTP_ERROR_MIN;
    await this.record(out, {
      method: 'POST',
      path,
      status: response.status,
      ok,
      step: 'Keeping what you said',
      ms: response.ms,
    });
    return ok
      ? {
          id,
          content: `Kept on ${entityId}${resolves ? ', and the question is closed' : ''}. Say so.`,
        }
      : { id, content: `It could not be kept: ${clip(response.body)}`, isError: true };
  }

  // --- writes, prepared for the person ---------------------------------------

  private async proposeAction(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const method = str(input, 'method').toUpperCase();
    const path = str(input, 'path');
    const verdict = classifyCall(method, path);
    if (verdict === 'blocked') {
      return {
        id,
        content: `${method} ${path} is not something the assistant may prepare.`,
        isError: true,
      };
    }
    if (verdict === 'read') {
      return {
        id,
        content: 'That call only reads; run it with call_portal_api instead.',
        isError: true,
      };
    }
    const template = matchOperation(spec as never, method, path);
    if (!template) {
      return {
        id,
        content: `${method} ${path} is not an operation in the API. Take the path from the operations index and fill in its ids.`,
        isError: true,
      };
    }
    if (template === CREATE_NEW || template === EDIT_OPS) {
      return {
        id,
        content:
          'Creating or editing an analysis or dashboard comes from a plan: draw it with show_plan (its build is this write) and prepare it with prepare_plan, so what runs is exactly what the person saw.',
        isError: true,
      };
    }
    const problems = [
      ...queryErrors(spec as never, method, template, path),
      ...bodyErrors(spec as never, method, template, input.body),
    ];
    if (problems.length > 0) {
      return {
        id,
        content: `The request does not fit ${method} ${template}, so it would fail when the person runs it:\n${problems.map((p) => `- ${p}`).join('\n')}\nThe operation expects:\n${describeOperation(spec as never, method, template)}\nFix the body and prepare it again.`,
        isError: true,
      };
    }
    const rehearsal = await this.rehearse(method, path, template, input.body, out);
    if (rehearsal.problem) {
      return { id, content: rehearsal.problem, isError: true };
    }
    // The preview says what the new dataset would read: datasets that
    // already read that table, and the listing it would link to. An existing
    // dataset is reused unless the person said new.
    if (template === CREATE_DATASET && input.personAskedForNew !== true) {
      const existing = await this.existingDatasetsLike(rehearsal.data);
      if (existing.length > 0) {
        return {
          id,
          content: `Datasets already read what this one would: ${existing.join('; ')}. Use one of them. Only prepare a new dataset if the person explicitly asked for a new one (then set personAskedForNew).`,
          isError: true,
        };
      }
    }
    // Bound to its own preview, if it has one; never to whatever was drawn last.
    out.actions.push({
      id: randomUUID(),
      title: str(input, 'title') || `${method} ${path}`,
      why: str(input, 'why'),
      method: method as AssistantAction['method'],
      path,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(rehearsal.previewId ? { previewId: rehearsal.previewId } : {}),
    });
    return {
      id,
      content: `Prepared. The person will see it with a Run button; it has not run.${rehearsal.built ? ` The preview built: ${rehearsal.built}. Tell them if that is not what they asked for.` : ''}`,
    };
  }

  /**
   * A write with a read-only /preview twin (create an analysis, rebind,
   * publish a definition) is run through the preview first, with the same
   * body, unless the answer already previewed exactly that. Either way the
   * result is judged the same, and the preview is returned by id with what
   * it built, so the caller binds the write to its own preview.
   */
  private async rehearse(
    method: string,
    path: string,
    template: string,
    body: unknown,
    out: Collected
  ): Promise<{ problem?: string; built?: string; previewId?: string; data?: any }> {
    const pathname = path.split('?')[0] ?? '';
    const previewPath = `${pathname}/preview`;
    if (method !== 'POST' || !(spec as any).paths?.[`${template}/preview`]?.post) {
      return {};
    }
    // The write body adds its own fields (mode, name); what the preview reads must match.
    const fields = bodyFields(spec as never, 'POST', `${template}/preview`);
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const earlier = [...out.artifacts]
      .reverse()
      .find(
        (a) =>
          a.kind === 'preview' &&
          a.path === previewPath &&
          out.previews.has(a.id) &&
          fields.every((f) => same((a.body as any)?.[f], (body as any)?.[f]))
      );
    if (earlier) {
      const data = out.previews.get(earlier.id) as any;
      const problem = previewProblem(data);
      return problem ? { problem } : { built: describeBuilt(data), previewId: earlier.id, data };
    }
    await this.progress('Checking the change with a preview');
    const response = await this.run('POST', previewPath, body);
    await this.record(out, {
      method: 'POST',
      path: previewPath,
      status: response.status,
      ok: response.status < HTTP_ERROR_MIN,
      step: describeStep('POST', previewPath),
      ms: response.ms,
    });
    if (response.status >= HTTP_ERROR_MIN) {
      return {
        problem: `The preview of this change failed, so running it would too:\n${clip(response.body)}\nFix it and prepare it again.`,
      };
    }
    const data = dataOf(response.body);
    const problem = previewProblem(data);
    if (problem) {
      return { problem };
    }
    const previewId = this.capture('POST', previewPath, body, out, data);
    return { built: describeBuilt(data), ...(previewId ? { previewId } : {}), data };
  }

  /** Dispatch, waiting on a job when the call queued one. */
  private async run(
    method: string,
    path: string,
    body: unknown
  ): Promise<{ status: number; body: string; ms: number }> {
    const started = this.now();
    const response = await this.runUntimed(method, path, body);
    return { ...response, ms: this.now() - started };
  }

  private async runUntimed(
    method: string,
    path: string,
    body: unknown
  ): Promise<{ status: number; body: string }> {
    const response = await this.dispatch({ method, path, body });
    if (response.status !== HTTP_ACCEPTED) {
      return response;
    }
    let jobId: string | undefined;
    try {
      // Queued work answers { success, jobId } or { data: { jobId } }, by route.
      const parsed = JSON.parse(response.body);
      jobId = parsed?.jobId ?? parsed?.data?.jobId;
    } catch {
      jobId = undefined;
    }
    if (!jobId) {
      return response;
    }
    await this.progress(`${describeStep(method, path)}: waiting for it to answer`);
    return this.awaitJob(jobId);
  }

  /**
   * Datasets a new one would duplicate, as "name (id)": the preview's
   * `similar` (same table, as a table or in a query) and, when it would link
   * to a SMUS listing, every dataset the graph says reads that listing.
   */
  private async existingDatasetsLike(preview: any): Promise<string[]> {
    const similar: any[] = Array.isArray(preview?.similar) ? preview.similar : [];
    const names = new Map<string, string>(
      similar
        .filter((d) => typeof d?.dataSetId === 'string')
        .map((d) => [d.dataSetId, `${d.name ?? d.dataSetId} (id ${d.dataSetId})`])
    );
    const listingId = preview?.listing?.listingId;
    if (typeof listingId === 'string' && listingId) {
      for (const line of await this.linkedDatasets(listingId)) {
        const id = line.match(/\(id (\S+)\)$/)?.[1];
        if (!id || !names.has(id)) {
          names.set(id ?? line, line);
        }
      }
    }
    return [...names.values()];
  }

  /** The datasets the graph says already read a listing, as "name (id)". */
  private async linkedDatasets(listingId: string): Promise<string[]> {
    const result = await contextRelated(this.dispatch, {
      entityId: `listing:${listingId}`,
      relations: ['reads-listing'],
      direction: 'in',
    }).catch(() => ({ ok: false, text: '' }));
    if (!result.ok) {
      return [];
    }
    return result.text
      .split('\n')
      .map((line) => line.match(/^- dataset:(\S+?): (.+?)(?: \{| \(via |$)/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => `${m[2]} (id ${m[1]})`);
  }

  // --- the API ---------------------------------------------------------------

  private async callPortal(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const method = str(input, 'method').toUpperCase();
    const path = str(input, 'path');
    const verdict = classifyCall(method, path);
    if (verdict === 'blocked') {
      return { id, content: `${method} ${path} is not available to the assistant.`, isError: true };
    }
    if (verdict === 'action') {
      return {
        id,
        content: `${method} ${path} writes. Prepare it with propose_action so the person can run it.`,
        isError: true,
      };
    }
    if (method === 'POST' && PLAN_OWNED.test(path.split('?')[0] ?? '')) {
      // A second draft or preview of a build beside the plan's would show the
      // person something the plan does not run.
      return {
        id,
        content:
          'Drafting and previewing an analysis or dashboard belong to the plan: draw it with show_plan (name every filter in `filters`), and its preview is drawn with it.',
        isError: true,
      };
    }
    try {
      const body = input.body;
      await this.progress(describeStep(method, path));
      const response = await this.run(method, path, body);
      const ok = response.status < HTTP_ERROR_MIN;
      await this.record(out, {
        method,
        path,
        status: response.status,
        ok,
        step: describeStep(method, path),
        ms: response.ms,
      });
      if (ok) {
        this.recordPlanner(response.body, out);
        this.capture(method, path, body, out, dataOf(response.body));
      }
      return { id, content: clip(`HTTP ${response.status}\n${response.body}`), isError: !ok };
    } catch (error) {
      await this.record(out, {
        method,
        path,
        status: HTTP_SERVER_ERROR,
        ok: false,
        step: describeStep(method, path),
      });
      return {
        id,
        content: `The call failed: ${errorMessage(error)}`,
        isError: true,
      };
    }
  }

  /**
   * A read that queued a job (the planner): wait for it, as the person
   * would, and hand the model its result instead of a job id.
   */
  private async awaitJob(jobId: string): Promise<{ status: number; body: string }> {
    const deadline = this.now() + MAX_JOB_WAIT_MS;
    // Looked at once before any wait: a job run in this very process (the
    // planner, inside the worker) is often done already.
    for (;;) {
      const job = await this.dispatch({
        method: 'GET',
        path: `/api/jobs/${encodeURIComponent(jobId)}`,
      });
      let status = '';
      let message = '';
      try {
        const parsed = JSON.parse(job.body);
        status = parsed?.data?.status ?? '';
        message = parsed?.data?.message ?? parsed?.data?.error ?? '';
      } catch {
        // An unreadable status is retried until the deadline.
      }
      if (TERMINAL.has(status)) {
        if (status !== 'completed') {
          return { status: HTTP_SERVER_ERROR, body: `The job ${status}: ${message}` };
        }
        return this.dispatch({
          method: 'GET',
          path: `/api/jobs/${encodeURIComponent(jobId)}/result`,
        });
      }
      if (this.now() >= deadline) {
        break;
      }
      await this.sleep(JOB_POLL_MS);
    }
    return {
      status: HTTP_ACCEPTED,
      body: `Job ${jobId} is still running after ${MAX_JOB_WAIT_MINUTES} minutes. Tell the person its id; it will appear under Operations.`,
    };
  }

  /** Previews that draw, and calculated fields read, become things to show. */
  private capture(
    method: string,
    path: string,
    body: unknown,
    out: Collected,
    data?: unknown
  ): string | undefined {
    const { artifacts } = out;
    const pathname = path.split('?')[0] ?? '';
    if (method === 'POST' && DRAWABLE_PREVIEW.test(pathname)) {
      const previewId = randomUUID();
      artifacts.push({
        id: previewId,
        kind: 'preview',
        title: 'Preview',
        method: 'POST',
        path: pathname,
        ...(body !== undefined ? { body } : {}),
      });
      if (data !== undefined) out.previews.set(previewId, data);
      return previewId;
    }
    const field = method === 'GET' ? pathname.match(CALCULATED_FIELD) : null;
    if (field?.[1] && !artifacts.some((a) => a.kind === 'lineage' && a.fieldKey === field[1])) {
      artifacts.push({
        id: randomUUID(),
        kind: 'lineage',
        title: 'Lineage',
        fieldKey: decodeURIComponent(field[1]),
      });
    }
    return undefined;
  }
}
