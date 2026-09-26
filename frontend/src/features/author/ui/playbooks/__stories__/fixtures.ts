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
  PlaybookSpecInput,
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
  {
    id: 'move-to-governed-athena',
    title: 'Move busy dashboards onto governed Athena datasets',
    description:
      'Dashboards viewed at least the number of times you set that still read Redshift: each dataset is matched to a SMUS-governed Athena dataset holding every column they use, the dashboard is rebound onto it, and the old dataset and its data source are tagged deprecated.',
    category: 'data',
    composable: true,
    infers: true,
    params: [
      {
        key: 'minViews',
        label: 'At least this many views',
        kind: 'number',
        required: true,
        default: 50,
      },
      {
        key: 'fromEngine',
        label: 'Move off this engine',
        kind: 'engine',
        required: true,
        default: 'REDSHIFT',
      },
      {
        key: 'toEngine',
        label: 'Onto datasets of this engine',
        kind: 'engine',
        required: true,
        default: 'ATHENA',
      },
      {
        key: 'infer',
        label: 'Let a model map columns whose names differ',
        kind: 'boolean',
        default: true,
      },
    ],
    gates: COMMON_GATES,
    writes: ['dashboard', 'analysis', 'dataset', 'datasource'],
    deletes: false,
  },
  {
    id: 'team-into-shared-folder',
    title: "Put a team's assets in its shared folder",
    description:
      "Every dashboard, analysis, dataset and data source shared with a team goes into the team's shared folder, so the folder carries their access from now on.",
    category: 'cleanup',
    composable: true,
    params: [
      {
        key: 'team',
        label: 'Shared with (group or user name contains)',
        kind: 'text',
        required: true,
      },
      { key: 'folder', label: "The team's shared folder", kind: 'folder', required: true },
    ],
    gates: COMMON_GATES,
    writes: ['folder'],
    deletes: false,
  },
  {
    id: 'custom-1b2c',
    title: 'Tag finance dashboards for the Q4 review',
    description: 'Every dashboard shared with finance, tagged review=q4.',
    category: 'custom',
    custom: true,
    composable: true,
    params: [],
    gates: COMMON_GATES,
    writes: ['dashboard'],
    deletes: false,
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

/** The shipped Redshift → governed Athena spec, as the builder edits it. */
export const EXAMPLE_SPEC: PlaybookSpecInput = {
  name: 'Move busy dashboards onto governed Athena datasets (copy)',
  description:
    'Dashboards viewed at least minViews times that still read Redshift, moved onto SMUS-governed Athena datasets; the old datasets and data sources tagged deprecated.',
  inputs: [
    {
      key: 'minViews',
      label: 'At least this many views',
      kind: 'number',
      default: 50,
      required: true,
    },
    {
      key: 'fromEngine',
      label: 'Move off this engine',
      kind: 'engine',
      default: 'REDSHIFT',
      required: true,
    },
    {
      key: 'toEngine',
      label: 'Onto datasets of this engine',
      kind: 'engine',
      default: 'ATHENA',
      required: true,
    },
    {
      key: 'infer',
      label: 'Let a model map columns whose names differ',
      kind: 'boolean',
      default: true,
    },
  ],
  select: {
    assetTypes: ['dashboard'],
    where: [
      { kind: 'views', min: '{{minViews}}' },
      { kind: 'readsEngine', engine: '{{fromEngine}}' },
    ],
  },
  steps: [
    {
      kind: 'matchDataset',
      engine: '{{toEngine}}',
      governed: true,
      infer: '{{infer}}',
      minConfidence: 0.8,
    },
    { kind: 'rebind' },
    {
      kind: 'tag',
      target: 'replaced-datasets',
      key: 'portal:deprecated',
      value: 'moved to governed Athena',
    },
    {
      kind: 'tag',
      target: 'replaced-datasources',
      key: 'portal:deprecated',
      value: 'moved to governed Athena',
    },
  ],
  gates: { editedWithinDays: 7 },
};

/** Reports someone saved. */
const SAVED_REPORTS = [
  {
    jobId: 'playbook-run-1',
    playbookId: 'consolidate-athena',
    playbookTitle: 'Consolidate Athena data sources',
    mode: 'run',
    status: 'completed',
    message: '2 changed, 1 skipped, 1 failed',
    startedBy: 'rob@example.com',
    startTime: AT,
    counts: countRows(RUN_ROWS),
    savedAt: '2026-09-26T15:00:00Z',
    savedBy: 'rob@example.com',
  },
];

/** The API as the catalog and the data source picker read it. */
export function playbookRoutes(): MockRoute[] {
  return [
    {
      method: 'get',
      url: '/playbooks/reports',
      respond: () => ({ body: { success: true, data: SAVED_REPORTS } }),
    },
    {
      method: 'get',
      url: '/playbooks',
      respond: () => ({ body: { success: true, data: PLAYBOOKS } }),
    },
    {
      method: 'get',
      url: /\/assets\/folders\/paginated/,
      respond: () => ({
        body: {
          success: true,
          data: {
            folders: [
              { id: 'sales-shared', name: 'Sales (shared)', path: '/Teams/Sales (shared)' },
              { id: 'finance-shared', name: 'Finance (shared)', path: '/Teams/Finance (shared)' },
            ],
            pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
          },
        },
      }),
    },
    {
      method: 'get',
      url: '/assistant/models',
      respond: () => ({
        body: {
          success: true,
          data: {
            models: [
              {
                key: 'sonnet-4-6',
                label: 'Claude Sonnet 4.6',
                provider: 'bedrock',
                available: true,
                bestFor: 'Judgement that needs care',
                typicalCost: { authoring: 0.054, chat: 0.1125, review: 0.024 },
              },
              {
                key: 'haiku-4-5',
                label: 'Claude Haiku 4.5',
                provider: 'bedrock',
                available: true,
                bestFor: 'Quick, cheap calls',
                typicalCost: { authoring: 0.018, chat: 0.0375, review: 0.008 },
              },
            ],
            defaults: { chat: 'haiku-4-5', authoring: 'sonnet-4-6' },
            note: '',
          },
        },
      }),
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
