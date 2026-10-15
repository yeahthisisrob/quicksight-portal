/**
 * Synthetic versions of one analysis for stories: first seen by the export,
 * two portal edits by a person, and a change made in the console.
 */

import type { AssetVersion, VersionDiff } from '@/shared/api/modules/history';

import type { MockRoute } from '../../../../../.storybook/mocks/api';

const BASE = {
  assetType: 'analysis' as const,
  assetId: 'an-sales',
  name: 'Sales review',
  size: 18_400,
};

export const VERSIONS: AssetVersion[] = [
  {
    ...BASE,
    versionId: '20261015T071500000Z-a1b2c3',
    at: '2026-10-15T07:15:00.000Z',
    hash: 'h4',
    source: 'export',
    by: 'Outside the portal',
    summary: '1 visual moved, 1 filter group added',
    changes: ['Visual "Revenue by region" (bar chart) moved', '1 filter group added'],
    previousVersionId: '20261014T160200000Z-d4e5f6',
  },
  {
    ...BASE,
    versionId: '20261014T160200000Z-d4e5f6',
    at: '2026-10-14T16:02:00.000Z',
    hash: 'h3',
    source: 'rollback',
    by: 'pat@example.com',
    action: 'authoring.rollback',
    summary: '1 visual added, 1 calculated field changed',
    changes: ['Rolled back to the version of 2026-10-12 09:30 (First version seen)'],
    previousVersionId: '20261013T113000000Z-9a8b7c',
  },
  {
    ...BASE,
    versionId: '20261013T113000000Z-9a8b7c',
    at: '2026-10-13T11:30:00.000Z',
    hash: 'h2',
    source: 'portal',
    by: 'pat@example.com',
    action: 'authoring.update',
    summary: '1 visual removed, 1 calculated field changed',
    changes: [
      'Removed the "Units" line chart from Overview',
      'Changed margin to subtract tax: {rev}-{cost}-{tax}',
    ],
    previousVersionId: '20261012T093000000Z-0f1e2d',
  },
  {
    ...BASE,
    versionId: '20261012T093000000Z-0f1e2d',
    at: '2026-10-12T09:30:00.000Z',
    hash: 'h1',
    source: 'export',
    by: 'Outside the portal',
    summary: 'First version seen',
    changes: ['First version the portal kept'],
  },
];

const DEFINITION_BEFORE = {
  Name: 'Sales review',
  Definition: {
    CalculatedFields: [{ DataSetIdentifier: 'orders', Name: 'margin', Expression: '{rev}-{cost}' }],
    Sheets: [
      { SheetId: 's1', Name: 'Overview', Visuals: [{ BarChartVisual: { VisualId: 'v1' } }] },
    ],
  },
};
const DEFINITION_AFTER = {
  Name: 'Sales review',
  Definition: {
    CalculatedFields: [
      { DataSetIdentifier: 'orders', Name: 'margin', Expression: '{rev}-{cost}-{tax}' },
    ],
    FilterGroups: [{ FilterGroupId: 'fg1' }],
    Sheets: [
      { SheetId: 's1', Name: 'Overview', Visuals: [{ BarChartVisual: { VisualId: 'v1' } }] },
    ],
  },
};

function diffFor(versionId: string, against?: string): VersionDiff {
  const index = VERSIONS.findIndex((v) => v.versionId === versionId);
  const to = VERSIONS[index];
  if (!to) throw new Error(`no version ${versionId}`);
  if (against === 'live') {
    return {
      from: to,
      live: true,
      summary: 'No change',
      changes: [],
      entries: [],
      truncated: false,
      fromDefinition: DEFINITION_AFTER,
      toDefinition: DEFINITION_AFTER,
    };
  }
  const from = against ? VERSIONS.find((v) => v.versionId === against) : VERSIONS[index + 1];
  return {
    ...(from ? { from } : {}),
    to,
    live: false,
    summary: to.summary,
    changes: to.changes,
    entries: [
      {
        path: 'Definition.CalculatedFields.0.Expression',
        kind: 'changed',
        before: '{rev}-{cost}',
        after: '{rev}-{cost}-{tax}',
      },
      { path: 'Definition.FilterGroups', kind: 'added', after: [{ FilterGroupId: 'fg1' }] },
    ],
    truncated: false,
    fromDefinition: from ? DEFINITION_BEFORE : null,
    toDefinition: DEFINITION_AFTER,
  };
}

/** The history API for one analysis, and a rollback that completes at once. */
export function versionHistoryRoutes(versions: AssetVersion[] = VERSIONS): MockRoute[] {
  return [
    {
      method: 'get',
      url: /\/history\/analysis\/an-sales\/[^/]+\/diff/,
      respond: (request) => {
        const url = new URL(request.url, 'http://x');
        const parts = url.pathname.split('/');
        const versionId = parts[parts.length - 2] ?? '';
        return {
          status: 200,
          body: {
            success: true,
            data: diffFor(versionId, url.searchParams.get('against') ?? undefined),
          },
        };
      },
    },
    {
      method: 'get',
      url: /\/history\/analysis\/an-sales$/,
      respond: () => ({ status: 200, body: { success: true, data: { versions } } }),
    },
    {
      method: 'get',
      url: /\/history$/,
      respond: () => ({ status: 200, body: { success: true, data: { versions } } }),
    },
    {
      method: 'post',
      url: /\/authoring\/analysis\/an-sales\/versions\/[^/]+\/restore/,
      respond: () => ({
        status: 202,
        body: {
          success: true,
          data: { jobId: 'job-rollback', status: 'queued', message: 'queued' },
        },
      }),
    },
    {
      method: 'get',
      url: /\/jobs\/job-rollback\/result/,
      respond: () => ({
        status: 200,
        body: {
          success: true,
          data: {
            assetType: 'analysis',
            assetId: 'an-sales',
            name: 'Sales review',
            versionId: versions[2]?.versionId ?? 'v',
            versionAt: versions[2]?.at ?? '',
            warnings: [],
          },
        },
      }),
    },
    {
      method: 'get',
      url: /\/jobs\/job-rollback$/,
      respond: () => ({
        status: 200,
        body: {
          success: true,
          data: {
            jobId: 'job-rollback',
            jobType: 'planner',
            status: 'completed',
            startTime: '2026-10-15T07:20:00.000Z',
            message: 'Rolled back',
          },
        },
      }),
    },
  ];
}
