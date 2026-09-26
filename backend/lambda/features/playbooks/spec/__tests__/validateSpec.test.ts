import { describe, expect, it } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { validateSpec } from '../validateSpec';

const example = () => {
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    createdBy: _b,
    category: _k,
    ...input
  } = structuredClone(EXAMPLE_SPECS[0]!);
  return input;
};

describe('validateSpec', () => {
  it('accepts the shipped example', () => {
    const spec = validateSpec(example());
    expect(spec.steps.map((s) => s.kind)).toEqual(['matchDataset', 'rebind', 'tag', 'tag']);
    expect(spec.select.where).toHaveLength(2);
  });

  it('refuses a placeholder that names no input', () => {
    const spec = example();
    spec.select.where[0] = { kind: 'views', min: '{{minViewz}}' };
    expect(() => validateSpec(spec)).toThrow('{{minViewz}}');
  });

  it('refuses unknown conditions and steps', () => {
    expect(() =>
      validateSpec({
        ...example(),
        select: { assetTypes: ['dashboard'], where: [{ kind: 'vibes' }] },
      })
    ).toThrow('select.where[0].kind');
    expect(() => validateSpec({ ...example(), steps: [{ kind: 'drop-table' }] })).toThrow(
      'steps[0].kind'
    );
  });

  it('refuses a rebind or a replaced-* tag with no match step before it', () => {
    expect(() => validateSpec({ ...example(), steps: [{ kind: 'rebind' }] })).toThrow(
      'needs a matchDataset step'
    );
    expect(() =>
      validateSpec({
        ...example(),
        steps: [{ kind: 'tag', target: 'replaced-datasources', key: 'k', value: 'v' }],
      })
    ).toThrow('needs a matchDataset step');
  });

  it('allows tagging the asset itself with no match', () => {
    const spec = validateSpec({
      ...example(),
      steps: [{ kind: 'tag', target: 'asset', key: 'review', value: 'q4' }],
    });
    expect(spec.steps).toHaveLength(1);
  });

  it('needs a name, a known asset type and at least one step', () => {
    expect(() => validateSpec({ ...example(), name: '' })).toThrow('name');
    expect(() =>
      validateSpec({ ...example(), select: { assetTypes: ['folder'], where: [] } })
    ).toThrow('assetTypes');
    expect(() => validateSpec({ ...example(), steps: [] })).toThrow('steps');
  });

  it('puts everything shared with a team into its folder: several types, a folder input', () => {
    const spec = validateSpec({
      name: 'Into the team folder',
      inputs: [
        { key: 'team', label: 'Team group', kind: 'text', required: true },
        { key: 'folder', label: 'Their shared folder', kind: 'folder', required: true },
      ],
      select: {
        assetTypes: ['dashboard', 'analysis', 'dataset', 'datasource'],
        where: [{ kind: 'sharedWith', principal: '{{team}}' }],
      },
      steps: [{ kind: 'addToFolder', folder: '{{folder}}' }],
    });
    expect(spec.select.assetTypes).toHaveLength(4);
  });
});
