import type { RouteHandler } from '../../../api/types';
import { AuthoringHandler } from '../handlers/AuthoringHandler';

const handler = new AuthoringHandler();

export const authoringRoutes: RouteHandler[] = [
  {
    method: 'GET',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/datasets$/,
    handler: (event) => handler.getDatasets(event),
  },
  {
    method: 'POST',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/rebind\/plan$/,
    handler: (event) => handler.planRebind(event),
  },
  {
    method: 'POST',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/rebind\/preview$/,
    handler: (event) => handler.previewRebind(event),
  },
  {
    method: 'POST',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/rebind$/,
    handler: (event) => handler.applyRebind(event),
  },
  {
    method: 'POST',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/propose$/,
    handler: (event) => handler.propose(event),
  },
];
