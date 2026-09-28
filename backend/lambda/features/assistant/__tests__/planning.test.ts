import { describe, expect, it, vi } from 'vitest';

import { contextGet, contextRelated, contextSearch, datasetColumns } from '../lib/contextTools';
import {
  builtFilters,
  judgeFields,
  parsePlan,
  resolveLineage,
  unbuiltClaims,
  verdictsMessage,
} from '../lib/planning';
import { describeStep } from '../lib/steps';

const ok = (data: unknown) => ({ status: 200, body: JSON.stringify({ success: true, data }) });

const plan = parsePlan({
  datasets: [{ name: 'Orders', id: 'ds-1', status: 'existing' }],
  calculatedFields: [
    { name: 'Revenue', expression: '{qty} * {price}', status: 'new', dataset: 'ds-1' },
    { name: 'Unit cost', expression: '{cost} / {qty}', status: 'new', dataset: 'ds-1' },
    { name: 'Running total', expression: 'runningSum(sum({revenue}), [{day} ASC])', status: 'new' },
    { name: 'Kept', expression: '{a} + {b}', status: 'existing' },
  ],
  asset: { kind: 'analysis', name: 'Orders', status: 'new' },
  brief: 'An orders analysis with revenue, unit cost and a running total.',
  target: {
    create: {
      assetType: 'analysis',
      name: 'Orders',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
    },
  },
});

const columns = async () => [
  { name: 'revenue', type: 'DECIMAL', description: 'Net revenue in USD' },
  { name: 'qty', type: 'INTEGER' },
];

describe('field placement follows the organisation guidance', () => {
  it('uses an existing column, keeps aggregates in the analysis, and places the rest by strategy', async () => {
    if (typeof plan === 'string') throw new Error(plan);
    const byStrategy = async (strategy: 'source' | 'dataset' | 'none') =>
      (await judgeFields(plan.lineage, strategy, columns)).map((f) => [f.name, f.verdict]);

    expect(await byStrategy('none')).toEqual([
      ['Revenue', 'use-column'],
      ['Unit cost', 'row-level'],
      ['Running total', 'analysis'],
    ]);
    expect((await byStrategy('source'))[1]).toEqual(['Unit cost', 'push-down']);
    expect((await byStrategy('dataset'))[1]).toEqual(['Unit cost', 'dataset']);

    const judged = await judgeFields(plan.lineage, 'dataset', columns);
    expect(judged[0]!.note).toContain('revenue (DECIMAL, "Net revenue in USD")');
    expect(verdictsMessage(judged)).toContain('move them into the QuickSight dataset');
  });

  it('still judges fields when the dataset columns cannot be read', async () => {
    if (typeof plan === 'string') throw new Error(plan);
    const judged = await judgeFields(plan.lineage, 'none', async () => {
      throw new Error('denied');
    });
    expect(judged.map((f) => f.verdict)).toEqual(['row-level', 'row-level', 'analysis']);
  });
});

describe('context tools', () => {
  it('renders search hits, an entity and its relations as short lines', async () => {
    const dispatch = vi.fn(async ({ path }: { method: string; path: string }) => {
      if (path.startsWith('/api/context/search')) {
        return ok({
          hits: [
            { entityId: 'listing:l1', summary: 'SMUS listing: orders', why: ['name: orders'] },
          ],
        });
      }
      if (path === '/api/context/entities/listing%3Al1') {
        return ok({
          entity: {
            id: 'listing:l1',
            summary: 'SMUS listing: orders',
            attributes: { projectId: 'p1' },
          },
          relations: [
            {
              relation: 'reads-listing',
              direction: 'in',
              count: 1,
              examples: [{ entityId: 'dataset:ds-1', name: 'Orders', note: 'by table' }],
            },
          ],
        });
      }
      return ok({
        hits: [
          {
            entityId: 'dataset:ds-1',
            summary: 'dataset: Orders',
            attributes: { importMode: 'SPICE' },
            via: [{ relation: 'reads-listing', direction: 'in' }],
          },
        ],
      });
    });

    expect((await contextSearch(dispatch, { query: 'orders', types: ['listing'] })).text).toBe(
      '- listing:l1: SMUS listing: orders [matched name: orders]'
    );
    expect(dispatch.mock.calls[0]?.[0].path).toBe(
      '/api/context/search?q=orders&types=listing&limit=15'
    );
    expect((await contextGet(dispatch, 'listing:l1')).text).toBe(
      'listing:l1: SMUS listing: orders {projectId: p1}\n  reads-listing (from): 1 - Orders (dataset:ds-1) by table'
    );
    expect(
      (
        await contextRelated(dispatch, {
          entityId: 'listing:l1',
          relations: ['reads-listing'],
          direction: 'in',
        })
      ).text
    ).toBe('- dataset:ds-1: dataset: Orders {importMode: SPICE} (via <-reads-listing)');
  });

  it('joins a dataset column list to the SMUS descriptions of the columns it exposes', async () => {
    const dispatch = async ({ path }: { method: string; path: string }) =>
      path.includes('/columns')
        ? ok({
            columns: [
              { name: 'Revenue', type: 'DECIMAL' },
              { name: 'region', type: 'STRING' },
            ],
          })
        : ok({
            hits: [
              {
                name: 'revenue',
                description: 'Net revenue in USD',
                attributes: { type: 'decimal(18,2)' },
              },
            ],
          });
    expect(await datasetColumns(dispatch, 'ds-1')).toEqual([
      { name: 'Revenue', type: 'DECIMAL', description: 'Net revenue in USD' },
      { name: 'region', type: 'STRING' },
    ]);
  });

  it('names context calls in the progress line', () => {
    expect(describeStep('GET', '/api/context/search?q=orders')).toBe('Searching');
    expect(describeStep('GET', '/api/context/entities/dataset%3Ads-1/related')).toBe(
      'Following the lineage'
    );
  });
});

