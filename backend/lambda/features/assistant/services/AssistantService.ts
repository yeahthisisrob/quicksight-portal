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
import { type AiModel, costOf } from '../../../shared/ai/modelCatalog';
import { logger } from '../../../shared/utils/logger';
import { bodyErrors, bodyFields, matchOperation } from '../lib/bodyCheck';
import { contextGet, contextRelated, contextSearch, datasetColumns } from '../lib/contextTools';
import { judgeFields, parsePlan, verdictsMessage } from '../lib/planning';
import { buildBrief, listTemplates } from '../lib/portalBrief';
import { classifyCall, describeOperation } from '../lib/portalCalls';
import { announcesMore, CONTINUE_NUDGE, describeStep } from '../lib/steps';
import type {
  AssistantAction,
  AssistantArtifact,
  AssistantCall,
  AssistantChatResult,
  ChatHistoryMessage,
} from '../types';
import { NO_GUIDANCE, systemPrompt } from './assistantPrompt';
import { ASSISTANT_TOOLS } from './assistantTools';
import type { ChatModel, ChatSystem, ChatTurn, ToolResult } from './ChatModel';

export { parsePlan } from '../lib/planning';
export { announcesMore, CONTINUE_NUDGE, describeStep } from '../lib/steps';

const MAX_ROUNDS = 8;
const MAX_RESULT_CHARS = 12_000;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8_000;
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
const PROPOSE = /\/propose$/;
const CREATE_DATASET = /^\/api\/smus\/assets\/([^/?]+)\/dataset$/;
const TERMINAL = new Set(['completed', 'failed', 'stopped']);
const CALCULATED_FIELD = /^\/api\/data-catalog\/calculated-fields\/([^/?]+)$/;
const DRAWABLE_PREVIEW =
  /^\/api\/authoring\/(new|definition|(analysis|dashboard)\/[^/]+\/(rebind|definition))\/preview$/;

/** How far along the assistant is, for the person watching. */
export type ProgressReporter = (message: string) => Promise<void> | void;

/** Runs one of the portal's own routes as the person, in-process. */
export type PortalDispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

