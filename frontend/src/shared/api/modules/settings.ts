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

export interface SmusProjectsResponse {
  configured: boolean;
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

  /** Live list of projects in the configured SMUS domain. */
  listSmusProjects(): Promise<SmusProjectsResponse> {
    return unwrap(
      apiClient.get<ApiResponse<SmusProjectsResponse>>('/settings/smus/projects'),
      'Failed to list SMUS projects'
    );
  },
};
