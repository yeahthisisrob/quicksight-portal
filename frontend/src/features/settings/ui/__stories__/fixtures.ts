import type { SettingsSnapshot } from '@/shared/api/modules/settings';

import { type MockRoute, requestBody } from '../../../../../.storybook/mocks/api';

export const SNAPSHOT: SettingsSnapshot = {
  updatedAt: '2026-09-18T14:02:00Z',
  updatedBy: 'rob',
  groups: [
    {
      id: 'smus',
      title: 'SageMaker Unified Studio',
      description:
        'The DataZone domain the portal reads published assets from, and which of its projects count.',
      settings: [
        {
          key: 'smus.domainId',
          label: 'Domain id',
          description: 'The DataZone domain identifier (dzd_...). Unset disables the integration.',
          type: 'string',
          value: 'dzd_4k2pl8xq1',
          source: 'env',
          envVar: 'SMUS_DOMAIN_ID',
          sensitive: false,
        },
        {
          key: 'smus.region',
          label: 'Domain region',
          description: 'Where the domain lives. Defaults to the Lambda region.',
          type: 'string',
          value: 'us-east-1',
          source: 'default',
          envVar: 'SMUS_DOMAIN_REGION',
          sensitive: false,
        },
        {
          key: 'smus.projectIds',
          label: 'Projects',
          description:
            'Only listings owned by these projects are offered as rebind targets. Leave empty for every project.',
          type: 'multiselect',
          value: ['proj-published-prod'],
          source: 'stored',
          envVar: 'SMUS_PROJECT_IDS',
          sensitive: false,
          optionsFrom: '/settings/smus/projects',
        },
        {
          key: 'smus.portalUrl',
          label: 'Portal URL',
          description: 'Override for a custom SMUS domain. Derived from the domain id otherwise.',
          type: 'string',
          source: 'default',
          envVar: 'SMUS_PORTAL_URL',
          sensitive: false,
        },
      ],
    },
    {
      id: 'planner',
      title: 'Planner',
      description: 'The model that turns a natural-language ask into a rebind proposal.',
      settings: [
        {
          key: 'planner.provider',
          label: 'Provider',
          description:
            'Bedrock in every deployed environment; the CLI providers are local-dev only.',
          type: 'select',
          value: 'bedrock',
          source: 'stored',
          envVar: 'PLANNER_PROVIDER',
          sensitive: false,
          options: [
            { value: 'bedrock', label: 'Amazon Bedrock' },
            { value: 'claude-cli', label: 'Claude CLI (local)' },
            { value: 'codex-cli', label: 'Codex CLI (local)' },
            { value: 'openai-compatible', label: 'OpenAI-compatible endpoint' },
          ],
        },
        {
          key: 'planner.modelId',
          label: 'Model id',
          description: "In the provider's own vocabulary, e.g. a Bedrock inference profile.",
          type: 'string',
          value: 'us.anthropic.claude-sonnet-4-6',
          source: 'env',
          envVar: 'PLANNER_MODEL_ID',
          sensitive: false,
        },
        {
          key: 'planner.apiKey',
          label: 'API key',
          description: 'OpenAI-compatible endpoints only. Secrets are never stored here.',
          type: 'string',
          value: true,
          source: 'env',
          envVar: 'PLANNER_API_KEY',
          sensitive: true,
        },
        {
          key: 'planner.enabled',
          label: 'Planner enabled',
          description: 'Turn the natural-language proposal box off without redeploying.',
          type: 'boolean',
          value: true,
          source: 'default',
          envVar: 'PLANNER_ENABLED',
          sensitive: false,
        },
      ],
    },
  ],
};

export const PROJECTS = [
  { id: 'proj-published-prod', name: 'published_prod', description: 'Published layer' },
  { id: 'proj-published-dev', name: 'published_dev', description: 'Published layer, dev' },
  { id: 'proj-sandbox', name: 'sandbox' },
];

export const API_KEYS = [
  {
    id: 'k-cli',
    label: 'claude cli',
    prefix: 'qsp_7Hq2mLp9',
    createdAt: '2026-09-18T14:02:00.000Z',
    createdBy: 'rob@example.com',
    lastUsedAt: '2026-09-19T09:41:00.000Z',
  },
  {
    id: 'k-ci',
    label: 'nightly export',
    prefix: 'qsp_Aa91xZ4k',
    createdAt: '2026-09-01T08:00:00.000Z',
    createdBy: 'rob@example.com',
  },
];

export function settingsRoutes(overrides: MockRoute[] = []): MockRoute[] {
  let stored = SNAPSHOT;
  let keys = [...API_KEYS];
  return [
    ...overrides,
    {
      method: 'get',
      url: '/settings/api-keys',
      respond: () => ({ body: { success: true, data: { keys } } }),
    },
    {
      method: 'post',
      url: '/settings/api-keys',
      respond: (config) => {
        const { label } = requestBody<{ label: string }>(config);
        const key = {
          id: `k-${keys.length + 1}`,
          label,
          prefix: 'qsp_NewKey12',
          createdAt: new Date().toISOString(),
          createdBy: 'rob@example.com',
        };
        keys = [key, ...keys];
        return {
          status: 201,
          body: { success: true, data: { key, secret: 'qsp_example-secret-shown-once' } },
        };
      },
    },
    {
      method: 'delete',
      url: /\/settings\/api-keys\/[^/]+$/,
      respond: (config) => {
        const id = (config.url ?? '').split('/').pop();
        keys = keys.filter((k) => k.id !== id);
        return { body: { success: true, data: { id } } };
      },
    },
    {
      method: 'get',
      url: '/settings/smus/projects',
      respond: () => ({
        body: {
          success: true,
          data: { configured: true, exportedAt: '2026-09-18T09:30:00Z', projects: PROJECTS },
        },
      }),
    },
    { method: 'get', url: '/settings', respond: () => ({ body: { success: true, data: stored } }) },
    {
      method: 'put',
      url: '/settings',
      respond: (config) => {
        const { values } = requestBody<{ values: Record<string, unknown> }>(config);
        stored = {
          ...stored,
          updatedAt: new Date().toISOString(),
          groups: stored.groups.map((g) => ({
            ...g,
            settings: g.settings.map((s) =>
              s.key in values
                ? values[s.key] === null
                  ? { ...s, source: 'env' as const }
                  : { ...s, value: values[s.key] as never, source: 'stored' as const }
                : s
            ),
          })),
        };
        return { body: { success: true, data: stored } };
      },
    },
  ];
}
