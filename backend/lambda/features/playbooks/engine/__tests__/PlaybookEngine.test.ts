import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JobItem } from '../../../../shared/services/jobs/JobItemStore';
import type { ItemPlan, Playbook, PlaybookJobRequest, ScopedTarget } from '../../types';
import { type EngineJob, PlaybookEngine } from '../PlaybookEngine';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-26T12:00:00Z');

/** Rows kept in memory, per job, the way JobItemStore keeps them in DynamoDB. */
function memoryStore() {
  const jobs = new Map<string, Map<string, JobItem>>();
  const of = (id: string) => jobs.get(id) ?? jobs.set(id, new Map()).get(id)!;
  return {
    jobs,
    all: vi.fn(async (id: string) =>
      [...of(id).values()].sort((a, b) => a.key.localeCompare(b.key))
    ),
    putAll: vi.fn(async (id: string, items: JobItem[]) => {
      for (const item of items) of(id).set(item.key, { ...item });
    }),
    put: vi.fn(async (id: string, item: JobItem) => {
      of(id).set(item.key, { ...item });
    }),
  };
}

function target(id: string, extra: Partial<ScopedTarget> = {}): ScopedTarget {
  return { assetType: 'dataset', assetId: id, name: id.toUpperCase(), ...extra };
}

function job(store: ReturnType<typeof memoryStore>, jobId: string, extra: Partial<EngineJob> = {}) {
  return {
    jobId,
    items: store,
    progress: vi.fn(async () => {}),
    log: vi.fn(async () => {}),
    stopRequested: vi.fn(async () => false),
    deadline: null,
    now: () => NOW,
    ...extra,
  } satisfies EngineJob;
}

function playbook(overrides: Partial<Playbook> = {}): Playbook {
  return {
    id: 'test',
    title: 'Test',
    description: '',
    category: 'data',
    params: [],
    writes: ['dataset'],
    scope: vi.fn(async () => [target('a'), target('b'), target('c')]),
    plan: vi.fn(async (): Promise<ItemPlan> => ({ verdict: 'change', summary: 'move it' })),
    apply: vi.fn(async () => ({ summary: 'moved' })),
    ...overrides,
  };
}

const preview: PlaybookJobRequest = { mode: 'preview', playbookId: 'test', params: {} };
const run = (extra: object = {}): PlaybookJobRequest => ({
  mode: 'run',
  playbookId: 'test',
  params: {},
  previewJobId: 'p1',
  ...extra,
});
const ctx = { call: vi.fn(), params: {} };

