/**
 * What is known about a thing, by its graph entity id: read it, add a
 * person's note, confirm a draft a model wrote, or remove one. Notes live in
 * the portal table (`shared/services/knowledge`); the context graph and the
 * planner read the confirmed ones.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { actorLabel, requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import {
  knowledge,
  type NoteKind,
  type NoteStatus,
} from '../../../shared/services/knowledge/KnowledgeStore';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

const PERSON_KINDS = new Set<NoteKind>([
  'meaning',
  'rule',
  'identity',
  'preference',
  'description',
]);
const ENTITY_ID = /^[a-z-]+:.+$/;
const MAX_LIMIT = 100;

function entityIdOf(event: APIGatewayProxyEvent): string {
  return decodeURIComponent(event.pathParameters?.entityId ?? '').trim();
}

function fail(event: APIGatewayProxyEvent, error: any, fallback: string): APIGatewayProxyResult {
  logger.error(fallback, { error });
  return errorResponse(
    event,
    error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
    error?.message || fallback
  );
}

/** GET /knowledge?status=confirmed|draft&limit= - across every entity, newest first. */
export async function listAllNotes(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const status = event.queryStringParameters?.status;
    if (status !== 'confirmed' && status !== 'draft') {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        "status must be 'confirmed' or 'draft'"
      );
    }
    const limit = Number(event.queryStringParameters?.limit);
    const notes = await knowledge.listAll(
      status,
      Number.isInteger(limit) && limit > 0 ? limit : undefined
    );
    return successResponse(event, { success: true, data: { notes } });
  } catch (error: any) {
    return fail(event, error, 'Notes could not be read');
  }
}

/** GET /knowledge/{entityId}?status=confirmed|draft&limit= */
export async function listNotes(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const entityId = entityIdOf(event);
    if (!ENTITY_ID.test(entityId)) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'entityId looks like type:id');
    }
    const status = event.queryStringParameters?.status;
    const limit = Number(event.queryStringParameters?.limit);
    const notes = await knowledge.list(entityId, {
      ...(status === 'confirmed' || status === 'draft' ? { status: status as NoteStatus } : {}),
      ...(Number.isInteger(limit) && limit > 0 ? { limit: Math.min(limit, MAX_LIMIT) } : {}),
    });
    return successResponse(event, { success: true, data: { entityId, notes } });
  } catch (error: any) {
    return fail(event, error, 'Notes could not be read');
  }
}

/** POST /knowledge/{entityId} { kind, text } - a person's note, confirmed as written. */
export async function addNote(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    const entityId = entityIdOf(event);
    if (!ENTITY_ID.test(entityId)) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'entityId looks like type:id');
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Request body is not valid JSON');
    }
    const kind = body.kind as NoteKind;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!PERSON_KINDS.has(kind)) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `kind must be one of ${[...PERSON_KINDS].join(', ')}`
      );
    }
    if (!text) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'text is required');
    }
    const note = await knowledge.add({
      entityId,
      kind,
      text,
      source: 'person',
      by: actorLabel(user),
      ...(body.resolves && typeof body.resolves === 'string'
        ? { details: { resolves: body.resolves } }
        : {}),
    });
    // A note that answers an open question closes it.
    if (typeof body.resolves === 'string' && body.resolves) {
      await knowledge.remove(entityId, body.resolves).catch(() => undefined);
    }
    return createResponse(event, STATUS_CODES.CREATED, { success: true, data: note });
  } catch (error: any) {
    return fail(event, error, 'The note could not be saved');
  }
}

/** POST /knowledge/{entityId}/{noteId}/confirm { text? } - a draft becomes the person's. */
export async function confirmNote(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    const entityId = entityIdOf(event);
    const noteId = decodeURIComponent(event.pathParameters?.noteId ?? '');
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Request body is not valid JSON');
    }
    const note = await knowledge.confirm(
      entityId,
      noteId,
      actorLabel(user),
      typeof body.text === 'string' ? body.text : undefined
    );
    if (!note) {
      return errorResponse(event, STATUS_CODES.NOT_FOUND, `No note ${noteId} on ${entityId}`);
    }
    return successResponse(event, { success: true, data: note });
  } catch (error: any) {
    return fail(event, error, 'The note could not be confirmed');
  }
}

/** DELETE /knowledge/{entityId}/{noteId} */
export async function removeNote(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const entityId = entityIdOf(event);
    const noteId = decodeURIComponent(event.pathParameters?.noteId ?? '');
    await knowledge.remove(entityId, noteId);
    return successResponse(event, { success: true, data: { entityId, noteId } });
  } catch (error: any) {
    return fail(event, error, 'The note could not be removed');
  }
}
