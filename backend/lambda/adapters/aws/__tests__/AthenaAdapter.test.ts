import { describe, expect, it, vi } from 'vitest';

import { AthenaAdapter, schemaQuery } from '../AthenaAdapter';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const input = {
  sql: 'select id, total from gold.orders;',
  workGroup: 'primary',
  outputLocation: 's3://bucket/athena-results/',
  timeoutMs: 5_000,
};

describe('AthenaAdapter', () => {
  it('wraps the query so no row is read, and strips a trailing semicolon', () => {
    expect(schemaQuery('select 1;\n')).toBe(
      'SELECT * FROM (\nselect 1\n) AS portal_schema LIMIT 0'
    );
  });

  it('starts the query in the workgroup, waits for it, and maps the result columns', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ QueryExecutionId: 'q1' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: 'RUNNING' } } })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: 'SUCCEEDED' } } })
      .mockResolvedValueOnce({
        ResultSet: {
          ResultSetMetadata: {
            ColumnInfo: [
              { Name: 'id', Type: 'bigint' },
              { Name: 'total', Type: 'decimal' },
            ],
          },
        },
      });
    const columns = await new AthenaAdapter('us-east-1', { send } as any).querySchema({
      ...input,
      catalog: 'AwsDataCatalog',
    });
    expect(columns).toEqual([
      { name: 'id', type: 'bigint' },
      { name: 'total', type: 'decimal' },
    ]);
    const start = send.mock.calls[0]![0].input;
    expect(start.WorkGroup).toBe('primary');
    expect(start.QueryString).toContain('LIMIT 0');
    expect(start.QueryExecutionContext).toEqual({ Catalog: 'AwsDataCatalog' });
    expect(start.ResultConfiguration).toEqual({ OutputLocation: 's3://bucket/athena-results/' });
  });

  it("reports the engine's reason when the query fails", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ QueryExecutionId: 'q1' })
      .mockResolvedValueOnce({
        QueryExecution: {
          Status: {
            State: 'FAILED',
            StateChangeReason: 'COLUMN_NOT_FOUND: Column total cannot be resolved',
          },
        },
      });
    await expect(
      new AthenaAdapter('us-east-1', { send } as any).querySchema(input)
    ).rejects.toThrow('COLUMN_NOT_FOUND: Column total cannot be resolved');
  });

  it('stops a query that outlives the timeout', async () => {
    const send = vi.fn(async (command: any) =>
      command.constructor.name === 'StartQueryExecutionCommand'
        ? { QueryExecutionId: 'q1' }
        : command.constructor.name === 'StopQueryExecutionCommand'
          ? {}
          : { QueryExecution: { Status: { State: 'QUEUED' } } }
    );
    await expect(
      new AthenaAdapter('us-east-1', { send } as any).querySchema({ ...input, timeoutMs: 1 })
    ).rejects.toThrow('did not finish');
    expect(send.mock.calls.some((c) => c[0].constructor.name === 'StopQueryExecutionCommand')).toBe(
      true
    );
  });
});
