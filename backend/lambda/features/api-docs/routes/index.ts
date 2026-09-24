import type { RouteHandler } from '../../../api/types';
import { getGuide, getOpenApi } from '../handlers/ApiDocsHandler';

export const apiDocsRoutes: RouteHandler[] = [
  { method: 'GET', path: '/api-docs/openapi', handler: getOpenApi },
  { method: 'GET', path: '/api-docs/guide', handler: getGuide },
];
