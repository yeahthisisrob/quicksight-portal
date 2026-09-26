/**
 * Canned playbooks, rows and flows for the stories: the catalog as the API
 * lists it, and a consolidation of Athena data sources at every stage.
 */

import type { JobMetadata } from '@/shared/api/modules/jobs';
import type {
  Playbook,
  PlaybookItem,
  PlaybookItemCounts,
  PlaybookItemsPage,
} from '@/shared/api/modules/playbooks';

import type { MockRoute } from '../../../../../../.storybook/mocks/api';
import type { PlaybookFlow, PlaybookStage } from '../../../model/usePlaybook';

const COMMON_GATES: Playbook['gates'] = [
  {
    key: 'editedWithinDays',
    label: 'Skip anything edited in the last … days',
    kind: 'number',
    help: 'Recent edits are usually work in progress; leave them to whoever is making them.',
  },
  { key: 'onlyTagged', label: 'Only assets tagged', kind: 'text', help: 'key or key=value' },
  {
    key: 'canary',
    label: 'Only the first … assets (a canary)',
    kind: 'number',
    help: 'The rest are listed as skipped; run again without it once the canary looks right.',
  },
];

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'repair-errors',
    title: 'Repair everything',
    description:
      'Every dashboard and analysis with definition errors, fixed the way the Editor would: missing columns renamed or dropped, missing parameters declared. Anything that needs a choice is left for you in the Editor.',
    category: 'repair',
    params: [],
    gates: [
      { ...COMMON_GATES[0]!, default: 7 },
      COMMON_GATES[1]!,
      {
        key: 'errorTypes',
        label: 'Only these QuickSight error types',
        kind: 'text',
        help: 'Comma-separated, e.g. COLUMN_NOT_FOUND, PARAMETER_NOT_FOUND',
      },
      COMMON_GATES[2]!,
    ],
    writes: ['dashboard', 'analysis'],
    deletes: false,
  },
  {
    id: 'consolidate-athena',
    title: 'Consolidate Athena data sources',
    description:
      'Point every dataset that reads through another Athena data source at the one you choose. Columns and downstream dashboards are untouched; tables whose data source runs in a different workgroup are left for you to review.',
    category: 'data',
    params: [
      {
        key: 'target',
        label: 'Athena data source to keep',
        kind: 'datasource',
        dataSourceType: 'ATHENA',
        required: true,
        help: 'Every other Athena data source’s datasets move onto this one.',
      },
    ],
    gates: COMMON_GATES,
    writes: ['dataset'],
    deletes: false,
  },
  {
    id: 'demo-cleanup',
    title: 'Remove the sample assets',
    description:
      'The sample analyses, datasets and data sources QuickSight creates in a new account. Each is archived before it is deleted (and can be restored); anything something else still reads is left for review.',
    category: 'cleanup',
    params: [],
    gates: COMMON_GATES,
    writes: ['analysis', 'dataset', 'datasource'],
    deletes: true,
  },
];

const AT = '2026-09-26T14:00:00Z';

function row(id: string, name: string, extra: Partial<PlaybookItem> = {}): PlaybookItem {
  return {
    key: `000#dataset#${id}`,
    stage: 0,
    assetType: 'dataset',
    assetId: id,
    name,
    status: 'planned',
    verdict: 'change',
    summary: '1 table to move onto athena-main',
    changes: [`${name}: athena-sales → athena-main`],
    updatedAt: AT,
    ...extra,
  };
}

const PREVIEW_ROWS: PlaybookItem[] = [
  row('orders', 'orders_gold'),
  row('customers', 'customers', {
    summary: '2 tables to move onto athena-main',
    changes: ['customers: athena-crm → athena-main', 'regions: athena-crm → athena-main'],
  }),
  row('pipeline', 'sales_pipeline'),
  row('targets', 'targets_2026'),
  row('events', 'web_events', {
    verdict: 'review',
    summary:
      'Reads through workgroup analysts; athena-main runs in primary. Results location, engine and limits may differ.',
  }),
  row('scratch', 'scratch_margin', {
    status: 'skipped',
    verdict: 'skip',
    summary: 'Edited 2 days ago; likely work in progress',
    changes: undefined,
  }),
  row('legacy', 'legacy_orders', {
    status: 'skipped',
    verdict: 'skip',
    summary: 'Opted out (tagged portal:playbook-skip)',
    changes: undefined,
  }),
  row('broken', 'uploaded_sheet', {
    status: 'failed',
    verdict: undefined,
    summary: undefined,
    changes: undefined,
    error:
      'Could not load this dataset from QuickSight. Uploaded (flat file) datasets have no queryable specification.',
  }),
];

