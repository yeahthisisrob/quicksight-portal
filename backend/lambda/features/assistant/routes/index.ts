import type { RouteHandler } from '../../../api/types';
import { chat, listModels } from '../handlers/AssistantHandler';

export const assistantRoutes: RouteHandler[] = [
  { method: 'GET', path: '/assistant/models', handler: listModels },
  { method: 'POST', path: '/assistant/chat', handler: chat },
];
