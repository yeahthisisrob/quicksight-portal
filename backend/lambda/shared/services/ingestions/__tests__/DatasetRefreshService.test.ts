import { beforeEach, describe, expect, it, vi } from 'vitest';

const freshness = vi.hoisted(() => vi.fn());
vi.mock('../../catalog/assetFreshness', () => ({ keepCatalogFresh: freshness }));
const store = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../catalog/catalogStore', () => ({ catalog: store }));
const audit = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock('../../audit/AuditLog', () => ({ auditLog: audit }));
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { DatasetRefreshService, scheduleFromSdk, scheduleToSdk } from '../DatasetRefreshService';

const AUTH = { userId: 'u1', accountId: '1', email: 'pat@example.com' };

describe('DatasetRefreshService', () => {
  let qs: any;
  let cache: any;
  let service: DatasetRefreshService;

  beforeEach(() => {
    vi.clearAllMocks();
    qs = {
      createIngestion: vi
        .fn()
        .mockResolvedValue({ ingestionId: 'ing-1', arn: 'arn:ing', status: 'INITIALIZED' }),
      listRefreshSchedules: vi.fn().mockResolvedValue([]),
      createRefreshSchedule: vi.fn().mockResolvedValue({ Arn: 'arn:sched' }),
      updateRefreshSchedule: vi.fn().mockResolvedValue({ Arn: 'arn:sched' }),
      deleteRefreshSchedule: vi.fn().mockResolvedValue(undefined),
    };
    cache = {
      getIngestions: vi.fn().mockResolvedValue({
        ingestions: [{ id: 'old', datasetId: 'ds1', status: 'COMPLETED', createdTime: 't' }],
        metadata: { totalIngestions: 1 },
      }),
      saveIngestions: vi.fn().mockResolvedValue(undefined),
    };
    store.get.mockResolvedValue({
      assetId: 'ds1',
      assetName: 'Orders',
      arn: 'arn:ds1',
      metadata: { importMode: 'SPICE' },
    });
    service = new DatasetRefreshService(qs, cache);
  });

  it('starts a refresh, puts it at the top of the cached list, and records who asked', async () => {
    const ingestion = await service.refreshNow('ds1', 'FULL_REFRESH', AUTH as any);
    expect(qs.createIngestion).toHaveBeenCalledWith(
      'ds1',
      expect.stringMatching(/^portal-/),
      'FULL_REFRESH'
    );
    expect(ingestion).toMatchObject({
      id: 'ing-1',
      datasetId: 'ds1',
      datasetName: 'Orders',
      status: 'INITIALIZED',
    });
    const [ingestions, metadata] = cache.saveIngestions.mock.calls[0];
    expect(ingestions.map((i: any) => i.id)).toEqual(['ing-1', 'old']);
    expect(metadata).toMatchObject({ totalIngestions: 2, runningIngestions: 1 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dataset.refresh', assetId: 'ds1' })
    );
  });

  it('refuses a direct query dataset', async () => {
    store.get.mockResolvedValue({
      assetId: 'ds2',
      assetName: 'Live',
      metadata: { importMode: 'DIRECT_QUERY' },
    });
    await expect(service.refreshNow('ds2')).rejects.toThrow(/direct query/);
    expect(qs.createIngestion).not.toHaveBeenCalled();
  });

  it('maps schedules both ways and checks what a weekly or monthly one needs', () => {
    const sdk = scheduleToSdk(
      {
        interval: 'WEEKLY',
        refreshType: 'FULL_REFRESH',
        timeOfTheDay: '06:30',
        timezone: 'UTC',
        dayOfWeek: 'MONDAY',
      },
      's1'
    );
    expect(sdk).toEqual({
      ScheduleId: 's1',
      RefreshType: 'FULL_REFRESH',
      ScheduleFrequency: {
        Interval: 'WEEKLY',
        TimeOfTheDay: '06:30',
        Timezone: 'UTC',
        RefreshOnDay: { DayOfWeek: 'MONDAY' },
      },
    });
    expect(scheduleFromSdk({ ...sdk, Arn: 'arn:s1' })).toEqual({
      scheduleId: 's1',
      arn: 'arn:s1',
      refreshType: 'FULL_REFRESH',
      scheduleFrequency: {
        interval: 'WEEKLY',
        timeOfTheDay: '06:30',
        timezone: 'UTC',
        refreshOnDay: { dayOfWeek: 'MONDAY' },
      },
    });
    expect(() => scheduleToSdk({ interval: 'WEEKLY', refreshType: 'FULL_REFRESH' }, 's')).toThrow(
      /dayOfWeek/
    );
    expect(() =>
      scheduleToSdk({ interval: 'MONTHLY', refreshType: 'FULL_REFRESH', dayOfMonth: '40' }, 's')
    ).toThrow(/dayOfMonth/);
    expect(() =>
      scheduleToSdk({ interval: 'DAILY', refreshType: 'FULL_REFRESH', timeOfTheDay: '25:00' }, 's')
    ).toThrow(/HH:MM/);
  });

  it('writes a schedule, then refreshes the export that carries them', async () => {
    const created = await service.createSchedule(
      'ds1',
      {
        interval: 'DAILY',
        refreshType: 'INCREMENTAL_REFRESH',
        timeOfTheDay: '02:00',
        timezone: 'Europe/London',
      },
      AUTH as any
    );
    expect(created.scheduleFrequency).toEqual({
      interval: 'DAILY',
      timeOfTheDay: '02:00',
      timezone: 'Europe/London',
    });
    expect(freshness).toHaveBeenCalledWith([{ assetType: 'dataset', assetId: 'ds1' }]);
    await service.deleteSchedule('ds1', created.scheduleId, AUTH as any);
    expect(qs.deleteRefreshSchedule).toHaveBeenCalledWith('ds1', created.scheduleId);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });
});
