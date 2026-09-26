/**
 * A saved spec as a Playbook: its inputs are the parameters, its select is
 * the scope, and its steps plan and apply one asset at a time. The engine
 * cannot tell it from a built-in, so previews, gates, the failure threshold,
 * pausing and retry all work the same way.
 */
import type { ItemPlan, Playbook, PlaybookContext, PlaybookParam } from '../types';
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
      (s) => s.kind === 'matchDataset' && s.infer !== undefined && s.infer !== false
    ),
    params: spec.inputs.map(paramOf),
    writes,
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
      for (const step of steps) {
        if (step.verdict !== 'change') continue;
        const summary = await applyStep(ctx, target, step);
        if (summary) done.push(summary);
      }
      return { summary: done.join('; ') || 'Done' };
    },
  };
}
