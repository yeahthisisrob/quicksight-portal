import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetType } from '../../../models/asset.model';
import { catalogEntry, useTestCatalog } from '../../../utils/testUtils/testCatalog';
import { catalog } from '../../catalog/catalogStore';
import { matchesGlob, SmusService } from '../SmusService';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/settings/SettingsStore', () => ({
  settingsStore: { getString: () => '', getList: () => [], stored: () => ({}) },
}));

const LISTINGS = [
  {
    listingId: 'l-cust',
    assetId: 'a-cust',
    name: 'dim_customer',
    assetType: 'amazon.datazone.GlueTableAssetType',
    owningProjectId: 'proj-published-prod',
    table: { database: 'published_prod', name: 'dim_customer' },
    columns: [
      { name: 'customer_id', type: 'bigint' },
      { name: 'signed_up', type: 'timestamp' },
    ],
  },
  {
    listingId: 'l-raw',
    assetId: 'a-raw',
    name: 'raw_events',
    assetType: 'amazon.datazone.GlueTableAssetType',
    owningProjectId: 'proj-medallion-prod',
    table: { database: 'bronze-prod', name: 'raw_events' },
    columns: [{ name: 'payload', type: 'string' }],
  },
  {
    listingId: 'l-noform',
    assetId: 'a-noform',
    name: 'mystery',
    assetType: 'x',
    owningProjectId: 'proj-published-prod',
  },
];

const config = (over: Partial<any> = {}) => ({
  enabled: true,
  domainId: 'dzd_1',
  region: 'us-east-1',
  portalUrl: 'https://smus.example',
  projectIds: [],
  databasePatterns: [],
  ...over,
});

useTestCatalog();

/** Make these rows the catalog's whole list of one type. */
const catalogOf =
  (assetType: AssetType) => (rows: Array<{ assetId: string } & Record<string, any>>) =>
    catalog.replaceType(
      assetType,
      rows.map(({ assetId, ...rest }) => catalogEntry(assetType, assetId, rest))
    );
const datasets = catalogOf('dataset');
const dataSources = catalogOf('datasource');

const EXPORTED_AT = '2026-09-18T12:00:00.000Z';

/** The snapshot the export job would have written for dzd_1. */
const snapshot = (over: Partial<any> = {}) => ({
  version: 1,
  domainId: 'dzd_1',
  region: 'us-east-1',
  exportedAt: EXPORTED_AT,
  projectFilter: [],
  projects: [
    { id: 'proj-published-prod', name: 'published_prod' },
    { id: 'proj-medallion-prod', name: 'medallion_prod' },
  ],
  listings: LISTINGS,
  diagnostics: {
    domainId: 'dzd_1',
    region: 'us-east-1',
    fromListProjects: 2,
    listings: LISTINGS.length,
    publishers: 2,
  },
  ...over,
});

