import { type RouteHandler } from '../../../api/types';
import { ScriptsHandler } from '../handlers/ScriptsHandler';

const accountId = process.env.AWS_ACCOUNT_ID || '';
const handler = new ScriptsHandler(accountId);

export const scriptsRoutes: RouteHandler[] = [
  {
    method: 'GET',
    path: '/scripts/demo-cleanup/preview',
    handler: (event) => handler.previewDemoCleanup(event),
  },
  {
    method: 'POST',
    path: '/scripts/demo-cleanup/execute',
    handler: (event) => handler.executeDemoCleanup(event),
  },
];
