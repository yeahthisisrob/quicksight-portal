import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PortalCallError } from '../../types';
import { consolidateAthena } from '../consolidateAthena';
import { demoCleanup } from '../demoCleanup';
import { repairErrors } from '../repairErrors';

const entries = vi.hoisted(() => ({ byType: {} as Record<string, any[]> }));

vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: {
    getCacheEntries: vi.fn(
      async ({ assetType }: { assetType: string }) => entries.byType[assetType] ?? []
    ),
  },
}));

const ARN = (id: string) => `arn:aws:quicksight:us-east-1:1:datasource/${id}`;

function athena(id: string, workGroup = 'primary') {
  return {
    assetType: 'datasource',
    assetId: id,
    assetName: id,
    arn: ARN(id),
    metadata: { sourceType: 'ATHENA', workGroup },
  };
}

function dataset(id: string, sources: string[], extra: object = {}) {
  return {
    assetType: 'dataset',
    assetId: id,
    assetName: id,
    metadata: { lineageData: { datasourceIds: sources } },
    ...extra,
  };
}

describe('consolidate Athena data sources', () => {
  const call = vi.fn();
  const ctx = { call: call as any, params: { target: 'main' } };

  beforeEach(() => {
    call.mockReset();
    entries.byType = {
      datasource: [
        athena('main'),
        athena('old'),
        athena('elsewhere', 'analysts'),
        {
          assetType: 'datasource',
          assetId: 'pg',
          assetName: 'pg',
          arn: ARN('pg'),
          metadata: { sourceType: 'POSTGRESQL' },
        },
      ],
      dataset: [
        dataset('on-old', ['old']),
        dataset('on-main', ['main']),
        dataset('on-pg', ['pg']),
        dataset('on-elsewhere', ['elsewhere']),
      ],
    };
  });

  it('scopes datasets on another Athena data source, never other engines', async () => {
    const scope = await consolidateAthena.scope(ctx);
    expect(scope.map((t) => t.assetId).sort()).toEqual(['on-elsewhere', 'on-old']);
  });

  it('refuses a target that is not an Athena data source', async () => {
    await expect(consolidateAthena.scope({ ...ctx, params: { target: 'pg' } })).rejects.toThrow(
      'Athena'
    );
  });

  it('moves only the Athena tables not already on the target', async () => {
    call.mockResolvedValue({
      tables: [
        { id: 't1', kind: 'RELATIONAL', name: 'orders', dataSourceArn: ARN('old') },
        { id: 't2', kind: 'CUSTOM_SQL', name: 'q', dataSourceArn: ARN('main') },
        { id: 't3', kind: 'RELATIONAL', name: 'crm', dataSourceArn: ARN('pg') },
      ],
    });
    const plan = await consolidateAthena.plan(ctx, {
      assetType: 'dataset',
      assetId: 'on-old',
      name: 'x',
    });
    expect(plan.verdict).toBe('change');
    expect(plan.changes).toEqual(['orders: old → main']);
    expect(plan.data).toMatchObject({ tables: [{ id: 't1', dataSourceArn: ARN('main') }] });

    await consolidateAthena.apply(
      ctx,
      { assetType: 'dataset', assetId: 'on-old', name: 'x' },
      plan
    );
    expect(call).toHaveBeenLastCalledWith('PUT', '/api/assets/dataset/on-old/source', {
      tables: [{ id: 't1', dataSourceArn: ARN('main') }],
    });
  });

  it('sends a table in another workgroup to review instead of moving it', async () => {
    call.mockResolvedValue({
      tables: [{ id: 't1', kind: 'RELATIONAL', name: 'orders', dataSourceArn: ARN('elsewhere') }],
    });
    const plan = await consolidateAthena.plan(ctx, {
      assetType: 'dataset',
      assetId: 'on-elsewhere',
      name: 'x',
    });
    expect(plan.verdict).toBe('review');
    expect(plan.summary).toContain('analysts');
  });

  it('skips a dataset someone already moved', async () => {
    call.mockResolvedValue({
      tables: [{ id: 't1', kind: 'RELATIONAL', name: 'orders', dataSourceArn: ARN('main') }],
    });
    const plan = await consolidateAthena.plan(ctx, {
      assetType: 'dataset',
      assetId: 'on-old',
      name: 'x',
    });
    expect(plan.verdict).toBe('skip');
  });
});

