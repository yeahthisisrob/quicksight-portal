import { vi } from 'vitest';

import { JobRepository, type JobMetadata, type JobLog } from '../JobRepository';

const HOUR_MS = 3600000;
const MEDIUM_BATCH = 10;
const TEST_YEAR = 2025;
const BIG_RESULT_BYTES = 400000; // past the 350KB truncation threshold
const LOCK_KEY = { pk: '__export-lock__', sk: 'META' };

// Shared DynamoDB mock (hoisted so the module factory can reference it)
const mocks = vi.hoisted(() => ({
  dynamo: {
    getItem: vi.fn(),
    putItem: vi.fn(),
    deleteItem: vi.fn(),
    updateItem: vi.fn(),
    queryIndex: vi.fn(),
    queryPartition: vi.fn(),
    batchDelete: vi.fn(),
    ensureJobsTableExists: vi.fn(),
  },
}));

vi.mock('../../aws/DynamoDBService', () => ({
  DynamoDBService: vi.fn(() => mocks.dynamo),
  isConditionalCheckFailed: (error: any) => error?.name === 'ConditionalCheckFailedException',
}));
vi.mock('../../../utils/logger');

const conditionalFailure = () => {
  const error = new Error('conditional check failed');
  (error as any).name = 'ConditionalCheckFailedException';
  return error;
};

const createMockJob = (overrides: Partial<JobMetadata> = {}): JobMetadata => ({
  jobId: 'export-123',
  jobType: 'export',
  status: 'completed',
  // Fresh heartbeat: keeps active-status fixtures from being auto-failed by
  // the dead-job sweep that runs inside listJobs()/getJob().
  lastUpdatedTime: new Date().toISOString(),
  progress: 100,
  message: 'Export completed successfully',
  startTime: '2025-01-01T00:00:00.000Z',
  endTime: '2025-01-01T00:05:00.000Z',
  duration: 300000,
  ...overrides,
});

/** Point the mocks at a fixed set of stored jobs */
function setStoredJobs(jobs: JobMetadata[]): void {
  mocks.dynamo.getItem.mockImplementation(
    async (_table: string, key: { pk: string; sk: string }) =>
      jobs.find((j) => j.jobId === key.pk) || null
  );
  mocks.dynamo.queryIndex.mockResolvedValue(jobs);
}

let repository: JobRepository;

/** Fresh repository + clean mocks for every test */
function setupRepository(): void {
  vi.clearAllMocks();
  (JobRepository as any).logCounters.clear();
  repository = new JobRepository();
  setStoredJobs([]);
  mocks.dynamo.queryPartition.mockResolvedValue([]);
}

const deadJob = (overrides: Partial<JobMetadata> = {}): JobMetadata =>
  createMockJob({
    jobId: 'dead-1',
    status: 'processing',
    startTime: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
    lastUpdatedTime: new Date(Date.now() - HOUR_MS).toISOString(),
    endTime: undefined,
    duration: undefined,
    ...overrides,
  });

