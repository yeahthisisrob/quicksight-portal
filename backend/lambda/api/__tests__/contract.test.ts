/**
 * The API answers the way its contract says, through the real handler
 * stack: routing, handlers, services and the mappers that build each row,
 * over a catalog holding one asset of every type. Only the edges are stubbed
 * (auth, stored settings, S3, lineage and activity). Every response is
 * checked strictly against the served contract, undeclared fields
 * included, so a row shape that drifts (a data source's engine sent as
 * `sourceType` while the contract promised `type`) fails here, not in a
 * browser.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import served from '../../../../shared/generated/openapi.json';
import { responseErrors } from '../../shared/api/contract';
import type { AssetType } from '../../shared/models/asset.model';
import { catalogEntry, useTestCatalog } from '../../shared/utils/testUtils/testCatalog';
import { apiHandler } from '../apiHandler';

const tags = [{ key: 'env', value: 'prod' }];
const entry = (type: AssetType, id: string, assetName: string, metadata = {}) =>
  catalogEntry(type, id, { assetName, tags, metadata });

const SEED = [
  entry('dashboard', 'd1', 'Sales', {
    sheetCount: 1,
    visualCount: 2,
    datasetCount: 1,
    lineageData: { datasetIds: ['ds1'] },
    themeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/brand',
  }),
  entry('analysis', 'a1', 'Sales draft', { lineageData: { datasetIds: ['ds1'] } }),
  entry('dataset', 'ds1', 'orders', {
    importMode: 'SPICE',
    sourceType: 'ATHENA',
    fields: [{ fieldName: 'revenue', dataType: 'DECIMAL' }],
    calculatedFields: [],
    lineageData: { datasourceIds: ['src1'] },
  }),
  entry('datasource', 'src1', 'Athena primary', {
    sourceType: 'ATHENA',
    connectionMode: 'DIRECT_QUERY',
  }),
  entry('folder', 'f1', 'Finance', { memberCount: 0 }),
  entry('user', 'pat', 'pat', { role: 'READER', email: 'pat@example.com', active: true }),
  entry('group', 'finance', 'finance', { memberCount: 1 }),
  entry('theme', 'brand', 'Brand', {
    baseThemeId: 'CLASSIC',
    versionNumber: 3,
    dataColors: ['#1F77B4', '#FF7F0E'],
    uiColors: { PrimaryBackground: '#FFFFFF', Accent: '#1F77B4' },
    fontFamily: 'Inter',
  }),
];

const { seed } = useTestCatalog();
beforeEach(() => seed(SEED));

vi.mock('../../shared/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/auth')>();
  const user = { userId: 'u1', email: 'admin@example.com', groups: [], kind: 'user' };
  return {
    ...actual,
    getAuthContext: vi.fn(async () => user),
    requireAuth: vi.fn(async () => user),
  };
});
vi.mock('../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../shared/services/settings/SettingsStore', () => ({
  settingsStore: { load: vi.fn(async () => undefined), get: vi.fn(() => undefined) },
}));
vi.mock('../../shared/services/cache/CacheService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/services/cache/CacheService')>()),
  cacheService: {
    get: vi.fn(async () => null),
    getWithEtag: vi.fn(async () => ({ value: null })),
    getActivityCache: vi.fn(async () => null),
    getActivityPersistence: vi.fn(async () => null),
    getActivityCacheWithEtag: vi.fn(async () => ({ value: null })),
    getActivityPersistenceWithEtag: vi.fn(async () => ({ value: null })),
    getIngestions: vi.fn(async () => null),
  },
}));
vi.mock('../../shared/services/lineage/LineageService', () => ({
  LineageService: vi.fn(function LineageService() {
    return {
      getLineageMapForAssets: vi.fn(async () => new Map()),
      getAllLineage: vi.fn(async () => []),
    };
  }),
}));
vi.mock('../../shared/services/activity/activityReader', () => ({
  activityReader: () => ({
    getAssetActivityCounts: vi.fn(async () => new Map()),
    getDatasetActivityCounts: vi.fn(async () => new Map()),
    getUserActivityCounts: vi.fn(async () => new Map()),
    getAssetActivity: vi.fn(async () => null),
  }),
}));

function get(path: string, query: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: query,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: null,
    isBase64Encoded: false,
    requestContext: { requestId: 'contract-test' } as never,
    resource: '',
  };
}

describe('the API answers as its contract says', () => {
  const lists = [
    'dashboards',
    'analyses',
    'datasets',
    'datasources',
    'folders',
    'users',
    'groups',
    'themes',
  ];

  it.each(lists)('GET /api/assets/%s/paginated', async (type) => {
    const path = `/api/assets/${type}/paginated`;
    const response = await apiHandler(get(path, { page: '1', pageSize: '50' }));
    const body = JSON.parse(response.body);
    expect(response.statusCode, JSON.stringify(body)).toBe(200);
    expect(body.data[type].length, `${type} should list the seeded asset`).toBeGreaterThan(0);
    expect(responseErrors('GET', path, response.statusCode, body)).toEqual([]);
  });
});

/** A value for each path parameter, from the seeded catalog where there is one. */
const PATH_VALUES: Record<string, string> = {
  assetType: 'dashboard',
  assetId: 'd1',
  dataSetId: 'ds1',
  datasetId: 'ds1',
  userName: 'pat',
  groupName: 'finance',
  folderId: 'f1',
  id: 'd1',
  jobId: 'job-1',
  playbookId: 'consolidate-athena',
  entityId: 'dashboard:d1',
  key: 'cf_x',
  listingId: 'l1',
};

