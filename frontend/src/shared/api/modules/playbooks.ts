import type { components, paths } from '@shared/generated/types';

import { accepted, client, unwrap } from '../typed';

type Schemas = components['schemas'];
export type Playbook = Schemas['Playbook'];
export type PlaybookGate = Schemas['PlaybookGate'];
export type PlaybookItem = Schemas['PlaybookItem'];
export type PlaybookItemCounts = Schemas['PlaybookItemCounts'];
export type PlaybookItemsPage = Schemas['PlaybookItemsPage'];
type ItemsQuery = NonNullable<
  paths['/api/playbooks/runs/{jobId}/items']['get']['parameters']['query']
>;
type RunBody = NonNullable<
  paths['/api/playbooks/{playbookId}/run']['post']['requestBody']
>['content']['application/json'];
export type RunLimits = NonNullable<RunBody['limits']>;
export type GateValues = Record<string, number | string | boolean | null>;

/** Most rows a preview or run shows at once; the counts cover all of them. */
const ALL_ROWS = 500;

/** Fixes across the account: preview what one would do, then run it. */
export const playbooksApi = {
  async list(): Promise<Playbook[]> {
    return unwrap(await client.GET('/api/playbooks'), 'Failed to list the playbooks');
  },

  /** Queue a preview; its rows come from `items`. */
  async preview(playbookId: string, params: Record<string, unknown>, gates: GateValues) {
    return accepted(
      await client.POST('/api/playbooks/{playbookId}/preview', {
        params: { path: { playbookId } },
        body: { params, gates },
      }),
      'Failed to start the preview'
    );
  },

  /** Run a finished preview: its 'change' rows, only `keys`, or an earlier run's failures. */
  async run(
    playbookId: string,
    previewJobId: string,
    options: { keys?: string[]; retryOf?: string; limits?: RunLimits } = {}
  ) {
    return accepted(
      await client.POST('/api/playbooks/{playbookId}/run', {
        params: { path: { playbookId } },
        body: { previewJobId, ...options },
      }),
      'Failed to start the run'
    );
  },

  async items(jobId: string, query: ItemsQuery = { limit: ALL_ROWS }): Promise<PlaybookItemsPage> {
    return unwrap(
      await client.GET('/api/playbooks/runs/{jobId}/items', {
        params: { path: { jobId }, query },
      }),
      'Failed to read the rows'
    );
  },
};