describe('JobRepository - listJobs', () => {
  beforeEach(setupRepository);

  it('returns jobs newest first', async () => {
    setStoredJobs([
      createMockJob({ jobId: 'export-old', startTime: '2025-01-01T00:00:00.000Z' }),
      createMockJob({ jobId: 'export-new', startTime: '2025-01-02T00:00:00.000Z' }),
      createMockJob({ jobId: 'export-middle', startTime: '2025-01-01T12:00:00.000Z' }),
    ]);

    const result = await repository.listJobs({ jobType: 'export' });

    expect(result.map((j) => j.jobId)).toEqual(['export-new', 'export-middle', 'export-old']);
  });

  it('filters by job type and status', async () => {
    setStoredJobs([
      createMockJob({ jobId: 'export-123', jobType: 'export', status: 'completed' }),
      createMockJob({ jobId: 'deploy-456', jobType: 'deploy', status: 'completed' }),
      createMockJob({ jobId: 'export-789', jobType: 'export', status: 'stopped' }),
    ]);

    const result = await repository.listJobs({ jobType: 'export', status: 'completed' });

    expect(result).toHaveLength(1);
    expect(result[0]?.jobId).toBe('export-123');
  });

  it('applies the limit', async () => {
    setStoredJobs(
      Array.from({ length: 100 }, (_, i) =>
        createMockJob({
          jobId: `export-${i}`,
          startTime: new Date(TEST_YEAR, 0, 1, 0, i).toISOString(),
        })
      )
    );

    const result = await repository.listJobs({ limit: MEDIUM_BATCH });

    expect(result).toHaveLength(MEDIUM_BATCH);
  });

  it('strips storage-only attributes from returned jobs', async () => {
    setStoredJobs([
      {
        ...createMockJob(),
        pk: 'export-123',
        sk: 'META',
        gsi1pk: 'JOB',
        expiresAt: 1234567890,
      } as unknown as JobMetadata,
    ]);

    const result = await repository.listJobs();

    expect(result[0]).not.toHaveProperty('pk');
    expect(result[0]).not.toHaveProperty('sk');
    expect(result[0]).not.toHaveProperty('gsi1pk');
    expect(result[0]).not.toHaveProperty('expiresAt');
  });

  it('returns an empty array when the query fails', async () => {
    mocks.dynamo.queryIndex.mockRejectedValue(new Error('DynamoDB error'));

    const result = await repository.listJobs();

    expect(result).toEqual([]);
  });
});

describe('JobRepository - createJob and updateJob', () => {
  beforeEach(setupRepository);

  it('createJob writes one item with key, index, and TTL attributes plus a heartbeat', async () => {
    await repository.createJob(
      createMockJob({ jobId: 'export-789', status: 'queued', progress: 0 })
    );

    expect(mocks.dynamo.putItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        pk: 'export-789',
        sk: 'META',
        jobId: 'export-789',
        status: 'queued',
        gsi1pk: 'JOB',
        expiresAt: expect.any(Number),
        lastUpdatedTime: expect.any(String),
      })
    );
  });

  it('updateJob writes one atomic partial update and computes duration on terminal writes', async () => {
    setStoredJobs([
      createMockJob({
        jobId: 'export-123',
        status: 'processing',
        progress: 50,
        endTime: undefined,
        duration: undefined,
      }),
    ]);

    await repository.updateJob('export-123', {
      status: 'completed',
      progress: 100,
      endTime: '2025-01-01T00:01:00.000Z',
    });

    expect(mocks.dynamo.updateItem).toHaveBeenCalledWith(
      expect.any(String),
      { pk: 'export-123', sk: 'META' },
      expect.objectContaining({
        set: expect.objectContaining({
          status: 'completed',
          progress: 100,
          endTime: '2025-01-01T00:01:00.000Z',
          duration: 60000,
          lastUpdatedTime: expect.any(String),
        }),
      })
    );
    // Partial update - never a whole-item put that could clobber other fields
    expect(mocks.dynamo.putItem).not.toHaveBeenCalled();
  });

  it('heartbeat-style updates cost zero reads', async () => {
    await repository.updateJob('export-123', { progress: 50, message: 'Enriching datasets' });

    expect(mocks.dynamo.getItem).not.toHaveBeenCalled();
    expect(mocks.dynamo.updateItem).toHaveBeenCalledTimes(1);
  });

  it('releases the export lock when an export job reaches a terminal status', async () => {
    setStoredJobs([createMockJob({ jobId: 'export-123', status: 'processing' })]);

    await repository.updateJob('export-123', { status: 'completed' });

    expect(mocks.dynamo.deleteItem).toHaveBeenCalledWith(
      expect.any(String),
      LOCK_KEY,
      'ownerJobId = :owner',
      { ':owner': 'export-123' }
    );
  });

  it('does not touch the lock for non-terminal updates', async () => {
    setStoredJobs([createMockJob({ jobId: 'export-123', status: 'processing' })]);

    await repository.updateJob('export-123', { progress: 50 });

    expect(mocks.dynamo.deleteItem).not.toHaveBeenCalled();
  });

  it('upserts a minimal record when the job is missing', async () => {
    setStoredJobs([]);

    await repository.updateJob('ghost-1', { status: 'completed' });

    expect(mocks.dynamo.updateItem).toHaveBeenCalledWith(
      expect.any(String),
      { pk: 'ghost-1', sk: 'META' },
      expect.objectContaining({
        set: expect.objectContaining({ status: 'completed' }),
        setIfNotExists: expect.objectContaining({ jobId: 'ghost-1', gsi1pk: 'JOB' }),
      })
    );
  });

  it('drops a stale auto-fail error when a job completes successfully', async () => {
    setStoredJobs([
      createMockJob({
        jobId: 'export-123',
        status: 'processing',
        error: 'No heartbeat since ... (stale sweep stamp)',
      }),
    ]);

    await repository.updateJob('export-123', { status: 'completed' });

    expect(mocks.dynamo.updateItem).toHaveBeenCalledWith(
      expect.any(String),
      { pk: 'export-123', sk: 'META' },
      expect.objectContaining({ remove: ['error'] })
    );
  });
});