function countRows(rows: PlaybookItem[]): PlaybookItemCounts {
  const counts: PlaybookItemCounts = {
    total: rows.length,
    pending: 0,
    planned: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    review: 0,
    verdicts: { change: 0, review: 0, skip: 0 },
  };
  for (const r of rows) {
    counts[r.status]++;
    if (r.verdict) counts.verdicts[r.verdict]++;
  }
  return counts;
}

function page(jobId: string, mode: 'preview' | 'run', rows: PlaybookItem[]): PlaybookItemsPage {
  return {
    jobId,
    playbookId: 'consolidate-athena',
    mode,
    status: 'completed',
    items: rows,
    counts: countRows(rows),
  };
}

const PREVIEW_PAGE = page('playbook-preview-1', 'preview', PREVIEW_ROWS);

const RUN_ROWS: PlaybookItem[] = [
  row('orders', 'orders_gold', { status: 'done', summary: 'Moved 1 table' }),
  row('customers', 'customers', {
    status: 'done',
    summary: 'Moved 2 tables',
    changes: ['customers: athena-crm → athena-main', 'regions: athena-crm → athena-main'],
  }),
  row('pipeline', 'sales_pipeline', {
    status: 'failed',
    error: 'Column opportunity_stage was not found in sales.pipeline_v2',
    attempts: 1,
  }),
  row('targets', 'targets_2026', {
    status: 'skipped',
    verdict: 'skip',
    summary: 'Nothing to do now: Already reads only through athena-main',
  }),
];

const RUNNING_ROWS: PlaybookItem[] = [
  RUN_ROWS[0]!,
  RUN_ROWS[1]!,
  row('pipeline', 'sales_pipeline', { status: 'pending', summary: undefined }),
  row('targets', 'targets_2026', { status: 'pending', summary: undefined }),
];

function job(jobId: string, extra: Partial<JobMetadata>): JobMetadata {
  return {
    jobId,
    jobType: 'playbook',
    status: 'completed',
    startTime: AT,
    ...extra,
  } as JobMetadata;
}

const noop = () => {};

/** A consolidation at the given stage, with canned jobs and rows. */
export function fakeFlow(
  stage: PlaybookStage,
  overrides: Partial<PlaybookFlow> = {}
): PlaybookFlow {
  const playbook = PLAYBOOKS[1]!;
  const previewDone = stage !== 'setup' && stage !== 'previewing';
  const running = stage === 'running';
  const ran = stage === 'ran';
  return {
    playbook,
    stage,
    params: { target: 'athena-main' },
    setParam: noop,
    gates: {},
    setGate: noop,
    ready: true,
    preview: {
      job:
        stage === 'setup'
          ? null
          : job('playbook-preview-1', {
              status: previewDone ? 'completed' : 'processing',
              message: previewDone ? '4 to change, 1 for review, 2 skipped' : 'Checked 23 of 64',
              progress: previewDone ? 100 : 36,
            }),
      page: previewDone ? PREVIEW_PAGE : null,
    },
    run: {
      job:
        running || ran
          ? job('playbook-run-1', {
              status: running ? 'processing' : 'completed',
              message: running ? 'Worked through 2 of 4' : '2 changed, 1 skipped, 1 failed',
              progress: running ? 50 : 100,
            })
          : null,
      page: running
        ? page('playbook-run-1', 'run', RUNNING_ROWS)
        : ran
          ? page('playbook-run-1', 'run', RUN_ROWS)
          : null,
    },
    selected: new Set(PREVIEW_ROWS.filter((r) => r.verdict === 'change').map((r) => r.key)),
    setSelected: noop,
    startPreview: noop,
    startRun: noop,
    retryFailed: noop,
    stop: noop,
    edit: noop,
    close: noop,
    busy: false,
    error: null,
    ...overrides,
  };
}

/** The API as the catalog and the data source picker read it. */
export function playbookRoutes(): MockRoute[] {
  return [
    {
      method: 'get',
      url: '/playbooks',
      respond: () => ({ body: { success: true, data: PLAYBOOKS } }),
    },
    {
      method: 'get',
      url: /\/assets\/datasources\/paginated/,
      respond: () => ({
        body: {
          success: true,
          data: {
            datasources: [
              { id: 'athena-main', name: 'Athena (primary)', type: 'ATHENA' },
              { id: 'athena-crm', name: 'Athena CRM', type: 'ATHENA' },
              { id: 'warehouse', name: 'Warehouse', type: 'REDSHIFT' },
            ],
            pagination: { page: 1, pageSize: 100, totalItems: 3, totalPages: 1 },
          },
        },
      }),
    },
  ];
}
