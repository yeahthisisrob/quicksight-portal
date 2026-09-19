import type { RouteHandler } from '../../../api/types';
import { SettingsHandler } from '../handlers/SettingsHandler';

const handler = new SettingsHandler();

export const settingsRoutes: RouteHandler[] = [
  { method: 'GET', path: '/settings', handler: (event) => handler.get(event) },
  { method: 'PUT', path: '/settings', handler: (event) => handler.update(event) },
  {
    method: 'GET',
    path: '/settings/smus/projects',
    handler: (event) => handler.listSmusProjects(event),
  },
  { method: 'GET', path: '/settings/api-keys', handler: (event) => handler.listApiKeys(event) },
  { method: 'POST', path: '/settings/api-keys', handler: (event) => handler.createApiKey(event) },
  {
    method: 'DELETE',
    path: /^\/settings\/api-keys\/([^/]+)$/,
    handler: (event) => handler.revokeApiKey(event),
  },
];
