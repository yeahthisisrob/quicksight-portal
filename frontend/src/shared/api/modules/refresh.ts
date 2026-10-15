import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type Schemas = components['schemas'];
export type RefreshSchedule = Schemas['RefreshSchedule'];
export type RefreshScheduleInput = Schemas['RefreshScheduleInput'];
export type RefreshType = RefreshSchedule['refreshType'];
export type Ingestion = Schemas['Ingestion'];

/** A SPICE dataset's refreshes: now, and on a schedule. */
export const refreshApi = {
  /** Start a refresh; the ingestion shows in the list at once. */
  async refreshNow(datasetId: string, type: RefreshType = 'FULL_REFRESH'): Promise<Ingestion> {
    return unwrap(
      await client.POST('/api/ingestions/{datasetId}', {
        params: { path: { datasetId } },
        body: { type },
      }),
      'The refresh could not be started'
    );
  },

  async listSchedules(datasetId: string): Promise<RefreshSchedule[]> {
    return unwrap(
      await client.GET('/api/assets/dataset/{assetId}/refresh-schedules', {
        params: { path: { assetId: datasetId } },
      }),
      'The refresh schedules could not be read'
    ).schedules;
  },

  async createSchedule(datasetId: string, input: RefreshScheduleInput): Promise<RefreshSchedule> {
    return unwrap(
      await client.POST('/api/assets/dataset/{assetId}/refresh-schedules', {
        params: { path: { assetId: datasetId } },
        body: input,
      }),
      'The refresh schedule could not be created'
    );
  },

  async updateSchedule(
    datasetId: string,
    scheduleId: string,
    input: RefreshScheduleInput
  ): Promise<RefreshSchedule> {
    return unwrap(
      await client.PUT('/api/assets/dataset/{assetId}/refresh-schedules/{scheduleId}', {
        params: { path: { assetId: datasetId, scheduleId } },
        body: input,
      }),
      'The refresh schedule could not be changed'
    );
  },

  async deleteSchedule(datasetId: string, scheduleId: string): Promise<void> {
    unwrap(
      await client.DELETE('/api/assets/dataset/{assetId}/refresh-schedules/{scheduleId}', {
        params: { path: { assetId: datasetId, scheduleId } },
      }),
      'The refresh schedule could not be removed'
    );
  },
};
