/**
 * Repair everything: every dashboard and analysis QuickSight reports
 * definition errors on, fixed the way the Editor would fix it. What the
 * repair plan can fix on its own is applied; anything that needs a choice
 * (a dataset that is gone, a column with no clear match) is left for review
 * in the Editor.
 */

import { authoringPath } from '../portalPaths';
import type { Playbook } from '../types';
import { liveEntries } from './cache';

interface RepairPlanResponse {
  issues: Array<{ message: string; fix?: unknown }>;
  summary: { fixable: number; needsChoice: number; unfixable: number };
  proposed: { repairs: unknown[]; rebinds: unknown[] };
}

export const repairErrors: Playbook = {
  id: 'repair-errors',
  title: 'Repair everything',
  description:
    'Every dashboard and analysis with definition errors, fixed the way the Editor would: missing columns renamed or dropped, missing parameters declared. Anything that needs a choice is left for you in the Editor.',
  category: 'repair',
  params: [],
  writes: ['dashboard', 'analysis'],
  gateDefaults: { editedWithinDays: 7 },
  gates: [
    {
      key: 'errorTypes',
      label: 'Only these QuickSight error types',
      kind: 'text',
      help: 'Comma-separated, e.g. COLUMN_NOT_FOUND, PARAMETER_NOT_FOUND',
      exclude(target, value) {
        const wanted = String(value)
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean);
        const types = (target.entry?.metadata?.definitionErrors ?? []).map((e) => e.type);
        return wanted.length && !types.some((t) => wanted.includes(t))
          ? `Its errors are ${[...new Set(types)].join(', ') || 'none'}`
          : null;
      },
    },
  ],

  async scope() {
    const [dashboards, analyses] = await Promise.all([
      liveEntries('dashboard'),
      liveEntries('analysis'),
    ]);
    return [...dashboards, ...analyses]
      .filter((entry) => (entry.metadata?.definitionErrors?.length ?? 0) > 0)
      .map((entry) => ({
        assetType: entry.assetType,
        assetId: entry.assetId,
        name: entry.assetName,
        entry,
      }));
  },

  async plan(ctx, target) {
    const plan = await ctx.call<RepairPlanResponse>(
      'POST',
      `${authoringPath(target)}/repair/plan`,
      {}
    );
    const { fixable, needsChoice, unfixable } = plan.summary;
    const changes = plan.issues.filter((i) => i.fix).map((i) => i.message);
    if (plan.issues.length === 0) {
      return { verdict: 'skip', summary: 'No errors any more' };
    }
    if (needsChoice > 0 || unfixable > 0) {
      return {
        verdict: 'review',
        summary: `${needsChoice + unfixable} issue(s) need a choice in the Editor${fixable ? `; ${fixable} could be fixed` : ''}`,
        changes,
      };
    }
    return {
      verdict: 'change',
      summary: `${fixable} issue(s) to fix`,
      changes,
      data: plan.proposed,
    };
  },

  async apply(ctx, target, plan) {
    const proposed = plan.data as RepairPlanResponse['proposed'];
    const result = await ctx.call<{ versionNumber?: number; warnings?: string[] }>(
      'POST',
      `${authoringPath(target)}/rebind`,
      { mode: 'update', rebinds: proposed.rebinds, repairs: proposed.repairs }
    );
    return {
      summary: `Repaired${result.versionNumber ? ` (version ${result.versionNumber})` : ''}`,
      ...(result.warnings?.length ? { warnings: result.warnings } : {}),
    };
  },
};
