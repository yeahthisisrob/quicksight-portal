/**
 * API stubs for the catalog stories: the list (projects, search, term), one
 * asset, dataset tags, tagged datasets, and the template library. Overrides
 * come first so a story can replace any of them.
 */
import type { MockRoute } from '../../../../../.storybook/mocks/api';
import { requestBody } from '../../../../../.storybook/mocks/api';
import { searchRoute } from '../../../../../.storybook/mocks/search';
import { settingsSnapshotRoute } from '../../../author/ui/__stories__/fixtures';
import { fieldCatalogRoutes } from './fieldCatalog';
import { ASSETS_BY_ID, catalogFor, TEMPLATES } from './fixtures';

const TAGS = [
  { key: 'team', value: 'finance', count: 2 },
  { key: 'tier', value: 'gold', count: 3 },
];

/** The organisation's filter bars: a default and one for finance. */
export const FILTER_BARS = [
  {
    id: 'bar-standard',
    name: 'Standard',
    description: 'Every sales analysis: the period first, then where and what.',
    isDefault: true,
    controls: [
      { column: 'order_date', title: 'Period', span: 3 },
      { column: 'region', title: 'Region', span: 2 },
      { column: 'product_line', title: 'Product line', span: 2 },
    ],
    createdBy: 'rob@example.com',
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-25T10:00:00Z',
  },
  {
    id: 'bar-finance',
    name: 'Finance close',
    isDefault: false,
    controls: [
      { column: 'fiscal_period', title: 'Fiscal period', span: 3 },
      { column: 'ledger', span: 2, values: ['GL-100', 'GL-200'] },
    ],
    createdAt: '2026-09-21T10:00:00Z',
    updatedAt: '2026-09-21T10:00:00Z',
  },
];

/** Two saved visuals: a trend and a breakdown. */
export const VISUAL_TEMPLATES = [
  {
    id: 'vt-trend',
    name: 'Revenue trend',
    description: 'The monthly line every sales analysis opens with.',
    visual: {
      type: 'LineChart',
      category: 'order_date',
      granularity: 'MONTH',
      values: [{ column: 'net_revenue', aggregation: 'SUM' }],
    },
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
  },
  {
    id: 'vt-region',
    name: 'Orders by region',
    visual: {
      type: 'BarChart',
      category: 'region',
      values: [{ column: 'order_id', aggregation: 'DISTINCT_COUNT' }],
      color: 'channel',
    },
    createdAt: '2026-09-21T10:00:00Z',
    updatedAt: '2026-09-21T10:00:00Z',
  },
];

/** Filter bars and visual templates (in memory, so saving and deleting show), and the tagged layout standards. */
function templateRoutes(): MockRoute[] {
  let bars = [...FILTER_BARS];
  let visualTemplates = [...VISUAL_TEMPLATES];
  return [
    {
      method: 'get',
      url: /\/data-catalog\/templates\/visuals$/,
      respond: () => ({ body: { success: true, data: { templates: visualTemplates } } }),
    },
    {
      method: 'post',
      url: /\/data-catalog\/templates\/visuals$/,
      respond: (config) => {
        const input = requestBody<any>(config);
        const template = {
          ...input,
          id: `vt-${visualTemplates.length + 1}`,
          createdAt: '2026-09-26T10:00:00Z',
          updatedAt: '2026-09-26T10:00:00Z',
        };
        visualTemplates = [...visualTemplates, template];
        return { body: { success: true, data: template } };
      },
    },
    {
      method: 'put',
      url: /\/data-catalog\/templates\/visuals\/[^/]+$/,
      respond: (config) => {
        const id = decodeURIComponent(String(config.url).split('/').pop() ?? '');
        const input = requestBody<any>(config);
        visualTemplates = visualTemplates.map((t) => (t.id === id ? { ...t, ...input } : t));
        return { body: { success: true, data: visualTemplates.find((t) => t.id === id) } };
      },
    },
    {
      method: 'delete',
      url: /\/data-catalog\/templates\/visuals\/[^/]+$/,
      respond: (config) => {
        const id = decodeURIComponent(String(config.url).split('/').pop() ?? '');
        visualTemplates = visualTemplates.filter((t) => t.id !== id);
        return { body: { success: true } };
      },
    },
    {
      method: 'get',
      url: /\/data-catalog\/templates\/filter-bars$/,
      respond: () => ({ body: { success: true, data: { templates: bars } } }),
    },
    {
      method: 'post',
      url: /\/data-catalog\/templates\/filter-bars$/,
      respond: (config) => {
        const input = requestBody<any>(config);
        const bar = {
          ...input,
          id: `bar-${bars.length + 1}`,
          isDefault: Boolean(input.isDefault),
          createdAt: '2026-09-26T10:00:00Z',
          updatedAt: '2026-09-26T10:00:00Z',
        };
        bars = [...(bar.isDefault ? bars.map((b) => ({ ...b, isDefault: false })) : bars), bar];
        return { body: { success: true, data: bar } };
      },
    },
    {
      method: 'put',
      url: /\/data-catalog\/templates\/filter-bars\/[^/]+$/,
      respond: (config) => {
        const id = decodeURIComponent(String(config.url).split('/').pop() ?? '');
        const input = requestBody<any>(config);
        bars = bars.map((b) =>
          b.id === id
            ? { ...b, ...input, isDefault: Boolean(input.isDefault) }
            : input.isDefault
              ? { ...b, isDefault: false }
              : b
        );
        return { body: { success: true, data: bars.find((b) => b.id === id) } };
      },
    },
    {
      method: 'delete',
      url: /\/data-catalog\/templates\/filter-bars\/[^/]+$/,
      respond: (config) => {
        const id = decodeURIComponent(String(config.url).split('/').pop() ?? '');
        bars = bars.filter((b) => b.id !== id);
        return { body: { success: true } };
      },
    },
    {
      method: 'get',
      url: '/assets/dashboards/paginated',
      respond: () => ({
        body: {
          success: true,
          data: {
            dashboards: [{ dashboardId: 'std-sales', name: 'Sales standard' }],
            pagination: { totalItems: 1 },
          },
        },
      }),
    },
    {
      method: 'get',
      url: '/assets/analyses/paginated',
      respond: () => ({
        body: { success: true, data: { analyses: [], pagination: { totalItems: 0 } } },
      }),
    },
  ];
}

