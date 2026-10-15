/**
 * A dataset's refreshes as something a person or the assistant can act on:
 * refresh it now, and its schedules read live, made, changed or removed.
 * Schedules are kept in the words the API serves (camelCase), mapped to
 * and from QuickSight's. A refresh started here shows in the ingestions
 * list at once rather than at the next activity refresh, and every
 * schedule write refreshes the dataset's export, which carries them.
 */
import type { components } from '@shared/generated/types';

import { type AuthContext, actorLabel } from '../../auth';
import { ValidationError } from '../../errors/ValidationError';
import { logger } from '../../utils/logger';
import { auditLog } from '../audit/AuditLog';
import type { QuickSightService } from '../aws/QuickSightService';
import type { CacheService } from '../cache/CacheService';
import { keepCatalogFresh } from '../catalog/assetFreshness';
import { catalog } from '../catalog/catalogStore';

export type RefreshSchedule = components['schemas']['RefreshSchedule'];
export type RefreshScheduleInput = components['schemas']['RefreshScheduleInput'];
export type RefreshType = RefreshSchedule['refreshType'];
type Ingestion = components['schemas']['Ingestion'];

const INTERVALS = new Set(['MINUTE15', 'MINUTE30', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']);
const REFRESH_TYPES = new Set(['FULL_REFRESH', 'INCREMENTAL_REFRESH']);
const DAYS = new Set([
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_OF_MONTH = /^([1-9]|[12]\d|3[01])$/;
/** Ingestion ids are unique per dataset; the portal's say when they were asked for. */
const ID_RANDOM = 36;
const ID_SLICE = 2;
const ID_RANDOM_CHARS = 6;

function actorOf(auth: AuthContext) {
  return auth.apiKey
    ? { kind: 'api-key' as const, id: auth.apiKey.id, label: auth.apiKey.label }
    : { kind: 'user' as const, id: auth.userId, label: actorLabel(auth) };
}

/** QuickSight's schedule, in the API's words. */
export function scheduleFromSdk(raw: any): RefreshSchedule {
  const freq = raw?.ScheduleFrequency ?? raw?.scheduleFrequency ?? {};
  const onDay = freq.RefreshOnDay ?? freq.refreshOnDay;
  return {
    scheduleId: raw?.ScheduleId ?? raw?.scheduleId ?? '',
    arn: raw?.Arn ?? raw?.arn ?? '',
    refreshType: raw?.RefreshType ?? raw?.refreshType ?? 'FULL_REFRESH',
    scheduleFrequency: {
      interval: freq.Interval ?? freq.interval ?? 'DAILY',
      ...((freq.TimeOfTheDay ?? freq.timeOfTheDay)
        ? { timeOfTheDay: freq.TimeOfTheDay ?? freq.timeOfTheDay }
        : {}),
      ...((freq.Timezone ?? freq.timezone) ? { timezone: freq.Timezone ?? freq.timezone } : {}),
      ...(onDay
        ? {
            refreshOnDay: {
              ...((onDay.DayOfWeek ?? onDay.dayOfWeek)
                ? { dayOfWeek: onDay.DayOfWeek ?? onDay.dayOfWeek }
                : {}),
              ...((onDay.DayOfMonth ?? onDay.dayOfMonth)
                ? { dayOfMonth: onDay.DayOfMonth ?? onDay.dayOfMonth }
                : {}),
            },
          }
        : {}),
    },
    ...((raw?.StartAfterDateTime ?? raw?.startAfterDateTime)
      ? {
          startAfterDateTime: new Date(
            raw.StartAfterDateTime ?? raw.startAfterDateTime
          ).toISOString(),
        }
      : {}),
  };
}

/** A schedule as asked for, checked, in QuickSight's words. */
export function scheduleToSdk(
  input: RefreshScheduleInput,
  scheduleId: string
): Record<string, any> {
  if (!INTERVALS.has(input.interval)) {
    throw new ValidationError(`interval must be one of ${[...INTERVALS].join(', ')}`);
  }
  if (!REFRESH_TYPES.has(input.refreshType)) {
    throw new ValidationError('refreshType must be FULL_REFRESH or INCREMENTAL_REFRESH');
  }
  if (input.timeOfTheDay && !TIME_OF_DAY.test(input.timeOfTheDay)) {
    throw new ValidationError('timeOfTheDay must be HH:MM (24-hour)');
  }
  if (input.interval === 'WEEKLY' && (!input.dayOfWeek || !DAYS.has(input.dayOfWeek))) {
    throw new ValidationError('A weekly schedule needs a dayOfWeek');
  }
  if (input.interval === 'MONTHLY' && (!input.dayOfMonth || !DAY_OF_MONTH.test(input.dayOfMonth))) {
    throw new ValidationError('A monthly schedule needs a dayOfMonth from 1 to 31');
  }
  const refreshOnDay =
    input.interval === 'WEEKLY'
      ? { DayOfWeek: input.dayOfWeek }
      : input.interval === 'MONTHLY'
        ? { DayOfMonth: input.dayOfMonth }
        : undefined;
  return {
    ScheduleId: scheduleId,
    RefreshType: input.refreshType,
    ScheduleFrequency: {
      Interval: input.interval,
      ...(input.timeOfTheDay ? { TimeOfTheDay: input.timeOfTheDay } : {}),
      ...(input.timezone ? { Timezone: input.timezone } : {}),
      ...(refreshOnDay ? { RefreshOnDay: refreshOnDay } : {}),
    },
    ...(input.startAfterDateTime ? { StartAfterDateTime: new Date(input.startAfterDateTime) } : {}),
  };
}

export class DatasetRefreshService {
  public constructor(
    private readonly quickSightService: QuickSightService,
    private readonly cacheService: Pick<CacheService, 'getIngestions' | 'saveIngestions'>
  ) {}

  /** Start a SPICE refresh now; the ingestion shows in the list at once. */
  public async refreshNow(
    datasetId: string,
    type: RefreshType = 'FULL_REFRESH',
    auth?: AuthContext
  ): Promise<Ingestion> {
    if (!REFRESH_TYPES.has(type)) {
      throw new ValidationError('type must be FULL_REFRESH or INCREMENTAL_REFRESH');
    }
    const dataset = await catalog.get('dataset', datasetId);
    if (!dataset) {
      throw new ValidationError(`No dataset ${datasetId} in the catalog`);
    }
    if (dataset.metadata?.importMode && dataset.metadata.importMode !== 'SPICE') {
      throw new ValidationError(
        `${dataset.assetName} is a direct query dataset; there is nothing to refresh`
      );
    }
    const ingestionId = `portal-${Date.now().toString(ID_RANDOM)}-${Math.random()
      .toString(ID_RANDOM)
      .slice(ID_SLICE, ID_SLICE + ID_RANDOM_CHARS)}`;
    const started = await this.quickSightService.createIngestion(datasetId, ingestionId, type);
    const ingestion: Ingestion = {
      id: started.ingestionId,
      datasetId,
      datasetName: dataset.assetName,
      ...(dataset.arn ? { datasetArn: dataset.arn } : {}),
      importMode: 'SPICE',
      ...(started.arn ? { ingestionArn: started.arn } : {}),
      status: (started.status ?? 'INITIALIZED') as Ingestion['status'],
      createdTime: new Date().toISOString(),
      requestType: type,
    };
    await this.rememberIngestion(ingestion);
    if (auth) {
      await auditLog.record({
        actor: actorOf(auth),
        channel: auth.apiKey ? 'api' : 'ui',
        action: 'dataset.refresh',
        assetType: 'dataset',
        assetId: datasetId,
        assetName: dataset.assetName,
        details: { ingestionId: started.ingestionId, type },
      });
    }
    return ingestion;
  }

  /** The dataset's schedules, live. */
  public async schedules(datasetId: string): Promise<RefreshSchedule[]> {
    const raw: any[] = (await this.quickSightService.listRefreshSchedules(datasetId)) ?? [];
    return raw.map(scheduleFromSdk);
  }

  public async createSchedule(
    datasetId: string,
    input: RefreshScheduleInput,
    auth?: AuthContext
  ): Promise<RefreshSchedule> {
    const scheduleId = `portal-${Date.now().toString(ID_RANDOM)}`;
    const schedule = scheduleToSdk(input, scheduleId);
    const created = await this.quickSightService.createRefreshSchedule(datasetId, schedule);
    await this.afterScheduleChange(datasetId, 'dataset.schedule.create', scheduleId, auth);
    return scheduleFromSdk({ ...schedule, Arn: created?.Arn });
  }

  public async updateSchedule(
    datasetId: string,
    scheduleId: string,
    input: RefreshScheduleInput,
    auth?: AuthContext
  ): Promise<RefreshSchedule> {
    const schedule = scheduleToSdk(input, scheduleId);
    const updated = await this.quickSightService.updateRefreshSchedule(datasetId, schedule);
    await this.afterScheduleChange(datasetId, 'dataset.schedule.update', scheduleId, auth);
    return scheduleFromSdk({ ...schedule, Arn: updated?.Arn });
  }

  public async deleteSchedule(
    datasetId: string,
    scheduleId: string,
    auth?: AuthContext
  ): Promise<void> {
    await this.quickSightService.deleteRefreshSchedule(datasetId, scheduleId);
    await this.afterScheduleChange(datasetId, 'dataset.schedule.delete', scheduleId, auth);
  }

  /** The export carries the schedules: refresh it, and say who changed what. */
  private async afterScheduleChange(
    datasetId: string,
    action: string,
    scheduleId: string,
    auth?: AuthContext
  ): Promise<void> {
    await keepCatalogFresh([{ assetType: 'dataset', assetId: datasetId }]);
    if (!auth) return;
    const dataset = await catalog.get('dataset', datasetId).catch(() => null);
    await auditLog.record({
      actor: actorOf(auth),
      channel: auth.apiKey ? 'api' : 'ui',
      action,
      assetType: 'dataset',
      assetId: datasetId,
      assetName: dataset?.assetName,
      details: { scheduleId },
    });
  }

  /** Put the new ingestion at the top of the cached list, so it shows before the next activity refresh. */
  private async rememberIngestion(ingestion: Ingestion): Promise<void> {
    try {
      const cached = await this.cacheService.getIngestions();
      const ingestions = [ingestion, ...(cached?.ingestions ?? [])];
      const metadata = {
        ...(cached?.metadata ?? {}),
        totalIngestions: ingestions.length,
        runningIngestions: ingestions.filter((i: any) =>
          ['RUNNING', 'QUEUED', 'INITIALIZED'].includes(i.status)
        ).length,
        failedIngestions: ingestions.filter((i: any) => i.status === 'FAILED').length,
        lastUpdated: new Date().toISOString(),
      };
      await this.cacheService.saveIngestions(ingestions, metadata);
    } catch (error) {
      logger.warn('The new ingestion could not be added to the cached list', {
        datasetId: ingestion.datasetId,
        error,
      });
    }
  }
}
