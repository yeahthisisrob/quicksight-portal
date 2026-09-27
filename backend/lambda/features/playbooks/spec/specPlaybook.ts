/**
 * A saved spec as a Playbook: its inputs are the parameters, its select is
 * the scope, and its steps plan and apply one asset at a time. The engine
 * cannot tell it from a built-in, so previews, gates, the failure threshold,
 * pausing and retry all work the same way.
 */

import { errorMessage } from '../../../shared/utils/errorMessage';
import {
  type ItemPlan,
  type Playbook,
  type PlaybookContext,
  type PlaybookParam,
  PortalCallError,
} from '../types';
import { selectTargets } from './select';
import { SpecSession } from './session';
import { applyStep, planStep, type SpecState, type StepPlan } from './steps';
import type { PlaybookSpec, SpecInput } from './types';

/** Custom playbooks' ids start with this, so they never collide with a built-in's. */
export const CUSTOM_PREFIX = 'custom-';

const WRITES: Record<string, Playbook['writes']> = {
  rebind: ['dashboard', 'analysis'],
  tag: ['dashboard', 'analysis', 'dataset', 'datasource'],
  repair: ['dashboard', 'analysis'],
  addToFolder: ['folder'],
  replaceMaterialisedCalcs: ['dashboard', 'analysis'],
  dropUnusedCalcs: ['dashboard', 'analysis'],
  renameCalcsToStandard: ['dashboard', 'analysis'],
  renameDatasetCalcsToStandard: ['dataset', 'dashboard', 'analysis'],
  deleteUser: ['user'],
  applyTheme: ['dashboard', 'analysis'],
};

function paramOf(input: SpecInput): PlaybookParam {
  return {
    key: input.key,
    label: input.label,
    kind: input.kind,
    ...(input.help ? { help: input.help } : {}),
    ...(input.required ? { required: true } : {}),
    ...(input.default === undefined ? {} : { default: input.default as string | boolean }),
  };
}

const ATTEMPTS = 3;
const BACKOFF_MS = 1_000;
const TOO_MANY = 429;
const SERVER_ERROR = 500;

/** Throttling and server errors pass; a refusal (4xx) is the answer. */
function transient(error: unknown): boolean {
  if (error instanceof PortalCallError) {
    return error.status === TOO_MANY || error.status >= SERVER_ERROR;
  }
  return /throttl|rate exceeded|timed? ?out/i.test(errorMessage(error));
}

async function withRetries<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= ATTEMPTS || !transient(error)) throw error;
      await new Promise((resolve) => globalThis.setTimeout(resolve, BACKOFF_MS * attempt));
    }
  }
}

/** The worst verdict wins: one step that needs a person makes the asset need one. */
function combine(plans: StepPlan[]): ItemPlan['verdict'] {
  if (plans.some((p) => p.verdict === 'review')) return 'review';
  return plans.some((p) => p.verdict === 'change') ? 'change' : 'skip';
}

export function specPlaybook(spec: PlaybookSpec): Playbook {
  // One session per preview or run invocation: what is asked once is not asked again.
  const sessions = new WeakMap<PlaybookContext, SpecSession>();
  const sessionOf = (ctx: PlaybookContext) => {
    let session = sessions.get(ctx);
    if (!session) {
      session = new SpecSession(ctx);
      sessions.set(ctx, session);
    }
    return session;
  };
  const writes = [...new Set(spec.steps.flatMap((s) => WRITES[s.kind] ?? []))];

  return {
    id: spec.id,
    title: spec.name,
    description: spec.description ?? '',
    category: spec.category ?? 'custom',
    spec,
    // An infer value that is an input may be turned off when it runs; the choice is still offered.
    infers: spec.steps.some(
      (s) =>
        (s.kind === 'matchDataset' || s.kind === 'replaceMaterialisedCalcs') &&
        s.infer !== undefined &&
        s.infer !== false
    ),
    params: spec.inputs.map(paramOf),
    writes,
    ...(spec.steps.some((s) => s.kind === 'deleteUser') ? { deletes: true } : {}),
    gateDefaults: spec.gates ?? {},

    scope: (ctx) => selectTargets(ctx, sessionOf(ctx), spec.select.assetTypes, spec.select.where),

    async plan(ctx, target) {
      const session = sessionOf(ctx);
      const state: SpecState = { matches: [] };
      const plans: StepPlan[] = [];
      for (const step of spec.steps) {
        const plan = await planStep(ctx, session, target, step, state);
        plans.push(plan);
        // Nothing to replace means nothing after it has anything to do.
        if (step.kind === 'matchDataset' && plan.verdict === 'skip') break;
      }
      const verdict = combine(plans);
      const lead = plans.find((p) => p.verdict === verdict) ?? plans[0];
      return {
        verdict,
        summary: lead?.summary ?? 'Nothing to do',
        changes: plans.flatMap((p) => p.changes),
        data: { steps: plans },
      };
    },

    async apply(ctx, target, plan) {
      const { steps } = plan.data as { steps: StepPlan[] };
      const done: string[] = [];
      const todo = steps.filter((s) => s.verdict === 'change');
      for (const [i, step] of todo.entries()) {
        try {
          const summary = await withRetries(() => applyStep(ctx, target, step));
          if (summary) done.push(summary);
        } catch (error) {
          if (done.length === 0) throw error;
          // Part of it is written. A retry plans again against what is there
          // now and cannot see what was left, so say exactly what that is.
          const left = todo.slice(i).flatMap((s) => s.changes);
          throw new Error(
            `${done.join('; ')}; then this failed: ${errorMessage(error)}. Not done, do it by hand: ${left.join('; ')}`
          );
        }
      }
      return { summary: done.join('; ') || 'Done' };
    },
  };
}