export function catalogRoutes(overrides: MockRoute[] = []): MockRoute[] {
  let templates = [...TEMPLATES];
  return [
    ...templateRoutes(),
    ...overrides,
    ...fieldCatalogRoutes(),
    searchRoute(),
    settingsSnapshotRoute(
      'dzd_example',
      catalogFor().projects.map((p) => p.id)
    ),
    {
      method: 'get',
      url: '/settings/smus/projects',
      respond: () => ({
        body: {
          success: true,
          data: {
            configured: true,
            projects: catalogFor().projects.map((p) => ({ id: p.id, name: p.name })),
          },
        },
      }),
    },
    {
      method: 'get',
      url: /\/data-catalog\/templates\/calculated-fields$/,
      respond: () => ({ body: { success: true, data: { templates } } }),
    },
    {
      method: 'post',
      url: /\/data-catalog\/templates\/calculated-fields$/,
      respond: (config) => {
        const now = new Date().toISOString();
        const template = {
          id: `tpl-${templates.length + 1}`,
          ...requestBody(config),
          createdAt: now,
          updatedAt: now,
        };
        templates = [...templates, template];
        return { body: { success: true, data: template } };
      },
    },
    {
      method: 'put',
      url: /\/data-catalog\/templates\/calculated-fields\/[^/]+$/,
      respond: (config) => {
        const id = String(config.url).split('/').pop() ?? '';
        const existing = templates.find((t) => t.id === id);
        const updated = {
          ...existing,
          ...requestBody(config),
          id,
          updatedAt: new Date().toISOString(),
        };
        templates = templates.map((t) => (t.id === id ? updated : t));
        return { body: { success: true, data: updated } };
      },
    },
    {
      method: 'delete',
      url: /\/data-catalog\/templates\/calculated-fields\/[^/]+$/,
      respond: (config) => {
        const id = String(config.url).split('/').pop() ?? '';
        templates = templates.filter((t) => t.id !== id);
        return { body: { success: true } };
      },
    },
    {
      method: 'get',
      url: /\/data-catalog\/smus\/[^/?]+$/,
      respond: (config) => {
        const id = decodeURIComponent(String(config.url).split('/').pop() ?? '');
        const asset = ASSETS_BY_ID[id];
        return asset
          ? { body: { success: true, data: asset } }
          : { status: 404, body: { success: false, error: `No asset ${id}` } };
      },
    },
    {
      method: 'get',
      url: /\/data-catalog\/smus$/,
      respond: (config) => {
        const p = (config.params ?? {}) as Record<string, string | undefined>;
        return { body: { success: true, data: catalogFor(p.projectId, p.search, p.term) } };
      },
    },
    {
      method: 'get',
      url: '/data-catalog/tags',
      respond: () => ({ body: { success: true, data: TAGS } }),
    },
    {
      method: 'get',
      url: '/assets/datasets/paginated',
      respond: () => ({
        body: {
          success: true,
          data: {
            datasets: [{ id: 'ds-targets', name: 'Targets' }],
            pagination: { page: 1, pageSize: 500, totalItems: 1, totalPages: 1 },
          },
        },
      }),
    },
  ];
}
