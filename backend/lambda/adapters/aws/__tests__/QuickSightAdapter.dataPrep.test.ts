/**
 * A dataset belongs to one data prep experience or the other, and QuickSight
 * refuses an update that would write a new-experience dataset back as legacy.
 * Every edit the portal makes is a describe-then-update round trip, so what it
 * sends back decides whether those datasets are editable at all.
 */
import { QuickSightClient, UpdateDataSetCommand } from '@aws-sdk/client-quicksight';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuickSightAdapter } from '../QuickSightAdapter';

vi.mock('../../../shared/utils/rateLimiter', () => ({
  quickSightRateLimiter: { waitForToken: vi.fn().mockResolvedValue(undefined) },
  quickSightPermissionsRateLimiter: { waitForToken: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../shared/utils/awsRetry', () => ({
  withRetry: vi.fn().mockImplementation(async (fn: () => unknown) => fn()),
}));
vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const quickSightMock = mockClient(QuickSightClient);
const ACCOUNT = '123456789012';

const DATA_PREP = {
  SourceTableMap: { 's-1': { PhysicalTableId: 'p-1' } },
  TransformStepMap: { 't-1': { CreateColumnsStep: { Columns: [] } } },
  DestinationTableMap: { 'd-1': { Alias: 'final' } },
};

const base = {
  dataSetId: 'ds-1',
  name: 'Orders',
  physicalTableMap: { 'p-1': { RelationalTable: {} } },
  logicalTableMap: { 'l-1': { Alias: 'legacy' } },
  importMode: 'SPICE' as const,
};

describe('updateDataSet across the two data prep experiences', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    quickSightMock.resolves({ Arn: 'arn:ds', DataSetId: 'ds-1' });
    adapter = new QuickSightAdapter(new QuickSightClient({}) as any, ACCOUNT);
  });

  const sentInput = () => quickSightMock.commandCalls(UpdateDataSetCommand)[0]?.args[0]?.input;

  it('sends the logical table map for a legacy dataset, and no new configuration', async () => {
    await adapter.updateDataSet(base);
    const input = sentInput();
    expect(input?.LogicalTableMap).toEqual(base.logicalTableMap);
    expect(input?.DataPrepConfiguration).toBeUndefined();
    expect(input?.SemanticModelConfiguration).toBeUndefined();
  });

  it('sends the new configuration and drops the legacy map, which is what QuickSight refuses', async () => {
    await adapter.updateDataSet({
      ...base,
      dataPrepConfiguration: DATA_PREP,
      semanticModelConfiguration: { TableMap: { 'sm-1': { Alias: 'final' } } },
    });
    const input = sentInput();
    expect(input?.DataPrepConfiguration).toEqual(DATA_PREP);
    expect(input?.SemanticModelConfiguration).toEqual({ TableMap: { 'sm-1': { Alias: 'final' } } });
    expect(input?.LogicalTableMap).toBeUndefined();
    // The physical tables are shared by both experiences and still go back.
    expect(input?.PhysicalTableMap).toEqual(base.physicalTableMap);
    expect(input?.Name).toBe('Orders');
  });
});
