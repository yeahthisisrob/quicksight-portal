import { describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/SettingsHandler', () => ({
  SettingsHandler: vi.fn().mockImplementation(function () {
    return {
      get: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      update: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
      listSmusProjects: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
    };
  }),
}));

import { settingsRoutes } from '../routes';

describe('settingsRoutes', () => {
  it('exposes get, update and the SMUS project list', () => {
    expect(settingsRoutes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /settings',
      'PUT /settings',
      'GET /settings/smus/projects',
    ]);
  });
});
