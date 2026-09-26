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
export type PlaybookSpec = Schemas['PlaybookSpec'];
export type PlaybookSpecInput = Schemas['PlaybookSpecInput'];
export type PlaybookSpecCondition = Schemas['PlaybookSpecCondition'];
export type PlaybookSpecStep = Schemas['PlaybookSpecStep'];
export type PlaybookReport = Schemas['PlaybookReport'];
export type PlaybookReportSummary = Schemas['PlaybookReportSummary'];
type AiModelKey = Schemas['AiModelKey'];
export type GateValues = Record<string, number | string | boolean | null>;

/** Rows per request (the most the API gives); `items` reads every page. */
const PAGE_ROWS = 500;
/** A guard against a cursor that never ends. */
const MAX_PAGES = 100;

/** Fixes across the account: preview what one would do, then run it. */
export const playbooksApi = {
  async list(): Promise<Playbook[]> {
    return unwrap(await client.GET('/api/playbooks'), 'Failed to list the playbooks');
  },

  /** Queue a preview; its rows come from `items`. */
  async preview(
    playbookId: string,
    params: Record<string, unknown>,
    gates: GateValues,
    model?: AiModelKey
  ) {
    return accepted(
      await client.POST('/api/playbooks/{playbookId}/preview', {
        params: { path: { playbookId } },
        body: { params, gates, ...(model ? { model } : {}) },
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

  /** A saved playbook's spec, or a shipped one's to copy. */
  async getSpec(playbookId: string): Promise<PlaybookSpec> {
    return unwrap(
      await client.GET('/api/playbooks/custom/{playbookId}', { params: { path: { playbookId } } }),
      'Failed to read the playbook'
    );
  },

  async createSpec(spec: PlaybookSpecInput): Promise<PlaybookSpec> {
    return unwrap(
      await client.POST('/api/playbooks/custom', { body: spec }),
      'Failed to save the playbook'
    );
  },

  async updateSpec(playbookId: string, spec: PlaybookSpecInput): Promise<PlaybookSpec> {
    return unwrap(
      await client.PUT('/api/playbooks/custom/{playbookId}', {
        params: { path: { playbookId } },
        body: spec,
      }),
      'Failed to save the playbook'
    );
  },

  async deleteSpec(playbookId: string): Promise<void> {
    unwrap(
      await client.DELETE('/api/playbooks/custom/{playbookId}', {
        params: { path: { playbookId } },
      }),
      'Failed to delete the playbook'
    );
  },

  /** Every row of a preview or run, and how it went: to read or download. */
  async report(jobId: string): Promise<PlaybookReport> {
    return unwrap(
      await client.GET('/api/playbooks/runs/{jobId}/report', { params: { path: { jobId } } }),
      'Failed to build the report'
    );
  },

  async saveReport(jobId: string): Promise<PlaybookReportSummary> {
    return unwrap(
      await client.POST('/api/playbooks/runs/{jobId}/report', { params: { path: { jobId } } }),
      'Failed to save the report'
    );
  },

  async listReports(): Promise<PlaybookReportSummary[]> {
    return unwrap(await client.GET('/api/playbooks/reports'), 'Failed to list the reports');
  },

  async getReport(jobId: string): Promise<PlaybookReport> {
    return unwrap(
      await client.GET('/api/playbooks/reports/{jobId}', { params: { path: { jobId } } }),
      'Failed to read the report'
    );
  },

  /**
   * Every row of a preview or run, however many pages: what is chosen and
   * counted on screen must be what a run changes.
   */
  async items(jobId: string, query: ItemsQuery = {}): Promise<PlaybookItemsPage> {
    const read = async (after?: string) =>
      unwrap(
        await client.GET('/api/playbooks/runs/{jobId}/items', {
          params: {
            path: { jobId },
            query: { ...query, limit: PAGE_ROWS, ...(after ? { cursor: after } : {}) },
          },
        }),
        'Failed to read the rows'
      );
    const first = await read();
    const items = [...first.items];
    let cursor = first.cursor;
    for (let page = 1; cursor && page < MAX_PAGES; page++) {
      const next = await read(cursor);
      items.push(...next.items);
      cursor = next.cursor;
    }
    return { ...first, items, cursor: undefined };
  },
};