describe('PlaybookEngine', () => {
  let store: ReturnType<typeof memoryStore>;
  beforeEach(() => {
    store = memoryStore();
  });

  it('previews: scopes once, plans every asset and keeps each verdict on its row', async () => {
    const book = playbook({
      plan: vi.fn(async (_c, t) =>
        t.assetId === 'b'
          ? { verdict: 'review' as const, summary: 'other workgroup' }
          : { verdict: 'change' as const, summary: 'move', changes: ['x → y'], data: { t: 1 } }
      ),
    });
    const outcome = await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);

    expect(outcome.state).toBe('finished');
    expect(outcome.counts.verdicts).toEqual({ change: 2, review: 1, skip: 0 });
    const rows = await store.all('p1');
    expect(rows.map((r) => [r.assetId, r.status, r.verdict])).toEqual([
      ['a', 'planned', 'change'],
      ['b', 'planned', 'review'],
      ['c', 'planned', 'change'],
    ]);
    expect(rows[0]?.plan).toEqual({ t: 1 });
    expect(book.apply).not.toHaveBeenCalled();
  });

  it('lists what gates held back as skipped, with the reason, and never plans them', async () => {
    const book = playbook({
      gateDefaults: { editedWithinDays: 7 },
      scope: vi.fn(async () => [
        target('fresh', { entry: { lastUpdatedTime: new Date(NOW - 2 * DAY) } as any }),
        target('old', { entry: { lastUpdatedTime: new Date(NOW - 30 * DAY), tags: [] } as any }),
        target('optout', {
          entry: {
            lastUpdatedTime: new Date(NOW - 30 * DAY),
            tags: [{ key: 'portal:playbook-skip', value: '' }],
          } as any,
        }),
      ]),
    });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);

    const rows = Object.fromEntries((await store.all('p1')).map((r) => [r.assetId, r]));
    expect(rows.fresh).toMatchObject({
      status: 'skipped',
      summary: expect.stringContaining('2 days ago'),
    });
    expect(rows.optout).toMatchObject({
      status: 'skipped',
      summary: expect.stringContaining('Opted out'),
    });
    expect(rows.old?.status).toBe('planned');
    expect(book.plan).toHaveBeenCalledTimes(1);
  });

  it('a gate turned off (null) lets everything through; a canary keeps only the first few', async () => {
    const book = playbook({ gateDefaults: { editedWithinDays: 7 } });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute({
      ...preview,
      gates: { editedWithinDays: null, canary: 2 },
    });
    const rows = await store.all('p1');
    expect(rows.filter((r) => r.status === 'planned')).toHaveLength(2);
    expect(rows[2]).toMatchObject({ status: 'skipped', summary: 'Beyond the canary of 2' });
  });

  it('runs the preview’s changes stage by stage, planning each again first', async () => {
    const order: string[] = [];
    const book = playbook({
      scope: vi.fn(async () => [
        target('ds', { assetType: 'datasource' }),
        target('set'),
        target('an', { assetType: 'analysis' }),
      ]),
      stage: (t) => ({ analysis: 0, dataset: 1, datasource: 2 })[t.assetType as string] ?? 0,
      apply: vi.fn(async (_c, t) => {
        order.push(t.assetId);
        return { summary: 'gone' };
      }),
    });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);
    const outcome = await new PlaybookEngine(book, ctx, job(store, 'r1')).execute(run());

    expect(order).toEqual(['an', 'set', 'ds']);
    expect(outcome.counts.done).toBe(3);
    // Once to preview, once more before each change.
    expect(book.plan).toHaveBeenCalledTimes(6);
  });

  it('skips what no longer needs changing and sends new doubts to review', async () => {
    await new PlaybookEngine(playbook(), ctx, job(store, 'p1')).execute(preview);
    const book = playbook({
      plan: vi.fn(async (_c, t) =>
        t.assetId === 'a'
          ? { verdict: 'skip' as const, summary: 'fixed by hand' }
          : t.assetId === 'b'
            ? { verdict: 'review' as const, summary: 'now ambiguous' }
            : { verdict: 'change' as const, summary: 'move' }
      ),
    });
    const outcome = await new PlaybookEngine(book, ctx, job(store, 'r1')).execute(run());

    expect(outcome.counts).toMatchObject({ done: 1, skipped: 1, review: 1 });
    const rows = await store.all('r1');
    expect(rows[0]?.summary).toBe('Nothing to do now: fixed by hand');
    expect(book.apply).toHaveBeenCalledTimes(1);
  });

  it('runs only the chosen rows when keys are given', async () => {
    await new PlaybookEngine(playbook(), ctx, job(store, 'p1')).execute(preview);
    const keys = (await store.all('p1')).slice(0, 1).map((r) => r.key);
    const book = playbook();
    await new PlaybookEngine(book, ctx, job(store, 'r1')).execute(run({ keys }));
    expect(book.apply).toHaveBeenCalledTimes(1);
  });

  it('halts once too many have failed, leaving the rest pending', async () => {
    const many = Array.from({ length: 20 }, (_, i) => target(`d${String(i).padStart(2, '0')}`));
    const book = playbook({
      scope: vi.fn(async () => many),
      apply: vi.fn(async () => {
        throw new Error('AccessDenied');
      }),
    });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);
    const outcome = await new PlaybookEngine(book, ctx, job(store, 'r1')).execute(
      run({ limits: { concurrency: 1, failureMinimum: 3, failureThreshold: 0.5 } })
    );

    expect(outcome.state).toBe('halted');
    expect(outcome.counts.failed).toBe(3);
    expect(outcome.counts.pending).toBe(17);
    expect((await store.all('r1'))[0]?.error).toBe('AccessDenied');
  });

  it('pauses at the deadline and carries on from the rows in the next invocation', async () => {
    let clock = NOW;
    const book = playbook({
      apply: vi.fn(async () => {
        clock += 1000;
        return { summary: 'ok' };
      }),
    });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);

    const first = await new PlaybookEngine(
      book,
      ctx,
      job(store, 'r1', { deadline: NOW + 1500, now: () => clock })
    ).execute(run({ limits: { concurrency: 1 } }));
    expect(first.state).toBe('paused');
    expect(first.counts.done).toBe(2);

    const second = await new PlaybookEngine(
      book,
      ctx,
      job(store, 'r1', { now: () => clock })
    ).execute(run({ limits: { concurrency: 1 } }));
    expect(second.state).toBe('finished');
    expect(second.counts.done).toBe(3);
    expect(book.apply).toHaveBeenCalledTimes(3);
  });

  it('retries only what failed in an earlier run', async () => {
    const failing = playbook({
      apply: vi.fn(async (_c, t) => {
        if (t.assetId === 'b') throw new Error('throttled');
        return { summary: 'ok' };
      }),
    });
    await new PlaybookEngine(failing, ctx, job(store, 'p1')).execute(preview);
    await new PlaybookEngine(failing, ctx, job(store, 'r1')).execute(run());

    const book = playbook();
    const retry = await new PlaybookEngine(book, ctx, job(store, 'r2')).execute(
      run({ retryOf: 'r1' })
    );
    expect(retry.counts).toMatchObject({ total: 1, done: 1 });
    expect(book.apply).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ assetId: 'b' }),
      expect.anything()
    );
  });

  it('stops when asked, leaving the rest as they were', async () => {
    await new PlaybookEngine(playbook(), ctx, job(store, 'p1')).execute(preview);
    const book = playbook();
    const outcome = await new PlaybookEngine(
      book,
      ctx,
      job(store, 'r1', { stopRequested: vi.fn(async () => true) })
    ).execute(run());
    expect(outcome.state).toBe('stopped');
    expect(book.apply).not.toHaveBeenCalled();
    expect(outcome.counts.pending).toBe(3);
  });

  it('judges gates by the facts a spec target carries (tags, last change), not only a cache entry', async () => {
    const book = playbook({
      gateDefaults: { editedWithinDays: 7 },
      scope: vi.fn(async () => [
        target('fresh', { lastUpdatedTime: new Date(NOW - DAY).toISOString() }),
        target('optout', { tags: [{ key: 'portal:playbook-skip', value: '' }] }),
        target('fine', { lastUpdatedTime: new Date(NOW - 30 * DAY).toISOString(), tags: [] }),
      ]),
    });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);
    const rows = Object.fromEntries((await store.all('p1')).map((r) => [r.assetId, r.status]));
    expect(rows).toEqual({ fresh: 'skipped', optout: 'skipped', fine: 'planned' });
  });

  it('a canary set as the playbook’s default holds back the rest', async () => {
    const book = playbook({ gateDefaults: { canary: 1 } });
    await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);
    expect((await store.all('p1')).filter((r) => r.status === 'planned')).toHaveLength(1);
  });

  it('never halts a preview on failed checks: they are findings', async () => {
    const many = Array.from({ length: 12 }, (_, i) => target(`d${String(i).padStart(2, '0')}`));
    const book = playbook({
      scope: vi.fn(async () => many),
      plan: vi.fn(async () => {
        throw new Error('graph miss');
      }),
    });
    const outcome = await new PlaybookEngine(book, ctx, job(store, 'p1')).execute(preview);
    expect(outcome.state).toBe('finished');
    expect(outcome.counts.failed).toBe(12);
  });

  it('a retry takes what the earlier run failed and what it never reached', async () => {
    await new PlaybookEngine(playbook(), ctx, job(store, 'p1')).execute(preview);
    await new PlaybookEngine(
      playbook(),
      ctx,
      job(store, 'r1', { stopRequested: vi.fn(async () => true) })
    ).execute(run());
    const book = playbook();
    const retry = await new PlaybookEngine(book, ctx, job(store, 'r2')).execute(
      run({ retryOf: 'r1' })
    );
    expect(retry.counts).toMatchObject({ total: 3, done: 3 });
  });
});
