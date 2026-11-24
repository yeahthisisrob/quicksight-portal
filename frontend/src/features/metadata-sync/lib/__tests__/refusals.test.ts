import { describe, expect, it } from 'vitest';

import type { MetadataSyncReport } from '@/shared/api/modules/metadataSync';

import { groupRefusals } from '../refusals';

type Side = MetadataSyncReport['tables'][number]['sides'][number];

const failed = (kind: 'glue' | 'smus', error: string): Side => ({
  side: kind === 'glue' ? 'glue' : 'smus:a',
  kind,
  label: 'x',
  outcome: 'failed',
  writes: [],
  error,
});

const report = (tables: Array<[string, string, Side[]]>): MetadataSyncReport => ({
  version: 1,
  mode: 'preview',
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:00:00.000Z',
  snapshotAt: '2026-01-01T00:00:00.000Z',
  totals: { tables: tables.length, adoptions: 0, conflicts: 0, writes: 0, failed: 0 },
  tables: tables.map(([database, table, sides]) => ({
    database,
    table,
    adoptions: [],
    conflicts: [],
    sides,
  })),
});

const LF = 'Insufficient Lake Formation permission(s): Required Describe on orders';
const IAM =
  'User: arn:aws:sts::123456789012:assumed-role/Portal-LambdaExecutionRole/worker is not authorized to perform: datazone:GetAsset on resource: arn:aws:datazone:us-east-1:123456789012:domain/dzd_example because no identity-based policy allows the datazone:GetAsset action';

describe('groupRefusals', () => {
  it('turns one refusal per table into one group per missing grant, with its fix', () => {
    const groups = groupRefusals(
      report([
        ['sales', 'orders', [failed('glue', LF), failed('smus', IAM)]],
        ['sales', 'customers', [failed('glue', LF)]],
        ['finance', 'ledger', [failed('glue', LF)]],
      ])
    );
    expect(groups.map((g) => g.kind)).toEqual(['iam', 'lake-formation']);
    expect(groups[0]?.title).toContain('datazone:GetAsset');
    expect(groups[0]?.fix).toContain('cdk.context.json');
    expect(groups[1]?.tables).toEqual(['finance.ledger', 'sales.customers', 'sales.orders']);
    expect(groups[1]?.command).toBe('just metadata-sync-grant "finance,sales"');
  });

  it('reads a SMUS refusal that is not IAM as a missing project seat', () => {
    const [group] = groupRefusals(
      report([
        ['sales', 'orders', [failed('smus', 'AccessDeniedException: User is not permitted')]],
      ])
    );
    expect(group?.kind).toBe('smus-seat');
    expect(group?.command).toContain('PROJECT_CONTRIBUTOR');
  });

  it('keeps anything it does not recognise, with what AWS said', () => {
    const [group] = groupRefusals(
      report([['sales', 'orders', [failed('glue', 'ThrottlingException: Rate exceeded')]]])
    );
    expect(group).toMatchObject({ kind: 'other', example: 'ThrottlingException: Rate exceeded' });
    expect(group?.command).toBeUndefined();
  });

  it('is empty when nothing failed', () => {
    expect(groupRefusals(report([['sales', 'orders', []]]))).toEqual([]);
  });
});
