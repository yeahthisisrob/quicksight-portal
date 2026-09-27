import { describe, expect, it, vi } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { type PlaybookContext, PortalCallError } from '../../types';
import { specPlaybook } from '../specPlaybook';
import { validateSpec } from '../validateSpec';

const standard = specPlaybook(EXAMPLE_SPECS.find((s) => s.id === 'apply-standard-theme')!);
const move = specPlaybook(EXAMPLE_SPECS.find((s) => s.id === 'move-to-new-theme')!);
const ARN = (id: string) => `arn:aws:quicksight:us-east-1:123456789012:theme/${id}`;

const DASHBOARDS = [
  { id: 'd-brand', name: 'Wears the brand', themeArn: ARN('Brand') },
  { id: 'd-old', name: 'Wears the old one', themeArn: ARN('old-look') },
  { id: 'd-none', name: 'Wears the default' },
  { id: 'd-built-in', name: 'Wears Midnight', themeArn: 'arn:aws:quicksight::aws:theme/MIDNIGHT' },
];
const ANALYSES = [{ id: 'a-old', name: 'Draft on the old one', themeArn: ARN('old-look') }];

function portal() {
  const applied: Array<{ path: string; body: unknown }> = [];
  const call = vi.fn(async (method: string, path: string, body?: unknown) => {
    const p = new URL(path, 'http://x').pathname;
    if (p === '/api/assets/dashboards/paginated') {
      return { dashboards: DASHBOARDS, pagination: { totalPages: 1 } };
    }
    if (p === '/api/assets/analyses/paginated') {
      return { analyses: ANALYSES, pagination: { totalPages: 1 } };
    }
    if (method === 'POST' && p.endsWith('/rebind')) {
      applied.push({ path: p, body });
      return { versionNumber: 4 };
    }
    throw new PortalCallError(404, `${method} ${p}`);
  });
  return { call, applied };
}

const ctx = (call: unknown, params: Record<string, unknown>) =>
  ({ call, params }) as unknown as PlaybookContext;

describe('theme playbooks', () => {
  it('gives the standard theme to everything not wearing it, whatever the case of its id', async () => {
    const { call } = portal();
    const targets = await standard.scope(ctx(call, { theme: 'brand' }));
    expect(targets.map((t) => t.assetId).sort()).toEqual([
      'a-old',
      'd-built-in',
      'd-none',
      'd-old',
    ]);
  });

  it('moves only what wears the old theme, dashboards and analyses alike', async () => {
    const { call } = portal();
    const targets = await move.scope(ctx(call, { from: 'old-look', to: 'brand' }));
    expect(targets.map((t) => t.assetId).sort()).toEqual(['a-old', 'd-old']);
  });

  it('matches a built-in theme by name', async () => {
    const { call } = portal();
    const targets = await move.scope(ctx(call, { from: 'MIDNIGHT', to: 'brand' }));
    expect(targets.map((t) => t.assetId)).toEqual(['d-built-in']);
  });

  it('applies the theme through the rebind endpoint, touching nothing else', async () => {
    const { call, applied } = portal();
    const target = {
      assetType: 'analysis' as const,
      assetId: 'a-old',
      name: 'Draft on the old one',
    };
    const plan = await move.plan(ctx(call, { from: 'old-look', to: 'brand' }), target);
    expect(plan.verdict).toBe('change');
    expect(plan.summary).toContain('brand');
    await move.apply(ctx(call, { from: 'old-look', to: 'brand' }), target, plan);
    expect(applied).toEqual([
      {
        path: '/api/authoring/analysis/a-old/rebind',
        body: { mode: 'update', rebinds: [], theme: 'brand' },
      },
    ]);
  });

  it('writes to dashboards and analyses and deletes nothing', () => {
    expect(standard.deletes).toBeFalsy();
    expect(standard.writes).toEqual(expect.arrayContaining(['dashboard', 'analysis']));
  });

  it('refuses a theme condition on anything but dashboards and analyses', () => {
    expect(() =>
      validateSpec({
        name: 'x',
        inputs: [],
        select: { assetTypes: ['dataset'], where: [{ kind: 'usesTheme', theme: 'brand' }] },
        steps: [{ kind: 'tag', target: 'asset', key: 'k', value: 'v' }],
      })
    ).toThrow();
    for (const id of ['apply-standard-theme', 'move-to-new-theme']) {
      const example = EXAMPLE_SPECS.find((s) => s.id === id)!;
      expect(() => validateSpec(example as unknown as Record<string, unknown>)).not.toThrow();
    }
  });
});
