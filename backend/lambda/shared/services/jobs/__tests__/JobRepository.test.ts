import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { JOB_CONFIG, TIME_UNITS } from '../../../constants';
import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { portal } from '../../store/portalTable';
import { JobItemStore } from '../JobItemStore';
import { type JobMetadata, JobRepository } from '../JobRepository';

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

const repo = new JobRepository();
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const MIN = TIME_UNITS.MINUTE;

async function clear(): Promise<void> {
  const { data } = await portal().job.query.byStartTime({}).go({ pages: 'all' });
  for (const row of data) await repo.deleteJob(row.jobId);
  await portal().exportLock.delete({ lock: 'export' }).go();
}

function job(jobId: string, extra: Partial<JobMetadata> = {}): JobMetadata {
  return {
    jobId,
    jobType: 'export',
    status: 'completed',
    startTime: iso(MIN),
    lastUpdatedTime: iso(MIN),
    ...extra,
  };
}

beforeEach(clear);

describe('listing jobs', () => {
  it('lists newest first, filtered by type and status, up to the limit', async () => {
    await repo.createJob(job('old', { startTime: iso(3 * MIN) }));
    await repo.createJob(job('mid', { startTime: iso(2 * MIN), jobType: 'playbook' }));
    await repo.createJob(job('new', { startTime: iso(MIN), status: 'failed' }));
    expect((await repo.listJobs()).map((j) => j.jobId)).toEqual(['new', 'mid', 'old']);
    expect((await repo.listJobs({ jobType: 'playbook' })).map((j) => j.jobId)).toEqual(['mid']);
    expect((await repo.listJobs({ status: 'failed' })).map((j) => j.jobId)).toEqual(['new']);
    expect(await repo.listJobs({ limit: 2 })).toHaveLength(2);
    expect((await repo.listJobs()).some((j) => 'expiresAt' in j)).toBe(false);
  });
});

describe('updating a job', () => {
  it('writes only the fields given, so a heartbeat and a stop request both land', async () => {
    await repo.createJob(job('j1', { status: 'processing', progress: 10 }));
    await Promise.all([
      repo.updateJob('j1', { progress: 55, message: 'halfway' }),
      repo.updateJob('j1', { stopRequested: true }),
    ]);
    expect(await repo.getJob('j1')).toMatchObject({
      progress: 55,
      message: 'halfway',
      stopRequested: true,
      status: 'processing',
    });
  });

  it('computes the duration on a terminal write and drops a stale auto-fail error', async () => {
    const start = iso(10 * MIN);
    await repo.createJob(
      job('j1', { status: 'processing', startTime: start, error: 'no heartbeat' })
    );
    const endTime = new Date().toISOString();
    await repo.updateJob('j1', { status: 'completed', endTime });
    const done = await repo.getJob('j1');
    expect(done?.duration).toBe(Date.parse(endTime) - Date.parse(start));
    expect(done).not.toHaveProperty('error');
    expect(done?.startTime).toBe(start);
  });

  it('recreates a job that went missing rather than failing a finished run', async () => {
    await repo.updateJob('ghost', { status: 'completed', message: 'done' });
    expect(await repo.getJob('ghost')).toMatchObject({ status: 'completed', message: 'done' });
  });
});

describe('the export lock', () => {
  it('is held by one export at a time, re-entrant for the same job, and released by its holder', async () => {
    expect(await repo.acquireExportLock('e1')).toBe(true);
    expect(await repo.acquireExportLock('e2')).toBe(false);
    expect(await repo.acquireExportLock('e1')).toBe(true);
    await repo.releaseExportLock('e2'); // not the holder: nothing happens
    expect(await repo.acquireExportLock('e2')).toBe(false);
    await repo.releaseExportLock('e1');
    expect(await repo.acquireExportLock('e2')).toBe(true);
  });

  it('is freed when an export job ends', async () => {
    await repo.createJob(job('e1', { status: 'processing' }));
    await repo.acquireExportLock('e1');
    await repo.updateJob('e1', { status: 'completed', endTime: new Date().toISOString() });
    expect(await repo.acquireExportLock('e2')).toBe(true);
  });
});

