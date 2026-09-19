import { describe, expect, it } from 'vitest';

import { SearchIndex } from '../lib/searchIndex';
import { queryTokens, tokenize } from '../lib/tokenize';
import type { SearchDocument } from '../types';

const doc = (
  over: Partial<SearchDocument> & Pick<SearchDocument, 'type' | 'id' | 'name'>
): SearchDocument => ({
  columns: [],
  calculatedFields: [],
  tags: [],
  context: [],
  summary: `${over.type}: ${over.name}`,
  path: '/',
  ...over,
});

const DOCS: SearchDocument[] = [
  doc({
    type: 'dataset',
    id: 'ds-gold',
    name: 'orders_gold',
    columns: ['order_id', 'revenue', 'region', 'orderDate'],
    views: 0,
  }),
  doc({
    type: 'dataset',
    id: 'ds-silver',
    name: 'orders_silver',
    columns: ['order_id', 'revenue'],
    description: 'raw orders before dedupe',
  }),
  doc({
    type: 'dashboard',
    id: 'd-sales',
    name: 'Sales overview',
    columns: ['revenue', 'region'],
    tags: ['team sales'],
    views: 1800,
  }),
  doc({ type: 'dashboard', id: 'd-ops', name: 'Ops daily', columns: ['tickets'], views: 3900 }),
  doc({
    type: 'calculated-field',
    id: 'cf-margin',
    name: 'margin_pct',
    calculatedFields: ['margin_pct'],
    expression: "ifelse({status} = 'closed', ({revenue} - {cost}) / {revenue}, 0)",
    context: ['Sales overview'],
  }),
  doc({
    type: 'visual',
    id: 'v-1',
    name: 'Revenue by region',
    columns: ['revenue', 'region'],
    context: ['bar chart', 'Overview', 'Sales overview'],
  }),
  doc({
    type: 'smus-listing',
    id: 'lst-1',
    name: 'dim_customer',
    columns: ['customer_id'],
    tags: ['PII'],
    context: ['published_prod.dim_customer'],
  }),
];

describe('tokenize', () => {
  it('splits snake, camel and spaces, lowercases, and drops stop words', () => {
    expect(tokenize('orderDate order_date "Order Date"')).toEqual([
      'order',
      'date',
      'order',
      'date',
      'order',
      'date',
    ]);
    expect(queryTokens('the Sales dashboard for revenue')).toEqual([
      'sales',
      'dashboard',
      'revenue',
    ]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('SearchIndex', () => {
  const index = new SearchIndex(DOCS, '2026-09-19T00:00:00.000Z');

  it('ranks a name match above a column match, and says why', () => {
    const hits = index.search('orders gold');
    expect(hits[0]).toMatchObject({ id: 'ds-gold', type: 'dataset' });
    expect(hits[0]!.why).toEqual(expect.arrayContaining(['name: orders', 'name: gold']));
    expect(hits.map((h) => h.id)).toContain('ds-silver');
  });

  it('finds business rules inside calculated field expressions', () => {
    const hits = index.search('closed status margin');
    expect(hits[0]).toMatchObject({ id: 'cf-margin', type: 'calculated-field' });
    expect(hits[0]!.why).toEqual(
      expect.arrayContaining(['expression: closed', 'expression: status'])
    );
  });

  it('finds visuals by chart type, sheet and fields', () => {
    const hits = index.search('bar chart revenue region');
    expect(hits[0]).toMatchObject({ id: 'v-1', type: 'visual' });
  });

  it('prefers documents that match every query word over popular partial matches', () => {
    const hits = index.search('revenue region');
    const ids = hits.map((h) => h.id);
    // Both match fully; the dashboard with 1800 views outranks the dataset with none.
    expect(ids.indexOf('d-sales')).toBeLessThan(ids.indexOf('ds-gold'));
    // Ops daily matches nothing here despite 3900 views.
    expect(ids).not.toContain('d-ops');
  });

  it('matches prefixes of at least three characters, at a discount', () => {
    const [top] = index.search('cust');
    expect(top).toMatchObject({ id: 'lst-1' });
  });

  it('boosts an exact whole-name match', () => {
    const hits = index.search('Sales overview');
    expect(hits[0]).toMatchObject({ id: 'd-sales' });
    expect(hits[0]!.why[0]).toBe('exact name');
  });

  it('filters by type and honours the limit', () => {
    expect(index.search('revenue', { types: ['dataset'] }).every((h) => h.type === 'dataset')).toBe(
      true
    );
    expect(index.search('revenue', { limit: 1 })).toHaveLength(1);
    expect(index.search('   ')).toEqual([]);
    expect(index.counts).toMatchObject({
      dataset: 2,
      dashboard: 2,
      'calculated-field': 1,
      visual: 1,
      'smus-listing': 1,
    });
  });
});