describe('the body check', () => {
  it('matches concrete paths to operations and reports what a body lacks', async () => {
    const { bodyErrors, bodyFields, matchOperation } = await import('../../../shared/api/contract');
    const spec = (await import('../../../../../shared/generated/openapi.json')).default as never;
    expect(matchOperation(spec, 'POST', '/api/authoring/new')).toBe('/api/authoring/new');
    expect(matchOperation(spec, 'POST', '/api/authoring/dashboard/d1/rebind')).toBe(
      '/api/authoring/{assetType}/{assetId}/rebind'
    );
    expect(matchOperation(spec, 'POST', '/api/nope')).toBeUndefined();
    expect(
      bodyErrors(spec, 'POST', '/api/authoring/new', {
        assetType: 'report',
        name: 'x',
        datasets: [],
      })
    ).toEqual(['assetType: must be one of dashboard, analysis', 'datasets: needs at least 1 item']);
    expect(
      bodyErrors(spec, 'POST', '/api/authoring/new', {
        assetType: 'analysis',
        name: 'x',
        datasets: [{ identifier: 'o', dataSetId: 'ds', extra: true }],
      })
    ).toEqual([]);
    expect(
      bodyFields(spec, 'POST', '/api/authoring/{assetType}/{assetId}/rebind/preview')
    ).toContain('rebinds');
  });
});

describe('what a plan shows is what its preview built', () => {
  const definition = {
    FilterGroups: [
      { Filters: [{ CategoryFilter: { FilterId: 'f-region', Column: { ColumnName: 'Region' } } }] },
      {
        Filters: [{ NumericRangeFilter: { FilterId: 'f-rev', Column: { ColumnName: 'revenue' } } }],
      },
      { Filters: [{ TimeRangeFilter: { FilterId: 'f-orphan', Column: { ColumnName: 'day' } } }] },
    ],
    Sheets: [
      {
        FilterControls: [
          {
            Dropdown: {
              FilterControlId: 'c1',
              SourceFilterId: 'f-region',
              Title: 'Region',
              Type: 'SINGLE_SELECT',
            },
          },
          { Slider: { FilterControlId: 'c2', SourceFilterId: 'f-rev', Title: 'Revenue' } },
        ],
        SheetControlLayouts: [
          {
            Configuration: {
              GridLayout: { Elements: [{ ElementId: 'c1', ElementType: 'FILTER_CONTROL' }] },
            },
          },
        ],
      },
    ],
  };

  it('reads each control, its column, its kind and where it sits; a filter with no control is not one', () => {
    expect(builtFilters(definition)).toEqual([
      { column: 'Region', title: 'Region', control: 'singleSelect', placement: 'controlBar' },
      { column: 'revenue', title: 'Revenue', control: 'slider', placement: 'canvas' },
    ]);
    expect(builtFilters(undefined)).toEqual([]);
  });

  it('names every filter the build asks for that the preview has no control for', () => {
    const build = {
      create: {
        assetType: 'analysis',
        name: 'x',
        datasets: [],
        filters: [
          { identifier: 'o', column: 'region', control: 'dropdown' },
          { identifier: 'o', column: 'day', control: 'dateRange' },
        ],
      },
    } as any;
    expect(unbuiltClaims(build, definition)).toEqual([
      'The build asks for a filter on day with a dateRange control, but the previewed definition has no control on day.',
    ]);
  });
});

describe('the plan names what the portal knows', () => {
  const graph: Record<string, { name: string; project?: string }> = {
    'listing:l-123': { name: 'orders_gold', project: 'Sales analytics' },
    'dataset:ds-1': { name: 'Orders (gold)' },
  };
  const lookup = async (id: string) => graph[id] ?? null;

  it('shows a SMUS listing by its name and project, and an existing dataset by its name', async () => {
    const resolved = await resolveLineage(
      {
        sources: [
          { listing: 'l-123' },
          { listing: 'listing:l-123' },
          { listing: 'unknown-listing' },
        ],
        datasets: [
          { name: 'ds-1', id: 'ds-1', status: 'existing' },
          { name: 'New one', status: 'new' },
        ],
      },
      lookup
    );
    expect(resolved.sources).toEqual([
      { listing: 'orders_gold', project: 'Sales analytics' },
      { listing: 'orders_gold', project: 'Sales analytics' },
      { listing: 'unknown-listing' },
    ]);
    expect(resolved.datasets.map((d) => d.name)).toEqual(['Orders (gold)', 'New one']);
  });
});
