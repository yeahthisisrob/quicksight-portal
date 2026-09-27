import type { MockRoute } from '../../../../../.storybook/mocks/api';
import { themeRoutes } from '../../../../entities/theme/ui/__stories__/fixtures';
import type { ThemeDraft, ThemeProposal } from '../../../../shared/api/modules/themes';

export const BRAND_DRAFT: ThemeDraft = {
  name: 'Acme',
  baseThemeId: 'CLASSIC',
  dataColors: ['#0B6E4F', '#F2A541', '#1F77B4', '#C8553D', '#6C5B7B', '#2A9D8F'],
  uiColors: {
    PrimaryBackground: '#FFFFFF',
    PrimaryForeground: '#1B1B1B',
    SecondaryBackground: '#F3F6F4',
    Accent: '#0B6E4F',
    AccentForeground: '#FFFFFF',
  },
  fontFamily: 'Georgia',
};

const PROPOSAL: ThemeProposal = {
  draft: {
    ...BRAND_DRAFT,
    baseThemeId: 'MIDNIGHT',
    uiColors: { PrimaryBackground: '#101820', PrimaryForeground: '#F2F2F2', Accent: '#F2A541' },
  },
  rationale:
    'The logo is amber and green on a near-black background, so the theme is dark with amber as its accent.',
  model: 'claude-sonnet-5',
};

const now = () => new Date().toISOString();

/** The themes list, settings, the proposal job and create, answered as the server does. */
export function newThemeRoutes(): MockRoute[] {
  return themeRoutes([
    {
      method: 'post',
      url: '/authoring/themes/propose',
      respond: () => ({
        status: 202,
        body: { success: true, data: { jobId: 'theme-job', status: 'queued', message: 'Queued' } },
      }),
    },
    {
      method: 'get',
      url: /^\/jobs\/theme-job\/result$/,
      respond: () => ({ body: { success: true, data: PROPOSAL } }),
    },
    {
      method: 'get',
      url: /^\/jobs\/theme-job$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            jobId: 'theme-job',
            jobType: 'planner',
            status: 'completed',
            progress: 100,
            message: 'Done',
            startTime: now(),
            lastUpdatedTime: now(),
          },
        },
      }),
    },
    {
      method: 'post',
      url: /^\/authoring\/themes$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            themeId: 'acme-3f9a1c',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:theme/acme-3f9a1c',
            warnings: [],
          },
        },
      }),
    },
    {
      method: 'get',
      url: '/assistant/models',
      respond: () => ({ body: { success: true, data: { models: [] } } }),
    },
    {
      method: 'get',
      url: /^\/settings$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            groups: [
              {
                id: 'authoring',
                title: 'Authoring',
                description: '',
                settings: [
                  {
                    key: 'authoring.defaultTheme',
                    label: 'Theme for authored assets',
                    description: '',
                    type: 'string',
                    source: 'stored',
                    sensitive: false,
                    value: 'brand',
                  },
                ],
              },
            ],
          },
        },
      }),
    },
    {
      method: 'put',
      url: /^\/settings$/,
      respond: () => ({ body: { success: true, data: { groups: [] } } }),
    },
  ]);
}