function sampleQuery(op: any): Record<string, string> {
  const query: Record<string, string> = {};
  const params = [...(op.parameters ?? [])].map((p: any) =>
    typeof p.$ref === 'string' ? (served as any).components.parameters[p.$ref.split('/').pop()] : p
  );
  for (const p of params) {
    if (p?.in !== 'query' || !p.required) continue;
    query[p.name] = String(p.schema?.enum?.[0] ?? (p.schema?.type === 'integer' ? 1 : 'd1'));
  }
  return query;
}

describe('every GET answers in a shape its contract documents', () => {
  const previous = { ...process.env };
  beforeAll(() => {
    // AWS is out of reach here: an endpoint that needs it fails fast, and its error must fit too.
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:9';
    process.env.AWS_MAX_ATTEMPTS = '1';
  });
  afterAll(() => {
    process.env.AWS_ENDPOINT_URL = previous.AWS_ENDPOINT_URL;
    process.env.AWS_MAX_ATTEMPTS = previous.AWS_MAX_ATTEMPTS;
  });

  const operations = Object.entries((served as any).paths as Record<string, any>)
    .filter(([, item]) => item.get)
    .map(([template, item]) => ({
      template,
      path: template.replace(/\{([^}]+)\}/g, (_, name: string) => PATH_VALUES[name] ?? 'x'),
      op: item.get,
    }));

  it.each(operations)('GET $template', async ({ path, op }) => {
    const response = await apiHandler(get(path, sampleQuery(op)));
    if (response.headers?.['Content-Type'] !== 'application/json') return; // a guide, a spec
    const body = JSON.parse(response.body || 'null');
    expect(responseErrors('GET', path, response.statusCode, body)).toEqual([]);
  });
});

describe('themes', () => {
  it('lists each custom theme with its colors and what uses it', async () => {
    const response = await apiHandler(
      get('/api/assets/themes/paginated', { page: '1', pageSize: '50' })
    );
    const [theme] = JSON.parse(response.body).data.themes;
    expect(theme).toMatchObject({
      id: 'brand',
      baseThemeId: 'CLASSIC',
      dataColors: ['#1F77B4', '#FF7F0E'],
      uiColors: { Accent: '#1F77B4' },
      usedBy: { dashboards: 1, analyses: 0 },
    });
  });
});