describe('logs', () => {
  it('reads lines in order, then only what came after the cursor', async () => {
    await repo.createJob(job('j1'));
    await repo.appendLog('j1', { timestamp: iso(3000), level: 'info', message: 'one' });
    await repo.appendLog('j1', { timestamp: iso(2000), level: 'warn', message: 'two' });
    const first = await repo.getJobLogPage('j1');
    expect(first.logs.map((l) => l.message)).toEqual(['one', 'two']);
    expect(first.logs[0]).toEqual({ timestamp: expect.any(String), level: 'info', message: 'one' });

    await repo.appendLog('j1', { timestamp: iso(1000), level: 'info', message: 'three' });
    const next = await repo.getJobLogPage('j1', first.cursor);
    expect(next.logs.map((l) => l.message)).toEqual(['three']);
    const idle = await repo.getJobLogPage('j1', next.cursor);
    expect(idle).toEqual({ logs: [], cursor: next.cursor });
    // A cursor that is not a log key reads from the start.
    expect((await repo.getJobLogPage('j1', 'META')).logs).toHaveLength(3);
  });
});

describe('dead jobs', () => {
  const stale = (JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES + 5) * MIN;

  it('auto-fails a job whose heartbeat stopped, on list and on get, and frees its lock', async () => {
    await repo.createJob(job('dead', { status: 'processing', startTime: iso(stale) }));
    await portal()
      .job.patch({ jobId: 'dead' })
      .set({ lastUpdatedTime: iso(stale) })
      .go();
    await repo.acquireExportLock('dead');
    expect((await repo.getJob('dead'))?.status).toBe('failed');
    expect((await repo.listJobs())[0]?.status).toBe('failed');
    expect(await repo.acquireExportLock('next')).toBe(true);
  });

  it('leaves a long job with a recent heartbeat, and finished jobs, alone', async () => {
    await repo.createJob(job('long', { status: 'processing', startTime: iso(stale) }));
    await repo.createJob(job('done', { status: 'completed', startTime: iso(stale) }));
    await portal()
      .job.patch({ jobId: 'done' })
      .set({ lastUpdatedTime: iso(stale) })
      .go();
    expect((await repo.getJob('long'))?.status).toBe('processing');
    expect((await repo.getJob('done'))?.status).toBe('completed');
  });
});

describe('results and deletion', () => {
  it('stores a result as JSON, so a Date cannot fail a finished job', async () => {
    await repo.createJob(job('j1'));
    await repo.saveJobResult('j1', { at: new Date('2026-01-01T00:00:00Z'), rows: [1, 2] });
    expect(await repo.getJobResult('j1')).toEqual({ at: '2026-01-01T00:00:00.000Z', rows: [1, 2] });
  });

  it('replaces an oversized result with a truncation marker', async () => {
    await repo.createJob(job('j1'));
    await repo.saveJobResult('j1', { big: 'x'.repeat(400_000) });
    expect(await repo.getJobResult('j1')).toMatchObject({ truncated: true });
  });

  it('refuses a result for a job that does not exist', async () => {
    await expect(repo.saveJobResult('nope', {})).rejects.toThrow('Job nope not found');
  });

  it('deletes a job with its logs and its items', async () => {
    await repo.createJob(job('j1'));
    await repo.appendLog('j1', { timestamp: iso(1), level: 'info', message: 'x' });
    await new JobItemStore().put('j1', {
      key: '000#dashboard#d1',
      stage: 0,
      assetType: 'dashboard',
      assetId: 'd1',
      name: 'd1',
      status: 'pending',
      updatedAt: iso(1),
    });
    await repo.deleteJob('j1');
    expect(await repo.getJob('j1')).toBeNull();
    expect((await repo.getJobLogPage('j1')).logs).toEqual([]);
    expect(await new JobItemStore().all('j1')).toEqual([]);
  });
});
