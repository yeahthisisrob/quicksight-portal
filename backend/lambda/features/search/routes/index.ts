import type { RouteHandler } from '../../../api/types';
import { search } from '../handlers/SearchHandler';

export const searchRoutes: RouteHandler[] = [{ method: 'GET', path: '/search', handler: search }];
