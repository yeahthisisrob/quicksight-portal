/**
 * API stubs for the metadata sync stories: the card in every state, a pass
 * that advances on each poll, and a conflict that can be settled. The
 * account is made up.
 */
import type { MockRoute } from '../../../../../.storybook/mocks/api';
import type { JobMetadata } from '../../../../shared/api/modules/jobs';
import type {
  MetadataSyncReport,
  MetadataSyncStatus,
} from '../../../../shared/api/modules/metadataSync';

const HOUR_MS = 60 * 60 * 1000;
const POLLS_TO_FINISH = 3;
const PROGRESS_STEP = 34;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();
const ASSET = 'smus:asset-orders';

const PREVIEW: MetadataSyncReport = {
  version: 1,
  mode: 'preview',
  jobId: 'metadata-sync-1',
  startedBy: 'avery@example.com',
  startedAt: ago(1),
  finishedAt: ago(1),
  snapshotAt: ago(3),
  totals: { tables: 42, adoptions: 2, conflicts: 1, writes: 4, failed: 0 },
  tables: [
    {
      database: 'sales',
      table: 'orders',
      adoptions: [
        {
          key: 'order_id',
          field: 'description',
          value: 'The order, unique across every channel.',
          from: 'glue',
        },
        {
          key: '#table',
          field: 'description',
          value: 'One row per order, as it stood when it shipped.',
          from: ASSET,
          replaced: 'Orders.',
        },
      ],
      conflicts: [
        {
          key: 'placed_at',
          field: 'description',
          kept: 'When the order was placed.',
          sides: {
            glue: 'When the order was placed, in UTC.',
            [ASSET]: 'When the customer placed the order, in the store’s time zone.',
          },
        },
      ],
      sides: [
        {
          side: 'glue',
          kind: 'glue',
          label: 'sales.orders',
          outcome: 'would-write',
          writes: [
            {
              key: '#table',
              field: 'description',
              value: 'One row per order, as it stood when it shipped.',
              was: 'Orders.',
            },
          ],
        },
        {
          side: ASSET,
          kind: 'smus',
          label: 'Orders',
          outcome: 'would-write',
          writes: [
            {
              key: 'order_id',
              field: 'description',
              value: 'The order, unique across every channel.',
            },
          ],
        },
      ],
    },
    {
      database: 'sales',
      table: 'customers',
      adoptions: [],
      conflicts: [],
      sides: [
        {
          side: 'glue',
          kind: 'glue',
          label: 'sales.customers',
          outcome: 'would-write',
          writes: [
            { key: 'customer_id', field: 'description', value: 'The customer.' },
            { key: 'region', field: 'description', value: 'Where the customer is billed.' },
          ],
        },
        {
          side: 'smus:asset-customers',
          kind: 'smus',
          label: 'Customers',
          outcome: 'unchanged',
          writes: [],
        },
      ],
    },
  ],
};

const RUN_CLEAN: MetadataSyncReport = {
  version: 1,
  mode: 'run',
  jobId: 'metadata-sync-2',
  startedBy: 'schedule',
  startedAt: ago(5),
  finishedAt: ago(5),
  snapshotAt: ago(6),
  totals: { tables: 42, adoptions: 0, conflicts: 0, writes: 0, failed: 0 },
  tables: [],
};

const LF_REFUSAL =
  'AccessDeniedException: Insufficient Lake Formation permission(s): Required Describe on';
const IAM_REFUSAL =
  'User: arn:aws:sts::123456789012:assumed-role/Portal-LambdaExecutionRole/worker is not authorized to perform: datazone:CreateAssetRevision on resource: arn:aws:datazone:us-east-1:123456789012:domain/dzd_example because no identity-based policy allows the datazone:CreateAssetRevision action';
const REFUSED_TABLES = [
  'customers',
  'orders',
  'order_lines',
  'returns',
  'shipments',
  'stores',
  'suppliers',
  'targets',
];