export interface AssistantOptions {
  onProgress?: ProgressReporter;
  /** Whether SMUS is configured: its concepts are only described when it is. */
  smus?: boolean;
  /** The organisation's authoring guidance from Settings. */
  guidance?: AuthoringGuidance;
  /** Read the account's state (SMUS, catalog, templates) before answering. */
  brief?: boolean;
  /** Sent as `model` on propose calls that do not name one. */
  authoringModel?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

interface Collected {
  calls: AssistantCall[];
  actions: AssistantAction[];
  artifacts: AssistantArtifact[];
}

function clip(text: string): string {
  return text.length > MAX_RESULT_CHARS
    ? `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated ${text.length - MAX_RESULT_CHARS} characters: narrow the request with limit, pageSize, search or types]`
    : text;
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

export class AssistantService {
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

  public async respond(history: ChatHistoryMessage[]): Promise<AssistantChatResult> {
    const turns: ChatTurn[] = history
      .slice(-MAX_HISTORY)
      .map((m) =>
        m.role === 'user'
          ? { role: 'user', text: m.text.slice(0, MAX_MESSAGE_CHARS) }
          : { role: 'assistant', text: m.text.slice(0, MAX_MESSAGE_CHARS), toolCalls: [] }
      );
    const out: Collected = { calls: [], actions: [], artifacts: [] };
    const usage = { inputTokens: 0, outputTokens: 0 };
    let reply = '';
    let rounds = 0;
    let nudged = false;

    let brief: string | undefined;
    if (this.options.brief) {
      await this.progress('Reading the portal');
      brief = await buildBrief(this.dispatch).catch(() => undefined);
    }
    const prompt: ChatSystem = {
      stable: systemPrompt({
        smus: this.options.smus ?? true,
        guidance: this.options.guidance ?? NO_GUIDANCE,
      }),
      ...(brief ? { context: brief } : {}),
    };

    while (rounds < MAX_ROUNDS) {
      rounds += 1;
      await this.progress(rounds === 1 ? 'Thinking' : 'Thinking about what it found');
      const turn = await this.chat.turn(prompt, turns, ASSISTANT_TOOLS);
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;
      turns.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });
      if (turn.text) {
        reply = turn.text;
      }
      if (turn.toolCalls.length === 0) {
        // Once per answer: an answer that ends on a promise is pushed to
        // keep going instead of leaving the person waiting on nothing.
        if (!nudged && rounds < MAX_ROUNDS && announcesMore(turn.text)) {
          nudged = true;
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
    };
  }

  private async progress(message: string): Promise<void> {
    try {
      await this.options.onProgress?.(message);
    } catch {
      // Progress is a courtesy; never fail the answer over it.
    }
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
        out.calls.push({ method: 'GET', path: 'list_templates', status: HTTP_OK, ok: true });
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
      case 'show_to_person':
        return this.showToPerson(id, input, out);
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
    out.calls.push({
      method: 'GET',
      path: `${name} ${name === 'context_search' ? `"${str(input, 'query')}"` : entityId}`,
      status: result.ok ? HTTP_OK : HTTP_NOT_FOUND,
      ok: result.ok,
    });
    return { id, content: clip(result.text), isError: !result.ok };
  }

  // --- showing ---------------------------------------------------------------

  private async showPlan(
    id: string,
    input: Record<string, unknown>,
    out: Collected
  ): Promise<ToolResult> {
    const plan = parsePlan(input);
    if (typeof plan === 'string') {
      return { id, content: plan, isError: true };
    }
    out.artifacts.push({
      id: randomUUID(),
      kind: 'plan',
      title: str(input, 'title') || 'The plan',
      ...plan,
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
    return { id, content: verdictsMessage(judged) };
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
    const listing = path.match(CREATE_DATASET)?.[1];
    if (method === 'POST' && listing && input.personAskedForNew !== true) {
      const linked = await this.linkedDatasets(decodeURIComponent(listing));
      if (linked.length > 0) {
        return {
          id,
          content: `This listing already has linked QuickSight datasets: ${linked.join('; ')}. Use one of them. Only prepare a new dataset if the person explicitly asked for a new one (then set personAskedForNew).`,
          isError: true,
        };
      }
    }
    const template = matchOperation(spec as never, method, path);
    if (!template) {
      return {
        id,
        content: `${method} ${path} is not an operation in the API. Take the path from the operations index and fill in its ids.`,
        isError: true,
      };
    }
    const problems = bodyErrors(spec as never, method, template, input.body);
    if (problems.length > 0) {
      return {
        id,
        content: `The body does not fit ${method} ${template}, so it would fail when the person runs it:\n${problems.map((p) => `- ${p}`).join('\n')}\nThe operation expects:\n${describeOperation(spec as never, method, template)}\nFix the body and prepare it again.`,
        isError: true,
      };
    }
    const rehearsal = await this.rehearse(method, path, template, input.body, out);
    if (rehearsal) {
      return { id, content: rehearsal, isError: true };
    }
    const preview = [...out.artifacts].reverse().find((a) => a.kind === 'preview');
    const plan = [...out.artifacts].reverse().find((a) => a.kind === 'plan');
    out.actions.push({
      id: randomUUID(),
      title: str(input, 'title') || `${method} ${path}`,
      why: str(input, 'why'),
      method: method as AssistantAction['method'],
      path,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(preview ? { previewId: preview.id } : {}),
      ...(plan ? { planId: plan.id } : {}),
    });
    return { id, content: 'Prepared. The person will see it with a Run button; it has not run.' };
  }

  /**
   * A write with a read-only /preview twin (create an analysis, rebind,
   * publish a definition) is run through the preview first, with the same
   * body, unless the answer already previewed exactly that. A failed or
   * refused preview is returned as the reason; a good one is drawn.
   */
  private async rehearse(
    method: string,
    path: string,
    template: string,
    body: unknown,
    out: Collected
  ): Promise<string | undefined> {
    const pathname = path.split('?')[0] ?? '';
    const previewPath = `${pathname}/preview`;
    if (method !== 'POST' || !(spec as any).paths?.[`${template}/preview`]?.post) {
      return undefined;
    }
    // The write body adds its own fields (mode, name); what the preview reads must match.
    const fields = bodyFields(spec as never, 'POST', `${template}/preview`);
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const already = out.artifacts.some(
      (a) =>
        a.kind === 'preview' &&
        a.path === previewPath &&
        fields.every((f) => same((a.body as any)?.[f], (body as any)?.[f]))
    );
    if (already) {
      return undefined;
    }
    await this.progress('Checking the change with a preview');
    const response = await this.run('POST', previewPath, body);
    out.calls.push({
      method: 'POST',
      path: previewPath,
      status: response.status,
      ok: response.status < HTTP_ERROR_MIN,
    });
    if (response.status >= HTTP_ERROR_MIN) {
      return `The preview of this change failed, so running it would too:\n${clip(response.body)}\nFix it and prepare it again.`;
    }
    let data: any;
    try {
      data = JSON.parse(response.body)?.data;
    } catch {
      data = undefined;
    }
    if (data?.canApply === false) {
      return `The preview says QuickSight would refuse this as it stands:\n${clip(JSON.stringify({ issues: data.issues, warnings: data.warnings, summary: data.summary }))}\nFix it and prepare it again.`;
    }
    this.capture('POST', previewPath, body, out.artifacts);
    return undefined;
  }

  /** Dispatch, waiting on a job when the call queued one. */
  private async run(
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
      jobId = JSON.parse(response.body)?.data?.jobId;
    } catch {
      jobId = undefined;
    }
    if (!jobId) {
      return response;
    }
    await this.progress(`${describeStep(method, path)}: waiting for it to answer`);
    return this.awaitJob(jobId);
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
    try {
      const pathname = path.split('?')[0] ?? '';
      const body =
        PROPOSE.test(pathname) &&
        this.options.authoringModel &&
        input.body &&
        typeof input.body === 'object' &&
        !('model' in (input.body as Record<string, unknown>))
          ? { ...(input.body as Record<string, unknown>), model: this.options.authoringModel }
          : input.body;
      await this.progress(describeStep(method, path));
      const response = await this.run(method, path, body);
      const ok = response.status < HTTP_ERROR_MIN;
      out.calls.push({ method, path, status: response.status, ok });
      if (ok) {
        this.capture(method, path, body, out.artifacts);
      }
      return { id, content: clip(`HTTP ${response.status}\n${response.body}`), isError: !ok };
    } catch (error) {
      out.calls.push({ method, path, status: HTTP_SERVER_ERROR, ok: false });
      return {
        id,
        content: `The call failed: ${error instanceof Error ? error.message : String(error)}`,
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
    while (this.now() < deadline) {
      await this.sleep(JOB_POLL_MS);
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
      if (!TERMINAL.has(status)) {
        continue;
      }
      if (status !== 'completed') {
        return { status: HTTP_SERVER_ERROR, body: `The job ${status}: ${message}` };
      }
      return this.dispatch({
        method: 'GET',
        path: `/api/jobs/${encodeURIComponent(jobId)}/result`,
      });
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
    artifacts: AssistantArtifact[]
  ): void {
    const pathname = path.split('?')[0] ?? '';
    if (method === 'POST' && DRAWABLE_PREVIEW.test(pathname)) {
      artifacts.push({
        id: randomUUID(),
        kind: 'preview',
        title: 'Preview',
        method: 'POST',
        path: pathname,
        ...(body !== undefined ? { body } : {}),
      });
      return;
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
  }
}
