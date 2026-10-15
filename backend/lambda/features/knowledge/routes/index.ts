import type { RouteHandler } from '../../../api/types';
import {
  addNote,
  confirmNote,
  listAllNotes,
  listNotes,
  removeNote,
} from '../handlers/KnowledgeHandler';

const ENTITY = /^\/knowledge\/([^/]+)$/;
const NOTE = /^\/knowledge\/([^/]+)\/([^/]+)$/;
const CONFIRM = /^\/knowledge\/([^/]+)\/([^/]+)\/confirm$/;

/** The router's generic parameter names do not know these routes; name the ids from the path. */
function withIds<T extends { path: string; pathParameters: any }>(event: T): T {
  const match = event.path.match(/\/knowledge\/([^/]+)(?:\/([^/]+))?/);
  return {
    ...event,
    pathParameters: {
      ...(event.pathParameters ?? {}),
      entityId: match?.[1] ?? '',
      ...(match?.[2] && match[2] !== 'confirm' ? { noteId: match[2] } : {}),
    },
  };
}

export const knowledgeRoutes: RouteHandler[] = [
  { method: 'GET', path: '/knowledge', handler: listAllNotes },
  { method: 'GET', path: ENTITY, handler: (event) => listNotes(withIds(event)) },
  { method: 'POST', path: ENTITY, handler: (event) => addNote(withIds(event)) },
  { method: 'POST', path: CONFIRM, handler: (event) => confirmNote(withIds(event)) },
  { method: 'DELETE', path: NOTE, handler: (event) => removeNote(withIds(event)) },
];
