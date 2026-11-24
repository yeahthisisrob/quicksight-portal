import type { APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = { enabled: true, turnedOn: true, smusConfigured: true };
const store = {
  getReport: vi.fn(),
  getRecord: vi.fn(),
  putRecord: vi.fn(),
};
const createJob = vi.fn();
const getActiveJobs = vi.fn();

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../shared/auth', () => ({
  requireAuth: vi.fn(async () => ({ userId: 'u1', email: 'avery@example.com' })),
  actorLabel: () => 'avery@example.com',
}));
vi.mock('../../../../shared/config/metadataSyncConfig', () => ({
  getMetadataSyncConfig: () => config,
}));
vi.mock('../../../../shared/services/jobs/JobFactory', () => ({
  jobFactory: { createJob: (...args: unknown[]) => createJob(...args) },
}));
vi.mock('../../../../shared/services/jobs/JobStateService', () => ({
  JobStateService: class {
    public getActiveJobs = getActiveJobs;
  },
}));
vi.mock('../../services/MetadataSyncStore', () => ({
  MetadataSyncStore: class {
    public getReport = store.getReport;
    public getRecord = store.getRecord;
    public putRecord = store.putRecord;
  },
}));

import {
  getMetadataSyncStatus,
  resolveMetadataConflict,
  startMetadataSync,
} from '../MetadataSyncHandler';

const event = (body?: unknown) =>
  ({ body: body === undefined ? null : JSON.stringify(body), headers: {} }) as APIGatewayProxyEvent;
const data = (result: { body: string }) => JSON.parse(result.body);

describe('MetadataSyncHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(config, { enabled: true, turnedOn: true, smusConfigured: true });
    getActiveJobs.mockResolvedValue([]);
    createJob.mockResolvedValue({ jobId: 'metadata-sync-1', status: 'queued' });
    store.getReport.mockResolvedValue(null);
    store.getRecord.mockResolvedValue(null);
  });

  it('reads no report while the feature is turned off', async () => {
    Object.assign(config, { enabled: false, turnedOn: false });
    const result = await getMetadataSyncStatus(event());
    expect(data(result).data).toEqual({
      enabled: false,
      turnedOn: false,
      smusConfigured: true,
      lastPreview: null,
      lastRun: null,
    });
    expect(store.getReport).not.toHaveBeenCalled();
  });

  it('refuses a pass while turned off, and says SMUS is what is missing when that is why', async () => {
    Object.assign(config, { enabled: false, turnedOn: false });
    const off = await startMetadataSync(event({ mode: 'run' }));
    expect(off.statusCode).toBe(400);
    expect(off.body).toContain('turned off');

    Object.assign(config, { enabled: false, turnedOn: true, smusConfigured: false });
    const noSmus = await startMetadataSync(event({ mode: 'run' }));
    expect(noSmus.statusCode).toBe(400);
    expect(noSmus.body).toContain('SMUS');
    expect(createJob).not.toHaveBeenCalled();
  });

  it('queues a preview unless a run is asked for by name', async () => {
    await startMetadataSync(event());
    await startMetadataSync(event({ mode: 'anything' }));
    const run = await startMetadataSync(event({ mode: 'run' }));
    expect(createJob.mock.calls.map(([job]) => job.options.mode)).toEqual([
      'preview',
      'preview',
      'run',
    ]);
    expect(run.statusCode).toBe(202);
  });

  it('returns the pass already going instead of starting another', async () => {
    getActiveJobs.mockResolvedValue([{ jobId: 'metadata-sync-0', status: 'processing' }]);
    const result = await startMetadataSync(event({ mode: 'run' }));
    expect(result.statusCode).toBe(200);
    expect(data(result).data.jobId).toBe('metadata-sync-0');
    expect(createJob).not.toHaveBeenCalled();
  });

  it('settles a conflict into the table record, with what each place showed as its baseline', async () => {
    const result = await resolveMetadataConflict(
      event({
        database: 'sales',
        table: 'orders',
        key: 'placed_at',
        field: 'description',
        value: ' When it was placed, in UTC. ',
        sides: { glue: 'When it was placed, in UTC.', 'smus:a': 'When the customer placed it.' },
      })
    );
    expect(result.statusCode).toBe(200);
    const [record] = store.putRecord.mock.calls[0] ?? [];
    expect(record.text.placed_at.description).toMatchObject({
      value: 'When it was placed, in UTC.',
      from: 'resolved',
      by: 'avery@example.com',
    });
    expect(record.left['smus:a'].placed_at.description).toBe('When the customer placed it.');
  });

  it('refuses a pick that does not say what it is picking', async () => {
    const result = await resolveMetadataConflict(
      event({ database: 'sales', table: 'orders', key: 'placed_at', field: 'owner', value: 'x' })
    );
    expect(result.statusCode).toBe(400);
    expect(store.putRecord).not.toHaveBeenCalled();
  });
});