describe('JobRepository - export lock and logs', () => {
  beforeEach(setupRepository);

  it('acquires the lock via conditional write', async () => {
    const acquired = await repository.acquireExportLock('export-1');

    expect(acquired).toBe(true);
    expect(mocks.dynamo.putItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ ...LOCK_KEY, ownerJobId: 'export-1' }),
      expect.stringContaining('attribute_not_exists(pk)'),
      expect.objectContaining({ ':owner': 'export-1' })
    );
  });

  it('returns false when another export holds the lock', async () => {
    mocks.dynamo.putItem.mockRejectedValueOnce(conditionalFailure());

    const acquired = await repository.acquireExportLock('export-2');

    expect(acquired).toBe(false);
  });

  it('release swallows the conditional failure of not holding the lock', async () => {
    mocks.dynamo.deleteItem.mockRejectedValueOnce(conditionalFailure());

    await expect(repository.releaseExportLock('export-3')).resolves.toBeUndefined();
  });

  it('appendLog writes one item per entry - no reads', async () => {
    const log: JobLog = {
      timestamp: '2025-01-01T00:00:01.000Z',
      level: 'info',
      message: 'Listing dashboards',
    };

    await repository.appendLog('export-1', log);

    expect(mocks.dynamo.putItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        pk: 'export-1',
        sk: expect.stringMatching(/^LOG#2025-01-01T00:00:01\.000Z#\d{6}$/),
        message: 'Listing dashboards',
        level: 'info',
        expiresAt: expect.any(Number),
      })
    );
    expect(mocks.dynamo.getItem).not.toHaveBeenCalled();
  });

  it('getJobLogs queries the partition and strips storage attributes', async () => {
    mocks.dynamo.queryPartition.mockResolvedValue([
      {
        pk: 'export-1',
        sk: 'LOG#2025-01-01T00:00:01.000Z#000001',
        timestamp: '2025-01-01T00:00:01.000Z',
        level: 'info',
        message: 'first',
        expiresAt: 123,
      },
      {
        pk: 'export-1',
        sk: 'LOG#2025-01-01T00:00:02.000Z#000002',
        timestamp: '2025-01-01T00:00:02.000Z',
        level: 'warn',
        message: 'second',
        expiresAt: 123,
      },
    ]);

    const logs = await repository.getJobLogs('export-1');

    expect(logs).toEqual([
      { timestamp: '2025-01-01T00:00:01.000Z', level: 'info', message: 'first' },
      { timestamp: '2025-01-01T00:00:02.000Z', level: 'warn', message: 'second' },
    ]);
  });
});

