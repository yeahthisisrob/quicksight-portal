import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { SearchService } from '../services/SearchService';
import { SEARCHABLE_TYPES, type SearchableType } from '../types';

const MAX_QUERY_LENGTH = 200;

/** GET /search?q=&types=a,b&projectId=&limit= */
export async function search(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const params = event.queryStringParameters ?? {};
    const q = (params.q ?? '').trim();
    if (!q) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'q is required');
    }
    if (q.length > MAX_QUERY_LENGTH) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `q must be at most ${MAX_QUERY_LENGTH} characters`
      );
    }
    const types = (params.types ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean) as SearchableType[];
    const unknown = types.filter((t) => !SEARCHABLE_TYPES.includes(t));
    if (unknown.length > 0) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `Unknown types: ${unknown.join(', ')}. Known: ${SEARCHABLE_TYPES.join(', ')}`
      );
    }
    const limit = params.limit ? Number(params.limit) : undefined;
    if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'limit must be a positive integer');
    }
    const result = await new SearchService().search({
      q,
      types,
      limit,
      projectId: params.projectId || undefined,
    });
    return successResponse(event, { success: true, data: result });
  } catch (error: any) {
    logger.error('Search failed', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Search failed'
    );
  }
}
