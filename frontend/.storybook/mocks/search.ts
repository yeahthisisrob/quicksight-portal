/**
 * A realistic search result for stories, and a route that answers /search
 * the way the server does: filtered by the query words and by `types`, so
 * typing in a story narrows the list.
 */
import type { MockRoute } from './api';

export interface StoryHit {
  type: string;
  id: string;
  name: string;
  score: number;
  why: string[];
  summary: string;
  path: string;
  description?: string;
  views?: number;
  updatedAt?: string;
  expression?: string;
  parent?: { type: string; id: string; name: string };
  definedIn?: Array<{ type: string; id: string; name: string }>;
}

export const SEARCH_HITS: StoryHit[] = [
  {
    type: 'dashboard',
    id: 'sales-overview',
    name: 'Sales overview',
    score: 31.2,
    why: ['exact name', 'name: sales', 'column: revenue'],
    summary:
      'dashboard: Sales overview (1 sheet, 5 visuals, 2 datasets, 1834 views, in Sales / EMEA)',
    path: '/author?type=dashboard&id=sales-overview&name=Sales%20overview',
    views: 1834,
    updatedAt: '2026-09-10T08:00:00.000Z',
  },
  {
    type: 'analysis',
    id: 'sales-draft',
    name: 'Sales draft (Q4)',
    score: 14.1,
    why: ['name: sales', 'column: revenue'],
    summary: 'analysis: Sales draft (Q4) (2 sheets, 8 visuals, 2 datasets)',
    path: '/author?type=analysis&id=sales-draft&name=Sales%20draft%20(Q4)',
    views: 40,
  },
  {
    type: 'dataset',
    id: 'sales-gold',
    name: 'sales_gold',
    score: 22.5,
    why: ['name: sales', 'column: revenue', 'column: region'],
    summary: 'dataset: sales_gold (SPICE, 24 columns, 3 calculated fields, athena)',
    path: '/datasets?search=sales_gold',
  },
  {
    type: 'dataset',
    id: 'sales-silver',
    name: 'sales_silver',
    score: 12.0,
    why: ['name: sales', 'column: revenue'],
    summary: 'dataset: sales_silver (direct query, 19 columns, athena)',
    path: '/datasets?search=sales_silver',
    description: 'Deduplicated orders before the gold rollup',
  },
  {
    type: 'smus-listing',
    id: 'lst-sales-gold',
    name: 'sales_gold',
    score: 18.0,
    why: ['name: sales', 'column: revenue', 'context: published_prod'],
    summary: 'SMUS listing: sales_gold (published_prod.sales_gold, 24 columns)',
    path: '/data-catalog?asset=lst-sales-gold',
  },
  {
    type: 'calculated-field',
    id: 'margin_pct::ifelse',
    name: 'margin_pct',
    score: 17.4,
    why: ['expression: revenue', 'expression: closed', 'calculated field: margin'],
    summary:
      "calculated field margin_pct = ifelse({status} = 'closed', ({revenue} - {cost}) / {revenue}, 0) (in 3 assets: Sales overview, Sales draft (Q4), Finance close)",
    path: '/data-catalog?q=margin_pct',
    expression: "ifelse({status} = 'closed', ({revenue} - {cost}) / {revenue}, 0)",
    parent: { type: 'dashboard', id: 'sales-overview', name: 'Sales overview' },
    definedIn: [
      { type: 'dashboard', id: 'sales-overview', name: 'Sales overview' },
      { type: 'analysis', id: 'sales-draft', name: 'Sales draft (Q4)' },
      { type: 'dashboard', id: 'finance-close', name: 'Finance close' },
    ],
  },
  {
    type: 'visual',
    id: 'dashboard:sales-overview:bar-region',
    name: 'Revenue by region',
    score: 15.9,
    why: ['name: revenue', 'name: region', 'context: bar chart'],
    summary:
      'visual: Revenue by region, a bar chart on Overview of dashboard Sales overview, using revenue, region, channel',
    path: '/author?type=dashboard&id=sales-overview&name=Sales%20overview',
    parent: { type: 'dashboard', id: 'sales-overview', name: 'Sales overview' },
  },
  {
    type: 'template',
    id: 'tpl-net-margin',
    name: 'net_margin',
    score: 9.3,
    why: ['expression: revenue', 'tag: finance'],
    summary: 'template: net_margin = {revenue} - {cost}',
    path: '/data-catalog?templates=1',
    expression: '{revenue} - {cost}',
  },
];

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'by', 'with']);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** A hit matches when every query word appears somewhere in its text. */
function matches(hit: StoryHit, query: string): boolean {
  const haystack = [hit.name, hit.summary, hit.expression ?? '', hit.why.join(' ')]
    .join(' ')
    .toLowerCase();
  return words(query).every((w) => haystack.includes(w));
}

const INDEXED = {
  dashboard: 42,
  analysis: 17,
  dataset: 63,
  datasource: 4,
  folder: 12,
  'smus-listing': 28,
  'calculated-field': 210,
  visual: 388,
  template: 6,
};

/** GET /search, answered from `hits` (every story hit by default). */
export function searchRoute(hits: StoryHit[] = SEARCH_HITS): MockRoute {
  return {
    method: 'get',
    url: /\/search$/,
    respond: (config) => {
      const params = (config.params ?? {}) as { q?: string; types?: string; limit?: number };
      const q = params.q ?? '';
      const types = (params.types ?? '').split(',').filter(Boolean);
      const found = hits
        .filter((h) => (types.length === 0 || types.includes(h.type)) && matches(h, q))
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit ?? hits.length);
      return {
        body: {
          success: true,
          data: { q, hits: found, indexed: INDEXED, indexedAt: '2026-09-19T06:30:00.000Z' },
        },
      };
    },
  };
}

/** GET /search that never answers, for a loading state. */
export const SEARCH_PENDING: MockRoute = {
  method: 'get',
  url: /\/search$/,
  respond: () => new Promise(() => {}),
};

/** GET /search that fails. */
export const SEARCH_FAILING: MockRoute = {
  method: 'get',
  url: /\/search$/,
  respond: () => ({ status: 500, body: { success: false, error: 'The index could not be read' } }),
};
