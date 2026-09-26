import type { RouteHandler } from '../../../api/types';
import { contextEntity, contextRelated, contextSearch } from '../handlers/ContextHandler';
import { search } from '../handlers/SearchHandler';

export const searchRoutes: RouteHandler[] = [
  { method: 'GET', path: '/search', handler: search },
  // The context graph: search, get, related. Shaped like AWS Context.
  { method: 'GET', path: '/context/search', handler: contextSearch },
  {
    method: 'GET',
    path: /^\/context\/entities\/([^/]+)\/related$/,
    handler: (event) => contextRelated(withEntityId(event)),
  },
  {
    method: 'GET',
    path: /^\/context\/entities\/([^/]+)$/,
    handler: (event) => contextEntity(withEntityId(event)),
  },
];

/** The router's generic parameter names do not know this route; name the id from the path. */
function withEntityId<T extends { path: string; pathParameters: any }>(event: T): T {
  const match = event.path.match(/\/context\/entities\/([^/]+)/);
  return {
    ...event,
    pathParameters: { ...(event.pathParameters ?? {}), entityId: match?.[1] ?? '' },
  };
}
