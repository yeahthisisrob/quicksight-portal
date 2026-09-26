import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type Schemas = components['schemas'];

export type SettingsSnapshot = Schemas['SettingsSnapshot'];
export type SettingDefinition = Schemas['SettingDefinition'];
export type SettingSource = Schemas['SettingSource'];
export type SettingsUpdate = Schemas['SettingsUpdate'];
export type SmusProjectDiagnostics = Schemas['SmusProjectDiagnostics'];
export type ApiKey = Schemas['ApiKey'];
export type ApiKeyCreated = Schemas['ApiKeyCreated'];

/**
 * Portal settings. Stored in DynamoDB, falling back to the Lambda's env vars
 * and then defaults; every setting reports where its value comes from.
 */
export const settingsApi = {
  async get() {
    return unwrap(await client.GET('/api/settings'), 'Failed to load settings');
  },

  /** null clears a stored value so it falls back to env or default. */
  async update(update: SettingsUpdate) {
    return unwrap(await client.PUT('/api/settings', { body: update }), 'Failed to save settings');
  },

  async listApiKeys() {
    return unwrap(await client.GET('/api/settings/api-keys'), 'Failed to list API keys').keys;
  },

  /** The secret in the result is shown once and never stored in the browser. */
  async createApiKey(label: string) {
    return unwrap(
      await client.POST('/api/settings/api-keys', { body: { label } }),
      'Failed to create the API key'
    );
  },

  async revokeApiKey(id: string): Promise<void> {
    unwrap(
      await client.DELETE('/api/settings/api-keys/{id}', { params: { path: { id } } }),
      'Failed to revoke the API key'
    );
  },

  /** Projects in the configured SMUS domain: live, plus the last SMUS export. */
  async listSmusProjects() {
    return unwrap(await client.GET('/api/settings/smus/projects'), 'Failed to list SMUS projects');
  },

  async listFolders() {
    return unwrap(await client.GET('/api/settings/quicksight/folders'), 'Failed to list folders');
  },
};