describe('repair everything', () => {
  const call = vi.fn();
  const ctx = { call: call as any, params: {} };
  const t = { assetType: 'dashboard' as const, assetId: 'd1', name: 'Sales' };

  beforeEach(() => {
    call.mockReset();
    entries.byType = {
      dashboard: [
        {
          assetType: 'dashboard',
          assetId: 'd1',
          assetName: 'Sales',
          metadata: { definitionErrors: [{ type: 'COLUMN_NOT_FOUND' }] },
        },
        { assetType: 'dashboard', assetId: 'd2', assetName: 'Fine', metadata: {} },
      ],
      analysis: [],
    };
  });

  it('scopes only what QuickSight reports errors on', async () => {
    expect((await repairErrors.scope(ctx)).map((x) => x.assetId)).toEqual(['d1']);
  });

  it('changes what the plan can fix alone, and leaves choices for review', async () => {
    call.mockResolvedValueOnce({
      issues: [{ message: 'revenue → net_revenue', fix: {} }],
      summary: { fixable: 1, needsChoice: 0, unfixable: 0 },
      proposed: { repairs: [{ op: 'x' }], rebinds: [] },
    });
    const plan = await repairErrors.plan(ctx, t);
    expect(plan.verdict).toBe('change');

    call.mockResolvedValueOnce({ versionNumber: 4 });
    await repairErrors.apply(ctx, t, plan);
    expect(call).toHaveBeenLastCalledWith('POST', '/api/authoring/dashboard/d1/rebind', {
      mode: 'update',
      rebinds: [],
      repairs: [{ op: 'x' }],
    });

    call.mockResolvedValueOnce({
      issues: [{ message: 'dataset gone' }],
      summary: { fixable: 0, needsChoice: 1, unfixable: 0 },
      proposed: { repairs: [], rebinds: [] },
    });
    expect((await repairErrors.plan(ctx, t)).verdict).toBe('review');
  });

  it('can be narrowed to error types', () => {
    const gate = repairErrors.gates?.find((g) => g.key === 'errorTypes');
    const entry = { metadata: { definitionErrors: [{ type: 'COLUMN_NOT_FOUND' }] } } as any;
    expect(gate?.exclude({ ...t, entry }, 'PARAMETER_NOT_FOUND', 0)).toContain('COLUMN_NOT_FOUND');
    expect(gate?.exclude({ ...t, entry }, 'column_not_found', 0)).toBeNull();
  });
});

describe('remove the sample assets', () => {
  const call = vi.fn();
  const ctx = { call: call as any, params: {} };

  beforeEach(() => {
    call.mockReset();
    entries.byType = {
      datasource: [
        {
          assetType: 'datasource',
          assetId: 'sample',
          assetName: 'Sample',
          metadata: { sourceType: 'S3', bucket: 'spaceneedle-samplefiles' },
        },
        {
          assetType: 'datasource',
          assetId: 'real',
          assetName: 'Real',
          metadata: { sourceType: 'S3', bucket: 'ours' },
        },
      ],
      dataset: [
        dataset('people', ['sample']),
        dataset('ours', ['real']),
        dataset('mixed', ['sample', 'real']),
      ],
      analysis: [
        {
          assetType: 'analysis',
          assetId: 'people-analysis',
          assetName: 'People Overview analysis',
          metadata: { sheetCount: 1, sheets: [{ name: 'Sheet 1', visualCount: 6 }] },
        },
      ],
      dashboard: [
        {
          assetType: 'dashboard',
          assetId: 'exec',
          assetName: 'Exec',
          metadata: { lineageData: { datasetIds: ['mixed'] } },
        },
      ],
    };
  });

  it('finds the samples by bucket, in analysis → dataset → data source order', async () => {
    const scope = await demoCleanup.scope(ctx);
    expect(scope.map((t) => `${demoCleanup.stage!(t)}:${t.assetId}`).sort()).toEqual([
      '0:people-analysis',
      '1:mixed',
      '1:people',
      '2:sample',
    ]);
  });

  it('will not delete what something outside the samples still reads', async () => {
    const mixed = await demoCleanup.plan(ctx, {
      assetType: 'dataset',
      assetId: 'mixed',
      name: 'mixed',
    });
    expect(mixed.verdict).toBe('review');
    expect(mixed.summary).toContain('Exec');

    const people = await demoCleanup.plan(ctx, {
      assetType: 'dataset',
      assetId: 'people',
      name: 'people',
    });
    expect(people.verdict).toBe('change');
  });

  it('deletes through the archiving route, with a reason', async () => {
    call.mockResolvedValue({ archived: true });
    await demoCleanup.apply(
      ctx,
      { assetType: 'dataset', assetId: 'people', name: 'people' },
      {
        verdict: 'change',
        summary: '',
      }
    );
    expect(call).toHaveBeenCalledWith('DELETE', '/api/assets/dataset/people?reason=Demo%20cleanup');
  });

  it('never matches a data source outside the sample bucket', async () => {
    call.mockRejectedValue(new PortalCallError(404, 'gone'));
    const scope = await demoCleanup.scope(ctx);
    expect(scope.some((t) => t.assetId === 'real' || t.assetId === 'ours')).toBe(false);
  });
});
