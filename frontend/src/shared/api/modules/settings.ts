import type { components } from '@shared/generated/types';

import { api as apiClient } from '../client';
import type { ApiResponse } from '../types';

type Schemas = components['schemas'];

export type SettingsSnapshot = Schemas['SettingsSnapshot'];
export type SettingsGroup = Schemas['SettingsGroup'];
export type SettingDefinition = Schemas['SettingDefinition'];
export type SettingSource = Schemas['SettingSource'];
export type SettingsUpdate = Schemas['SettingsUpdate'];
export type SmusProject = Schemas['SmusProject'];
export type SmusProjectDiagnostics = Schemas['SmusProjectDiagnostics'];
export type ApiKey = Schemas['ApiKey'];
export type ApiKeyCreated = Schemas['ApiKeyCreated'];

export interface SmusProjectsResponse {
  configured: boolean;
  /** When the snapshot these projects come from was taken; null when no export has run. */
  exportedAt: string | null;
  projects: SmusProject[];
  diagnostics?: SmusProjectDiagnostics;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  const response = await promise;
  if (!response.data.success) {
    throw new Error(response.data.error || fallback);
  }
  return response.data.data!;
}

/**
 * Portal settings. Stored in DynamoDB, falling back to the Lambda's env vars
 * and then defaults; every setting reports where its value comes from.
 */
export const settingsApi = {
  get(): Promise<SettingsSnapshot> {
    return unwrap(
      apiClient.get<ApiResponse<SettingsSnapshot>>('/settings'),
      'Failed to load settings'
    );
  },

  /** null clears a stored value so it falls back to env or default. */
  update(update: SettingsUpdate): Promise<SettingsSnapshot> {
    return unwrap(
      apiClient.put<ApiResponse<SettingsSnapshot>>('/settings', update),
      'Failed to save settings'
    );
  },

  listApiKeys(): Promise<ApiKey[]> {
    return unwrap(
      apiClient.get<ApiResponse<{ keys: ApiKey[] }>>('/settings/api-keys'),
      'Failed to list API keys'
    ).then((data) => data.keys);
  },

  /** The secret in the result is shown once and never stored in the browser. */
  createApiKey(label: string): Promise<ApiKeyCreated> {
    return unwrap(
      apiClient.post<ApiResponse<ApiKeyCreated>>('/settings/api-keys', { label }),
      'Failed to create the API key'
    );
  },

  revokeApiKey(id: string): Promise<void> {
    return unwrap(
      apiClient.delete<ApiResponse<{ id: string }>>(`/settings/api-keys/${encodeURIComponent(id)}`),
      'Failed to revoke the API key'
    ).then(() => undefined);
  },

  /** Projects in the configured SMUS domain, from the last SMUS export. */
  listSmusProjects(): Promise<SmusProjectsResponse> {
    return unwrap(
      apiClient.get<ApiResponse<SmusProjectsResponse>>('/settings/smus/projects'),
      'Failed to list SMUS projects'
    );
  },
};