describe('SmusService assets', () => {
  const cache = { get: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    SmusService.invalidateLinkMap();
    cache.get.mockResolvedValue(snapshot());
    await datasets([
      {
        assetId: 'ds-cust',
        assetName: 'Customers (gold)',
        metadata: {
          lineageData: {
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
    ]);
    await dataSources([
      {
        assetId: 'athena-1',
        assetName: 'Athena',
        arn: 'arn:aws:quicksight:us-east-1:1:datasource/athena-1',
      },
    ]);
  });

  const service = (over: Partial<any> = {}) => new SmusService(cache as any, config(over));

  it('lists every published asset with its project, table and the datasets already reading it', async () => {
    const result = await service().listAssets();

    expect(result.configured).toBe(true);
    expect(result.assets.map((a) => a.name)).toEqual(['dim_customer', 'mystery', 'raw_events']);
    expect(result.assets[0]).toMatchObject({
      projectName: 'published_prod',
      table: { database: 'published_prod', name: 'dim_customer' },
      url: 'https://smus.example/catalog/assets/l-cust',
      datasets: [{ id: 'ds-cust', name: 'Customers (gold)', matchType: 'source-table' }],
    });
    // One sweep shared by the listing and the link map
    expect(result.exportedAt).toBe(EXPORTED_AT);
    expect(cache.get).toHaveBeenCalledWith('cache/smus/snapshot.json');
  });

  it('limits to the selected projects and database patterns, and searches', async () => {
    const byProject = await service({ projectIds: ['proj-published-prod'] }).listAssets();
    expect(byProject.assets.map((a) => a.listingId)).toEqual(['l-cust', 'l-noform']);
    expect(byProject.projectFilter).toEqual(['proj-published-prod']);

    // A pattern needs table identity, so a listing without forms drops out
    const byPattern = await service({ databasePatterns: ['published_*'] }).listAssets();
    expect(byPattern.assets.map((a) => a.listingId)).toEqual(['l-cust']);

    const searched = await service().listAssets('bronze-prod.raw');
    expect(searched.assets.map((a) => a.listingId)).toEqual(['l-raw']);
  });

  it('reports not configured without a domain', async () => {
    const result = await new SmusService(cache as any, config({ enabled: false })).listAssets();
    expect(result).toEqual({ configured: false, projectFilter: [], assets: [], exportedAt: null });
  });

  it('is empty with exportedAt null until an export has run', async () => {
    cache.get.mockResolvedValue(null);
    const result = await service({ projectIds: ['proj-published-prod'] }).listAssets();
    expect(result).toEqual({
      configured: true,
      projectFilter: ['proj-published-prod'],
      assets: [],
      exportedAt: null,
    });
  });

  it('ignores a snapshot taken for another domain', async () => {
    cache.get.mockResolvedValue(snapshot({ domainId: 'dzd_other' }));
    const result = await service().listAssets();
    expect(result.assets).toEqual([]);
    expect(result.exportedAt).toBeNull();
  });

  it('finds a listing by id, and the listing a dataset would link to by what it reads', async () => {
    expect((await service().listing('l-cust'))?.table).toEqual({
      database: 'published_prod',
      name: 'dim_customer',
    });
    expect(await service().listing('nope')).toBeUndefined();
    expect(await service({ enabled: false, domainId: '' }).listing('l-cust')).toBeUndefined();

    // Nothing is created in SMUS: the link is derived from the table read,
    // as a table or inside a query, exactly as the link map derives it.
    const byTable = await service().listingFor({
      name: 'Customers v2',
      physicalTables: [{ type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' }],
    });
    expect(byTable).toMatchObject({ linked: true, listingId: 'l-cust', matchType: 'source-table' });
    const bySql = await service().listingFor({
      name: 'Signups by month',
      physicalTables: [
        { type: 'CUSTOM_SQL', name: 'q', sqlTables: ['published_prod.dim_customer'] },
      ],
    });
    expect(bySql).toMatchObject({ linked: true, listingId: 'l-cust', matchType: 'custom-sql' });
    const none = await service().listingFor({
      name: 'Something else',
      physicalTables: [{ type: 'CUSTOM_SQL', name: 'q', sqlTables: ['staging.events'] }],
    });
    expect(none).toEqual({ datasetId: '', linked: false });
    // Out of the selected projects: no link, as the catalog would show none.
    const scoped = await service({ projectIds: ['proj-published-prod'] }).listingFor({
      name: 'raw',
      physicalTables: [{ type: 'RELATIONAL', schema: 'bronze-prod', name: 'raw_events' }],
    });
    expect(scoped.linked).toBe(false);
  });

  it('ties a dataset to a listing that was renamed away from its table', async () => {
    // The publisher called it something readable; the dataset only knows the
    // Glue table it reads, which is how most datasets arrive.
    cache.get.mockResolvedValue(
      snapshot({
        listings: [
          {
            listingId: 'l-renamed',
            assetId: 'a-renamed',
            name: 'Customers (gold)',
            assetType: 'amazon.datazone.GlueTableAssetType',
            owningProjectId: 'proj-published-prod',
            table: { database: 'published_prod', name: 'dim_customer' },
            columns: [{ name: 'customer_id', type: 'bigint' }],
          },
        ],
      })
    );

    // Nothing in the dataset's name hints at the listing, so only the table
    // it reads can tie the two together.
    await datasets([
      {
        assetId: 'ds-cust',
        assetName: 'Prod customers v2',
        metadata: {
          lineageData: {
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
    ]);

    const result = await service().listAssets();
    expect(result.assets[0]?.datasets).toEqual([
      { id: 'ds-cust', name: 'Prod customers v2', matchType: 'source-table' },
    ]);
  });

  it('carries the listing up a chain of datasets built on the governed one', async () => {
    // The shape people actually have: a raw dataset over the Glue table, a
    // curated dataset joined off it, and the calculated fields sitting on the
    // curated one. Only the raw dataset has table identity.
    await datasets([
      {
        assetId: 'ds-mart',
        assetName: 'Customer mart',
        metadata: { lineageData: { datasetIds: ['ds-curated'] } },
      },
      {
        assetId: 'ds-curated',
        assetName: 'Customers curated',
        metadata: { lineageData: { datasetIds: ['ds-cust'] } },
      },
      {
        assetId: 'ds-cust',
        assetName: 'Prod customers v2',
        metadata: {
          lineageData: {
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
    ]);

    const result = await service().listAssets();
    expect(result.assets.find((a) => a.listingId === 'l-cust')?.datasets).toEqual([
      { id: 'ds-mart', name: 'Customer mart', matchType: 'lineage', via: expect.anything() },
      {
        id: 'ds-curated',
        name: 'Customers curated',
        matchType: 'lineage',
        via: { datasetId: 'ds-cust', name: 'Prod customers v2' },
      },
      { id: 'ds-cust', name: 'Prod customers v2', matchType: 'source-table' },
    ]);
  });

  it('ties a custom-SQL dataset to the governed table it reads, not the staging one beside it', async () => {
    // The shape that emptied the catalog: the query joins a staging table and
    // a published one. The staging table has a listing too, but the database
    // patterns put it outside the catalog, so it must not claim the dataset
    // before the governed table is even tried.
    cache.get.mockResolvedValue(
      snapshot({
        listings: [
          {
            listingId: 'l-staging',
            assetId: 'a-staging',
            name: 'stg_customer',
            assetType: 'amazon.datazone.GlueTableAssetType',
            owningProjectId: 'proj-published-prod',
            table: { database: 'staging_prod', name: 'stg_customer' },
          },
          ...LISTINGS,
        ],
      })
    );
    await datasets([
      {
        assetId: 'ds-sql',
        assetName: 'Customer mart',
        metadata: {
          lineageData: {
            physicalTables: [
              {
                type: 'CUSTOM_SQL',
                sqlTables: ['staging_prod.stg_customer', 'published_prod.dim_customer'],
              },
            ],
          },
        },
      },
    ]);

    const scoped = await service({ databasePatterns: ['published_*'] }).listAssets();
    expect(scoped.assets.find((a) => a.listingId === 'l-cust')?.datasets).toEqual([
      { id: 'ds-sql', name: 'Customer mart', matchType: 'custom-sql' },
    ]);

    // And the link the Datasets page reads agrees with the catalog, rather
    // than calling the dataset governed by a listing the catalog will not show.
    SmusService.invalidateLinkMap();
    const [link] = await service({ databasePatterns: ['published_*'] }).getDatasetLinks(['ds-sql']);
    expect(link).toMatchObject({ linked: true, listingId: 'l-cust' });
  });

  it('does not tie a dataset to a listing outside the selected projects', async () => {
    await datasets([
      {
        assetId: 'ds-raw',
        assetName: 'Raw events',
        metadata: {
          lineageData: {
            physicalTables: [{ type: 'RELATIONAL', schema: 'bronze-prod', name: 'raw_events' }],
          },
        },
      },
    ]);

    const [link] = await service({ projectIds: ['proj-published-prod'] }).getDatasetLinks([
      'ds-raw',
    ]);
    expect(link).toEqual({ datasetId: 'ds-raw', linked: false });
  });

  it('inherits from the nearest matched ancestor and survives a cycle', async () => {
    await datasets([
      // Two parents, one of them linked, and a cycle back to the child.
      {
        assetId: 'ds-join',
        assetName: 'Joined',
        metadata: { lineageData: { datasetIds: ['ds-loop', 'ds-raw'] } },
      },
      {
        assetId: 'ds-loop',
        assetName: 'Loop',
        metadata: { lineageData: { datasetIds: ['ds-join'] } },
      },
      {
        assetId: 'ds-raw',
        assetName: 'raw_events',
        metadata: { lineageData: { datasetIds: [] } },
      },
    ]);

    const result = await service().listAssets();
    const raw = result.assets.find((a) => a.listingId === 'l-raw');
    expect(raw?.datasets).toEqual([
      {
        id: 'ds-join',
        name: 'Joined',
        matchType: 'lineage',
        via: { datasetId: 'ds-raw', name: 'raw_events' },
      },
      {
        id: 'ds-loop',
        name: 'Loop',
        matchType: 'lineage',
        // Reached at depth two through the cycle, and still tied back to the
        // dataset that matched directly rather than to its inherited child.
        via: { datasetId: 'ds-raw', name: 'raw_events' },
      },
      { id: 'ds-raw', name: 'raw_events', matchType: 'name' },
    ]);
  });
});

describe('helpers', () => {
  it('matches globs case-insensitively', () => {
    expect(matchesGlob('published_prod', 'published_*')).toBe(true);
    expect(matchesGlob('PUBLISHED_DEV', 'published_*')).toBe(true);
    expect(matchesGlob('gold-prod', 'published_*')).toBe(false);
    expect(matchesGlob('gold-prod', 'gold-????')).toBe(true);
  });
});

describe('SmusService projects', () => {
  const cache = { get: vi.fn() };

  it('serves the projects and diagnostics the export captured, with its timestamp', async () => {
    cache.get.mockResolvedValue(snapshot());
    const service = new SmusService(cache as any, config());

    expect(await service.listProjects()).toEqual(snapshot().projects);
    const discovery = await service.projectDiscovery();
    expect(discovery.exportedAt).toBe(EXPORTED_AT);
    expect(discovery.diagnostics).toMatchObject({ fromListProjects: 2, publishers: 2 });

    const status = await service.getStatus();
    expect(status).toMatchObject({
      configured: true,
      domainId: 'dzd_1',
      region: 'us-east-1',
      snapshot: { exportedAt: EXPORTED_AT, projects: 2, listings: LISTINGS.length, publishers: 2 },
    });
  });

  it('has no projects or snapshot before the first export, but still explains itself', async () => {
    cache.get.mockResolvedValue(null);
    const service = new SmusService(cache as any, config());

    expect(await service.listProjects()).toEqual([]);
    const discovery = await service.projectDiscovery();
    expect(discovery.projects).toEqual([]);
    expect(discovery.exportedAt).toBeNull();
    expect(discovery.diagnostics).toMatchObject({ domainId: 'dzd_1', fromListProjects: 0 });
    expect(await service.getStatus()).not.toHaveProperty('snapshot');
  });

  it('unions a live ListProjects with the snapshot so unselected projects can be chosen', async () => {
    cache.get.mockResolvedValue(snapshot());
    const live = {
      listProjects: vi
        .fn()
        .mockResolvedValue([
          { id: 'proj-new', name: 'brand_new', description: 'not exported yet' },
        ]),
    };
    const service = new SmusService(cache as any, config());

    const discovery = await service.projectDiscovery(live as any);

    expect(discovery.projects.map((p) => p.id)).toEqual([
      'proj-new',
      'proj-medallion-prod',
      'proj-published-prod',
    ]);
    expect(discovery.diagnostics).toMatchObject({ fromListProjects: 1, publishers: 2 });
    expect(discovery.exportedAt).toBe(EXPORTED_AT);
  });

  it('keeps the snapshot projects and names the error when the live call fails', async () => {
    cache.get.mockResolvedValue(snapshot());
    const live = { listProjects: vi.fn().mockRejectedValue(new Error('AccessDenied')) };
    const service = new SmusService(cache as any, config());

    const discovery = await service.projectDiscovery(live as any);

    expect(discovery.projects).toHaveLength(2);
    expect(discovery.diagnostics?.listProjectsError).toBe('Error: AccessDenied');
  });
});
