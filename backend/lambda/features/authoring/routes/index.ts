import type { RouteHandler } from '../../../api/types';
import { AuthoringHandler } from '../handlers/AuthoringHandler';

const handler = new AuthoringHandler();

export const authoringRoutes: RouteHandler[] = [
  // From nothing: literal paths first so /authoring/new never matches the {assetType} regexes.
  {
    method: 'POST',
    path: '/authoring/new/preview',
    handler: (event) => handler.previewNew(event),
  },
  {
    method: 'POST',
    path: '/authoring/new',
    handler: (event) => handler.createNew(event),
  },
  {
    method: 'GET',
    path: /^\/authoring\/datasets\/([^/]+)\/columns$/,
    handler: (event) => handler.getDatasetColumns(event),
  },
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
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/repair\/plan$/,
    handler: (event) => handler.planRepair(event),
  },
  {
    method: 'POST',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/propose$/,
    handler: (event) => handler.propose(event),
  },
  {
    method: 'GET',
    path: /^\/authoring\/(analysis|dashboard)\/([^/]+)\/insights$/,
    handler: (event) => handler.getInsights(event),
  },
];
