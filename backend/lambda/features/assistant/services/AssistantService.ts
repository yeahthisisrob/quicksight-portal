/**
 * The assistant: a conversation with a model that can use the portal's own
 * API. It reads (search, cached exports, catalog, columns) and previews by
 * itself; anything that writes it prepares as an action the person runs.
 * The loop is bounded in rounds and in how much of each response it reads,
 * so a question costs cents, not dollars.
 */
import { randomUUID } from 'node:crypto';

import spec from '../../../../../shared/generated/openapi.json';
import { type AiModel, costOf } from '../../../shared/ai/modelCatalog';
import { logger } from '../../../shared/utils/logger';
import { apiIndex, classifyCall, describeOperation } from '../lib/portalCalls';
import type {
  AssistantAction,
  AssistantArtifact,
  AssistantCall,
  AssistantChatResult,
  ChatHistoryMessage,
} from '../types';
import type { ChatModel, ChatTool, ChatTurn, ToolResult } from './ChatModel';

const MAX_ROUNDS = 8;
const MAX_RESULT_CHARS = 12_000;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_ARTIFACTS = 6;
const HTTP_ERROR_MIN = 400;
const HTTP_ACCEPTED = 202;
/** A planner job usually answers in under a minute; give up well inside the worker's 15. */
const MS_PER_MINUTE = 60_000;
const MAX_JOB_WAIT_MINUTES = 5;
const MAX_JOB_WAIT_MS = MAX_JOB_WAIT_MINUTES * MS_PER_MINUTE;
const JOB_POLL_MS = 2_000;
const PROPOSE = /\/propose$/;
const TERMINAL = new Set(['completed', 'failed', 'stopped']);

/** How far along the assistant is, for the person watching. */
export type ProgressReporter = (message: string) => Promise<void> | void;

export interface AssistantOptions {
  onProgress?: ProgressReporter;
  /** Sent as `model` on propose calls that do not name one. */
  authoringModel?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** "GET /api/search?q=margin" -> "Searching", for the progress line. */
export function describeStep(method: string, path: string): string {
  const pathname = path.split('?')[0] ?? '';
  if (pathname === '/api/search') return 'Searching';
  if (PROPOSE.test(pathname)) return 'Asking the planner';
  if (/\/preview$/.test(pathname)) return 'Previewing the change';
  if (/\/plan$/.test(pathname)) return 'Checking columns';
  if (/\/cached$/.test(pathname)) return 'Reading the definition';
  if (/calculated-fields/.test(pathname)) return 'Tracing calculated fields';
  if (/\/columns$/.test(pathname)) return 'Reading dataset columns';
  if (pathname.startsWith('/api/data-catalog')) return 'Reading the catalog';
  if (pathname.startsWith('/api/jobs')) return 'Checking a job';
  return method === 'GET' ? 'Reading' : 'Working';
}
const CALCULATED_FIELD = /^\/api\/data-catalog\/calculated-fields\/([^/?]+)$/;
const DRAWABLE_PREVIEW =
  /^\/api\/authoring\/(new|definition|(analysis|dashboard)\/[^/]+\/(rebind|definition))\/preview$/;

/** Runs one of the portal's own routes as the person, in-process. */
export type PortalDispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

const TOOLS: ChatTool[] = [
  {
    name: 'call_portal_api',
    description:
      "Call the portal's API as the person you are helping. GETs and read-only POSTs (previews, plans, validations) run and return the response. Anything that writes is refused here: prepare it with propose_action instead.",
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST'] },
        path: {
          type: 'string',
          description:
            'A real path with its ids filled in and any query string, e.g. /api/search?q=gold%20orders&limit=5',
        },
        body: { type: 'object', description: 'JSON body for a POST.' },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'describe_operation',
    description:
      "An operation's parameters, request body and response shape. Use before a POST you have not made yet.",
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        path: { type: 'string', description: 'The template path exactly as the index lists it.' },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'show_to_person',
    description:
      "Put something in front of the person, drawn: an existing dashboard or analysis as a wireframe, or a calculated field's lineage (the columns and fields it is built from, and what is built from it, across composite datasets). Previews you run are shown automatically; use this for the current state or for lineage.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['asset', 'lineage'] },
        title: { type: 'string' },
        assetType: { type: 'string', enum: ['dashboard', 'analysis'] },
        assetId: { type: 'string' },
        fieldKey: {
          type: 'string',
          description: 'The key from GET /api/data-catalog/calculated-fields.',
        },
      },
      required: ['kind', 'title'],
    },
  },
  {
    name: 'propose_action',
    description:
      'Prepare a write (apply, create, grant, tag, delete) for the person to run. Preview it first when a preview exists. It is not run until they click it.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, e.g. "Publish the gold copy".' },
        why: { type: 'string', description: 'One sentence on what it does and what it changes.' },
        method: { type: 'string', enum: ['POST', 'PUT', 'DELETE'] },
        path: { type: 'string' },
        body: { type: 'object' },
      },
      required: ['title', 'why', 'method', 'path'],
    },
  },
];

let systemPrompt: string | null = null;

