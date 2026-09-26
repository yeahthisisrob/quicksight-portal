/**
 * The run input beyond the messages (AG-UI RunAgentInput's threadId, state
 * and resume), validated and bounded: it rides in an SQS message, so large
 * draft bodies are clipped rather than refused. Pure.
 */
import type { ResumeEntry, WorkingState } from '../types';

const MAX_ENTRIES = 20;
const MAX_BODY_CHARS = 8_000;
const MAX_RESULT_CHARS = 2_000;
const MAX_TEXT = 300;
const MAX_ID = 100;
const MAX_METHOD = 10;
const MAX_PATH = 500;
const MAX_ERROR = 1_000;
/** Bounded for the SQS message the run rides in (256 KB with the history). */
const MAX_PLANS = 5;
const MAX_PLAN_CHARS = 20_000;

export interface RunInput {
  threadId?: string;
  state?: WorkingState;
  resume?: ResumeEntry[];
}

function text(value: unknown, max = MAX_TEXT): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

/** A body or result small enough to carry, or a note that it was too large. */
function bounded(value: unknown, max: number): unknown {
  if (value === undefined) return undefined;
  const json = JSON.stringify(value);
  return json.length <= max
    ? value
    : `[${json.length} characters, not carried; read it again if needed]`;
}

export function parseRunInput(body: Record<string, unknown>): RunInput | string {
  const out: RunInput = {};
  if (body.threadId !== undefined) {
    const threadId = text(body.threadId, MAX_ID);
    if (!threadId) return 'threadId must be a non-empty string';
    out.threadId = threadId;
  }
  if (body.resume !== undefined) {
    if (!Array.isArray(body.resume) || body.resume.length > MAX_ENTRIES) {
      return `resume must be an array of at most ${MAX_ENTRIES} entries`;
    }
    const resume: ResumeEntry[] = [];
    for (const raw of body.resume as unknown[]) {
      const entry = (raw ?? {}) as Record<string, unknown>;
      const interruptId = text(entry.interruptId, MAX_ID);
      if (!interruptId || (entry.status !== 'resolved' && entry.status !== 'cancelled')) {
        return "each resume entry needs interruptId and status 'resolved' or 'cancelled'";
      }
      resume.push({
        interruptId,
        status: entry.status,
        ...(entry.payload !== undefined
          ? { payload: bounded(entry.payload, MAX_RESULT_CHARS) }
          : {}),
      });
    }
    out.resume = resume;
  }
  if (body.state !== undefined) {
    const raw = (body.state ?? {}) as Record<string, unknown>;
    const list = (value: unknown) => (Array.isArray(value) ? value.slice(-MAX_ENTRIES) : []);
    out.state = {
      // Plans carry their whole build (it is what runs); a build too large
      // to carry is dropped rather than clipped, since half a build is wrong.
      plans: (Array.isArray(raw.plans) ? raw.plans.slice(-MAX_PLANS) : []).flatMap((p: any) => {
        const id = text(p?.id, MAX_ID);
        const title = text(p?.title);
        const build = p?.build;
        const sized = build && JSON.stringify(build).length <= MAX_PLAN_CHARS;
        return id && title && sized && (build.create || build.edit) ? [{ id, title, build }] : [];
      }),
      drafts: list(raw.drafts).flatMap((d: any) => {
        const title = text(d?.title);
        const method = text(d?.method, MAX_METHOD);
        const path = text(d?.path, MAX_PATH);
        return title && method && path
          ? [
              {
                title,
                method,
                path,
                ...(d.body !== undefined ? { body: bounded(d.body, MAX_BODY_CHARS) } : {}),
              },
            ]
          : [];
      }),
      ran: list(raw.ran).flatMap((r: any) => {
        const title = text(r?.title);
        const method = text(r?.method, MAX_METHOD);
        const path = text(r?.path, MAX_PATH);
        const status =
          r?.status === 'done' || r?.status === 'failed' || r?.status === 'running'
            ? r.status
            : undefined;
        return title && method && path && status
          ? [
              {
                title,
                method,
                path,
                status,
                ...(r.result !== undefined ? { result: bounded(r.result, MAX_RESULT_CHARS) } : {}),
                ...(text(r.error, MAX_ERROR) ? { error: text(r.error, MAX_ERROR) } : {}),
                ...(text(r.jobId, MAX_ID) ? { jobId: text(r.jobId, MAX_ID) } : {}),
              },
            ]
          : [];
      }),
    };
  }
  return out;
}

/** The working state and any answers, as the context block the model reads. */
export function describeRunInput(input: RunInput): string {
  const lines: string[] = [];
  const plans = input.state?.plans ?? [];
  if (plans.length) {
    lines.push(
      'Plans you drew earlier (latest last). When the person says go / run it / do it, carry out the latest with prepare_plan; to change one, draw it again with the change:',
      ...plans.map((p) => `- ${p.id}: "${p.title}" build: ${JSON.stringify(p.build)}`)
    );
  }
  const drafts = input.state?.drafts ?? [];
  const ran = input.state?.ran ?? [];
  if (drafts.length) {
    lines.push(
      'Working draft - actions you prepared that the person has NOT run, so nothing exists from them yet. A change they ask for revises these: prepare the action again with the change and preview it. Do not look for these assets.',
      ...drafts.map(
        (d) =>
          `- "${d.title}" ${d.method} ${d.path}${d.body !== undefined ? ` body: ${JSON.stringify(d.body)}` : ''}`
      )
    );
  }
  if (ran.length) {
    lines.push(
      'What the person ran (treat as done; use the ids in the results):',
      ...ran.map(
        (r) =>
          `- "${r.title}" ${r.method} ${r.path}: ${r.status}${r.jobId ? ` (job ${r.jobId})` : ''}${r.error ? `: ${r.error}` : ''}${r.result !== undefined ? ` result: ${JSON.stringify(r.result)}` : ''}`
      )
    );
  }
  for (const entry of input.resume ?? []) {
    lines.push(
      entry.status === 'cancelled'
        ? `The person dismissed your question ${entry.interruptId} without answering; do not ask it again unless you must.`
        : `The person answered your question ${entry.interruptId}: ${JSON.stringify(entry.payload ?? {})}. Carry on from there.`
    );
  }
  return lines.join('\n');
}
