import { describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/SettingsHandler', () => ({
  SettingsHandler: vi.fn().mockImplementation(function () {
    return {
      get: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      update: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      listSmusProjects: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      listApiKeys: vi.fn(),
      createApiKey: vi.fn(),
      revokeApiKey: vi.fn(),
    };
  }),
}));

import { SETTINGS_CATALOG } from '../../../shared/services/settings/settingsCatalog';
import { settingsRoutes } from '../routes';

describe('settingsRoutes', () => {
  it('exposes get, update and the SMUS project list', () => {
    expect(settingsRoutes.map((r) => `${r.method} ${String(r.path)}`)).toEqual([
      'GET /settings',
      'PUT /settings',
      'GET /settings/smus/projects',
      'GET /settings/quicksight/folders',
      'GET /settings/api-keys',
      'POST /settings/api-keys',
      'DELETE /^\\/settings\\/api-keys\\/([^/]+)$/',
    ]);
  });

  it('serves every optionsFrom endpoint the catalog hands to the UI', () => {
    // The UI keys its option loaders by this exact path (see RemoteMultiSelect),
    // so a mismatch means the picker never asks and shows nothing.
    const served = settingsRoutes.filter((r) => r.method === 'GET').map((r) => r.path);
    const wanted = SETTINGS_CATALOG.flatMap((g) => g.settings)
      .map((s) => s.optionsFrom)
      .filter((path): path is string => Boolean(path));
    expect(wanted.length).toBeGreaterThan(0);
    for (const path of wanted) {
      expect(served).toContain(path);
    }
  });
});
