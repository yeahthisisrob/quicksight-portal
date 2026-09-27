import type { MockRoute } from '../../../../../.storybook/mocks/api';
import type { ThemeListItem } from '../../../../shared/api/modules/themes';

const THEMES: ThemeListItem[] = [
  {
    id: 'brand',
    name: 'Brand',
    type: 'theme',
    status: 'active',
    enrichmentStatus: 'enriched',
    createdTime: '2026-08-01T09:00:00.000Z',
    lastUpdatedTime: '2026-09-20T14:30:00.000Z',
    lastExportTime: '2026-09-26T06:00:00.000Z',
    tags: [],
    permissions: [],
    arn: 'arn:aws:quicksight:us-east-1:123456789012:theme/brand',
    baseThemeId: 'CLASSIC',
    versionNumber: 3,
    dataColors: ['#0B6E4F', '#F2A541', '#1F77B4', '#C8553D', '#6C5B7B', '#2A9D8F'],
    uiColors: { PrimaryBackground: '#FFFFFF', PrimaryForeground: '#1B1B1B', Accent: '#0B6E4F' },
    fontFamily: 'Inter',
    usedBy: { dashboards: 14, analyses: 6 },
  },
  {
    id: 'night-ops',
    name: 'Night ops',
    type: 'theme',
    status: 'active',
    enrichmentStatus: 'enriched',
    createdTime: '2026-09-02T09:00:00.000Z',
    lastUpdatedTime: '2026-09-02T09:00:00.000Z',
    lastExportTime: '2026-09-26T06:00:00.000Z',
    tags: [],
    permissions: [],
    arn: 'arn:aws:quicksight:us-east-1:123456789012:theme/night-ops',
    baseThemeId: 'MIDNIGHT',
    versionNumber: 1,
    dataColors: ['#7FDBFF', '#FFDC00', '#FF851B', '#B10DC9'],
    uiColors: { PrimaryBackground: '#111111', PrimaryForeground: '#EEEEEE' },
    usedBy: { dashboards: 0, analyses: 1 },
  },
];

/** The themes list the picker reads. */
export function themeRoutes(extra: MockRoute[] = []): MockRoute[] {
  return [
    ...extra,
    {
      method: 'get',
      url: '/assets/themes/paginated',
      respond: () => ({
        body: {
          success: true,
          data: {
            themes: THEMES,
            pagination: {
              page: 1,
              pageSize: 500,
              totalItems: THEMES.length,
              totalPages: 1,
              hasMore: false,
            },
          },
        },
      }),
    },
  ];
}