describe('JobRepository - self-healing dead jobs', () => {
  beforeEach(setupRepository);

  it('listJobs auto-fails a job whose heartbeat stopped past the timeout', async () => {
    setStoredJobs([deadJob()]);

    const jobs = await repository.listJobs();

    expect(jobs[0]?.status).toBe('failed');
    expect(jobs[0]?.error).toContain('No heartbeat');
    // The repaired job is written back as its own item
    expect(mocks.dynamo.putItem).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ jobId: 'dead-1', status: 'failed' })
    );
  });

  it('getJob flips a dead job to failed so pollers stop waiting', async () => {
    setStoredJobs([deadJob({ jobId: 'dead-2' })]);

    const job = await repository.getJob('dead-2');

    expect(job?.status).toBe('failed');
  });

  it('releases the export lock held by a dead export job', async () => {
    setStoredJobs([deadJob({ jobId: 'dead-3' })]);

    await repository.listJobs();

    expect(mocks.dynamo.deleteItem).toHaveBeenCalledWith(
      expect.any(String),
      LOCK_KEY,
      'ownerJobId = :owner',
      { ':owner': 'dead-3' }
    );
  });

  it('does not touch active jobs with a recent heartbeat, even if started long ago', async () => {
    setStoredJobs([deadJob({ jobId: 'alive-1', lastUpdatedTime: new Date().toISOString() })]);

    const jobs = await repository.listJobs();

    expect(jobs[0]?.status).toBe('processing');
    expect(mocks.dynamo.putItem).not.toHaveBeenCalled();
  });

  it('falls back to startTime when a job has no heartbeat (queued but never picked up)', async () => {
    setStoredJobs([deadJob({ jobId: 'orphan-1', status: 'queued', lastUpdatedTime: undefined })]);

    const jobs = await repository.listJobs();

    expect(jobs[0]?.status).toBe('failed');
  });

  it('leaves terminal jobs alone regardless of age', async () => {
    setStoredJobs([deadJob({ jobId: 'done-1', status: 'completed' })]);

    const jobs = await repository.listJobs();

    expect(jobs[0]?.status).toBe('completed');
    expect(mocks.dynamo.putItem).not.toHaveBeenCalled();
  });
});

describe('JobRepository - results and deletion', () => {
  beforeEach(setupRepository);

  it('stores results on the job item', async () => {
    setStoredJobs([createMockJob({ jobId: 'csv-1', status: 'processing' })]);

    await repository.saveJobResult('csv-1', { count: 5 });

    expect(mocks.dynamo.updateItem).toHaveBeenCalledWith(
      expect.any(String),
      { pk: 'csv-1', sk: 'META' },
      { set: { result: { count: 5 }, lastUpdatedTime: expect.any(String) } },
      'attribute_exists(pk)'
    );
  });

  it('replaces an oversized result with a loud truncation marker (never S3, never a corrupt payload)', async () => {
    const bigResult = { rows: 'x'.repeat(BIG_RESULT_BYTES) };
    setStoredJobs([createMockJob({ jobId: 'bulk-1', status: 'processing' })]);

    await repository.saveJobResult('bulk-1', bigResult);

    const written = mocks.dynamo.updateItem.mock.calls.find(
      (call) => call[1]?.pk === 'bulk-1'
    )?.[2];
    expect(written.set.result).toEqual(
      expect.objectContaining({ truncated: true, message: expect.stringContaining('too large') })
    );
  });

  it('deleteJob removes the whole partition (meta + logs)', async () => {
    mocks.dynamo.queryPartition.mockResolvedValue([
      { pk: 'export-9', sk: 'META' },
      { pk: 'export-9', sk: 'LOG#2025-01-01T00:00:01.000Z#000001' },
    ]);

    await repository.deleteJob('export-9');

    expect(mocks.dynamo.batchDelete).toHaveBeenCalledWith(expect.any(String), [
      { pk: 'export-9', sk: 'META' },
      { pk: 'export-9', sk: 'LOG#2025-01-01T00:00:01.000Z#000001' },
    ]);
  });
});
