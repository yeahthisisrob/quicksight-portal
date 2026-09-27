import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';
import { assetsApi } from './assets';
import { jobsApi } from './jobs';

type Schemas = components['schemas'];

export type ThemeDraft = Schemas['ThemeDraft'];
export type ThemeListItem = Schemas['ThemeListItem'];
export type ThemeProposal = Schemas['ThemeProposal'];

/** QuickSight's own themes, which every account has and nothing lists. */
export const BUILT_IN_THEMES = ['CLASSIC', 'MIDNIGHT', 'SEASIDE', 'RAINIER'] as const;

const ALL_THEMES = 500;

/** Custom themes (from the cache) and making new ones, by hand or from a picture. */
export const themesApi = {
  async list(): Promise<ThemeListItem[]> {
    const page = await assetsApi.getThemesPaginated({ page: 1, pageSize: ALL_THEMES });
    return page.themes ?? [];
  },

  async create(draft: ThemeDraft) {
    return unwrap(
      await client.POST('/api/authoring/themes', { body: draft }),
      'Failed to create the theme'
    );
  },

  /**
   * A draft drawn from a picture (a data URL). A model reads it as a job;
   * this queues it and waits. Nothing is created.
   */
  async proposeFromImage(image: string, note?: string, model?: string): Promise<ThemeProposal> {
    const queued = unwrap(
      await client.POST('/api/authoring/themes/propose', {
        body: { image, ...(note?.trim() ? { note } : {}), ...(model ? { model } : {}) },
      }),
      'Failed to queue the theme proposal'
    );
    return jobsApi.awaitResult<ThemeProposal>(queued.jobId);
  },
};
