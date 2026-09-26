/**
 * The context graph over HTTP, shaped like AWS Context's agentic search:
 * search for entities, get one, follow its relationships. An agent written
 * against these three calls can later be pointed at Context unchanged.
 *
 * GET /context/search?q=&types=&projectId=&limit=
 * GET /context/entities/{entityId}
 * GET /context/entities/{entityId}/related?relations=&direction=&depth=&types=&limit=
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import type { Direction, EntityType, Relation } from '../lib/contextGraph';
import { SearchService } from '../services/SearchService';
import type { SearchableType } from '../types';

export const ENTITY_TYPES: readonly EntityType[] = [
  'project',
  'listing',
  'listing-column',
  'glossary-term',
  'datasource',
  'dataset',
  'calculated-field',
  'analysis',
  'dashboard',
  'visual',
  'template',
  'folder',
];

export const RELATIONS: readonly Relation[] = [
  'in-project',
  'has-column',
  'tagged',
  'reads-listing',
  'through-datasource',
  'exposes',
  'uses-dataset',
  'defined-in',
  'reads-column',
  'in-asset',
  'in-folder',
];

/** Entity kinds to the search document kinds that hold them (glossary terms are found through their listings). */
const SEARCH_TYPE: Partial<Record<EntityType, SearchableType>> = {
  project: 'project',
  listing: 'smus-listing',
  'listing-column': 'smus-column',
  datasource: 'datasource',
  dataset: 'dataset',
  'calculated-field': 'calculated-field',
  analysis: 'analysis',
  dashboard: 'dashboard',
  visual: 'visual',
  template: 'template',
  folder: 'folder',
};

const NEIGHBOUR_PREVIEW = 8;
const MAX_QUERY_LENGTH = 200;

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function fail(event: APIGatewayProxyEvent, error: any, fallback: string): APIGatewayProxyResult {
  logger.error(fallback, { error });
  return errorResponse(
    event,
    error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
    error?.message || fallback
  );
}

export async function contextSearch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const params = event.queryStringParameters ?? {};
    const q = (params.q ?? '').trim();
    if (!q || q.length > MAX_QUERY_LENGTH) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `q is required, at most ${MAX_QUERY_LENGTH} characters`
      );
    }
    const types = list(params.types);
    const unknown = types.filter((t) => !ENTITY_TYPES.includes(t as EntityType));
    if (unknown.length) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `Unknown types: ${unknown.join(', ')}. Known: ${ENTITY_TYPES.join(', ')}`
      );
    }
    const searchTypes = types
      .map((t) => SEARCH_TYPE[t as EntityType])
      .filter((t): t is SearchableType => Boolean(t));
    const limit = params.limit ? Number(params.limit) : undefined;
    const result = await new SearchService().search({
      q,
      types: searchTypes,
      limit: Number.isInteger(limit) && (limit as number) > 0 ? limit : undefined,
      projectId: params.projectId || undefined,
    });
    return successResponse(event, {
      success: true,
      data: {
        q,
        hits: result.hits.map((h) => ({
          entityId: h.entityId,
          type: h.entityId?.split(':')[0],
          name: h.name,
          summary: h.summary,
          why: h.why,
          score: h.score,
          ...(h.projectId ? { projectId: h.projectId } : {}),
          path: h.path,
        })),
        indexedAt: result.indexedAt,
      },
    });
  } catch (error: any) {
    return fail(event, error, 'Context search failed');
  }
}

export async function contextEntity(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const id = decodeURIComponent(event.pathParameters?.entityId ?? '');
    const graph = await new SearchService().graph();
    const entity = graph.get(id);
    if (!entity) {
      return errorResponse(
        event,
        STATUS_CODES.NOT_FOUND,
        `No entity ${id}. Ids look like dataset:abc123; find them with /context/search.`
      );
    }
    const relations = graph.relationCounts(id).map((r) => ({
      ...r,
      examples: graph
        .related(id, { relations: [r.relation], direction: r.direction, limit: NEIGHBOUR_PREVIEW })
        .map((h) => ({
          entityId: h.entity.id,
          name: h.entity.name,
          ...(h.via[0]?.note ? { note: h.via[0].note } : {}),
        })),
    }));
    return successResponse(event, { success: true, data: { entity, relations } });
  } catch (error: any) {
    return fail(event, error, 'Context entity failed');
  }
}

export async function contextRelated(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const id = decodeURIComponent(event.pathParameters?.entityId ?? '');
    const params = event.queryStringParameters ?? {};
    const relations = list(params.relations);
    const badRelation = relations.find((r) => !RELATIONS.includes(r as Relation));
    if (badRelation) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `Unknown relation ${badRelation}. Known: ${RELATIONS.join(', ')}`
      );
    }
    const types = list(params.types);
    const direction = (params.direction ?? 'both') as Direction;
    if (!['out', 'in', 'both'].includes(direction)) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'direction must be out, in or both');
    }
    const graph = await new SearchService().graph();
    if (!graph.has(id)) {
      return errorResponse(event, STATUS_CODES.NOT_FOUND, `No entity ${id}`);
    }
    const hits = graph.related(id, {
      relations: relations as Relation[],
      direction,
      depth: params.depth ? Number(params.depth) : undefined,
      types: types as EntityType[],
      limit: params.limit ? Number(params.limit) : undefined,
    });
    return successResponse(event, {
      success: true,
      data: {
        from: id,
        hits: hits.map((h) => ({
          entityId: h.entity.id,
          type: h.entity.type,
          name: h.entity.name,
          summary: h.entity.summary,
          ...(h.entity.description ? { description: h.entity.description } : {}),
          attributes: h.entity.attributes,
          depth: h.depth,
          via: h.via,
        })),
      },
    });
  } catch (error: any) {
    return fail(event, error, 'Context related failed');
  }
}
