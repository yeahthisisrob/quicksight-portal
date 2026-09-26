/**
 * API stubs for the catalog stories: the list (projects, search, term), one
 * asset, dataset tags, tagged datasets, and the calculated-field templates a
 * field can be saved as. Overrides
 * come first so a story can replace any of them.
 */
import type { MockRoute } from '../../../../../.storybook/mocks/api';
import { searchRoute } from '../../../../../.storybook/mocks/search';
import { templateLibraryRoutes } from '../../../../../.storybook/mocks/templates';
import { settingsSnapshotRoute } from '../../../author/ui/__stories__/fixtures';
import { fieldCatalogRoutes } from './fieldCatalog';
import { ASSETS_BY_ID, catalogFor, TEMPLATES } from './fixtures';

const TAGS = [
  { key: 'team', value: 'finance', count: 2 },
  { key: 'tier', value: 'gold', count: 3 },
];

export function catalogRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...templateLibraryRoutes(TEMPLATES),
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