/** A deployment whose grants are not finished: every table refused, for two reasons. */
const RUN_REFUSED: MetadataSyncReport = {
  ...RUN_CLEAN,
  finishedAt: ago(0.2),
  totals: { tables: 42, adoptions: 0, conflicts: 0, writes: 0, failed: REFUSED_TABLES.length * 2 },
  tables: REFUSED_TABLES.map((table) => ({
    database: 'sales',
    table,
    adoptions: [],
    conflicts: [],
    sides: [
      {
        side: 'glue',
        kind: 'glue' as const,
        label: `sales.${table}`,
        outcome: 'failed' as const,
        writes: [],
        error: `${LF_REFUSAL} ${table}`,
      },
      {
        side: `smus:asset-${table}`,
        kind: 'smus' as const,
        label: table,
        outcome: 'failed' as const,
        writes: [],
        error: IAM_REFUSAL,
      },
    ],
  })),
};

const ON = { enabled: true, turnedOn: true, smusConfigured: true };

export const STATUS_OFF: MetadataSyncStatus = {
  enabled: false,
  turnedOn: false,
  smusConfigured: true,
  lastPreview: null,
  lastRun: null,
};
export const STATUS_NEEDS_SMUS: MetadataSyncStatus = {
  enabled: false,
  turnedOn: true,
  smusConfigured: false,
  lastPreview: null,
  lastRun: null,
};
export const STATUS_NEVER_RUN: MetadataSyncStatus = { ...ON, lastPreview: null, lastRun: null };
export const STATUS_PREVIEWED: MetadataSyncStatus = {
  ...ON,
  lastPreview: PREVIEW,
  lastRun: RUN_CLEAN,
};
export const STATUS_IN_STEP: MetadataSyncStatus = { ...ON, lastPreview: null, lastRun: RUN_CLEAN };
export const STATUS_REFUSED: MetadataSyncStatus = {
  ...ON,
  lastPreview: null,
  lastRun: RUN_REFUSED,
};

/** Status plus a pass that completes after a few polls and a conflict that can be settled. */
export function metadataSyncRoutes(
  status: MetadataSyncStatus,
  options: { statusError?: string } = {}
): MockRoute[] {
  let polls = 0;
  let current = status;
  let mode: 'preview' | 'run' = 'preview';
  const jobId = 'metadata-sync-story';
  const job = (): JobMetadata => {
    polls += 1;
    const done = polls >= POLLS_TO_FINISH;
    if (done) {
      const finished = { ...PREVIEW, mode, finishedAt: new Date().toISOString() };
      current =
        mode === 'preview'
          ? { ...current, lastPreview: finished }
          : { ...current, lastRun: finished };
    }
    return {
      jobId,
      jobType: 'metadata-sync',
      status: done ? 'completed' : 'processing',
      progress: Math.min(polls * PROGRESS_STEP, 100),
      message: done
        ? 'Preview: 42 tables, 2 edits adopted, 4 fields to write, 1 conflict'
        : `Read ${polls * 14} of 42 tables`,
      startTime: new Date().toISOString(),
    };
  };
  return [
    {
      method: 'get',
      url: '/metadata-sync/status',
      respond: () =>
        options.statusError
          ? { status: 500, body: { success: false, error: options.statusError } }
          : { body: { success: true, data: current } },
    },
    {
      method: 'post',
      url: '/metadata-sync/sync',
      respond: (request) => {
        polls = 0;
        mode = request.data?.includes('"run"') ? 'run' : 'preview';
        return {
          status: 202,
          body: { success: true, data: { jobId, status: 'queued', message: 'Queued' } },
        };
      },
    },
    {
      method: 'post',
      url: '/metadata-sync/resolve',
      respond: () => ({
        body: {
          success: true,
          data: { database: 'sales', table: 'orders', key: 'placed_at', field: 'description' },
        },
      }),
    },
    {
      method: 'get',
      url: `/jobs/${jobId}`,
      respond: () => ({ body: { success: true, data: job() } }),
    },
  ];
}