/** Built once per container: the rules, then the map of every operation. */
function system(): string {
  if (!systemPrompt) {
    systemPrompt = [
      'You are the assistant inside a QuickSight Assets Portal. You help analysts find QuickSight assets, understand them, and build or change dashboards and analyses, using the portal API below as the person you are helping.',
      '',
      'How to work:',
      '- Read before you answer. Start with GET /api/search?q=... in plain words; it finds dashboards, analyses, datasets, SMUS listings, calculated fields and visuals. Use limit and types to keep responses small.',
      '- Never invent ids, column names or paths. Take them from responses. If a path takes a template ({assetId}), fill it with a real id.',
      '- For a change, preview it first (the .../preview endpoints) and say what the preview found. The person sees the preview drawn as a wireframe. Then prepare the write with propose_action; it is shown beside that wireframe so they can confirm and run it. You cannot run writes yourself.',
      '- For a calculated field, find its key with GET /api/data-catalog/calculated-fields?search=..., read GET /api/data-catalog/calculated-fields/{key}, and show its lineage with show_to_person. Do the same when a question is about where a number comes from.',
      '- To have the planner propose a rebind or visuals, call the propose endpoint yourself: you wait for it and get the proposal back. Then preview what it proposed so the person sees it drawn, and prepare the write.',
      '- Other calls that return a jobId run in the background; tell the person.',
      '- Be brief. Answer in a few sentences or a short list. Name assets by name, with their id when the person will need it.',
      '',
      'Operations (method, path, summary):',
      apiIndex(spec as never),
    ].join('\n');
  }
  return systemPrompt;
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

  private async progress(message: string): Promise<void> {
    try {
      await this.options.onProgress?.(message);
    } catch {
      // Progress is a courtesy; never fail the answer over it.
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
        return { status: 500, body: `The job ${status}: ${message}` };
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

  public async respond(history: ChatHistoryMessage[]): Promise<AssistantChatResult> {
    const turns: ChatTurn[] = history
      .slice(-MAX_HISTORY)
      .map((m) =>
        m.role === 'user'
          ? { role: 'user', text: m.text.slice(0, MAX_MESSAGE_CHARS) }
          : { role: 'assistant', text: m.text.slice(0, MAX_MESSAGE_CHARS), toolCalls: [] }
      );
    const calls: AssistantCall[] = [];
    const actions: AssistantAction[] = [];
    const artifacts: AssistantArtifact[] = [];
    const usage = { inputTokens: 0, outputTokens: 0 };
    let reply = '';
    let rounds = 0;

    while (rounds < MAX_ROUNDS) {
      rounds += 1;
      await this.progress(rounds === 1 ? 'Thinking' : 'Thinking about what it found');
      const turn = await this.chat.turn(system(), turns, TOOLS);
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;
      turns.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });
      if (turn.text) {
        reply = turn.text;
      }
      if (turn.toolCalls.length === 0) {
        break;
      }
      const results: ToolResult[] = [];
      for (const call of turn.toolCalls) {
        results.push(
          await this.runTool(call.id, call.name, call.input, { calls, actions, artifacts })
        );
      }
      turns.push({ role: 'tool', results });
      if (rounds === MAX_ROUNDS) {
        reply ||= 'I ran out of steps before finishing; ask me to continue from here.';
      }
    }

    logger.info('Assistant answered', {
      model: this.model.key,
      rounds,
      calls: calls.length,
      actions: actions.length,
      ...usage,
    });
    return {
      reply: reply || 'Done.',
      calls,
      actions,
      artifacts: artifacts.slice(-MAX_ARTIFACTS),
      model: { key: this.model.key, label: this.model.label, modelId: this.model.modelId },
      usage,
      cost: costOf(this.model, usage),
      rounds,
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

  private async runTool(
    id: string,
    name: string,
    input: Record<string, unknown>,
    out: { calls: AssistantCall[]; actions: AssistantAction[]; artifacts: AssistantArtifact[] }
  ): Promise<ToolResult> {
    const { calls, actions, artifacts } = out;
    const method = str(input, 'method').toUpperCase();
    const path = str(input, 'path');
    if (name === 'describe_operation') {
      return { id, content: describeOperation(spec as never, method, path) };
    }
    if (name === 'show_to_person') {
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
        artifacts.push({ id: randomUUID(), kind: 'asset', title, assetType, assetId });
        return { id, content: 'Shown as a wireframe.' };
      }
      if (kind === 'lineage') {
        const fieldKey = str(input, 'fieldKey');
        if (!fieldKey) {
          return { id, content: 'lineage needs the fieldKey.', isError: true };
        }
        artifacts.push({ id: randomUUID(), kind: 'lineage', title, fieldKey });
        return { id, content: 'Lineage shown.' };
      }
      return { id, content: "kind must be 'asset' or 'lineage'.", isError: true };
    }
    if (name === 'propose_action') {
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
      const preview = [...artifacts].reverse().find((a) => a.kind === 'preview');
      actions.push({
        id: randomUUID(),
        title: str(input, 'title') || `${method} ${path}`,
        why: str(input, 'why'),
        method: method as AssistantAction['method'],
        path,
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(preview ? { previewId: preview.id } : {}),
      });
      return { id, content: 'Prepared. The person will see it with a Run button; it has not run.' };
    }
    if (name !== 'call_portal_api') {
      return { id, content: `Unknown tool ${name}.`, isError: true };
    }
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
      let response = await this.dispatch({ method, path, body });
      if (response.status === HTTP_ACCEPTED) {
        const jobId = (() => {
          try {
            return JSON.parse(response.body)?.data?.jobId as string | undefined;
          } catch {
            return undefined;
          }
        })();
        if (jobId) {
          await this.progress(`${describeStep(method, path)}: waiting for it to answer`);
          response = await this.awaitJob(jobId);
        }
      }
      const ok = response.status < HTTP_ERROR_MIN;
      calls.push({ method, path, status: response.status, ok });
      if (ok) {
        this.capture(method, path, body, artifacts);
      }
      return { id, content: clip(`HTTP ${response.status}\n${response.body}`), isError: !ok };
    } catch (error) {
      calls.push({ method, path, status: 500, ok: false });
      return {
        id,
        content: `The call failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
