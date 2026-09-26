import type { RouteHandler } from '../../../api/types';
import { PlaybooksHandler } from '../handlers/PlaybooksHandler';

const handler = new PlaybooksHandler();

export const playbookRoutes: RouteHandler[] = [
  { method: 'GET', path: '/playbooks', handler: (event) => handler.list(event) },
  {
    method: 'GET',
    path: /^\/playbooks\/runs\/([^/]+)\/items$/,
    handler: (event) => handler.items(event),
  },
  {
    method: 'POST',
    path: /^\/playbooks\/([a-z0-9-]+)\/preview$/,
    handler: (event) => handler.preview(event),
  },
  {
    method: 'POST',
    path: /^\/playbooks\/([a-z0-9-]+)\/run$/,
    handler: (event) => handler.run(event),
  },
];
