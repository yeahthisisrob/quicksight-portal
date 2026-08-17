import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { DataZoneAdapter } from '../../../adapters/aws/DataZoneAdapter';
import { requireAuth } from '../../../shared/auth';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { SmusService } from '../services/SmusService';

let smusService: SmusService;

function getSmusService(): SmusService {
  if (!smusService) {
    const config = getSmusConfig();
    const cacheService = CacheService.getInstance();
    const dataZoneAdapter = config.enabled ? new DataZoneAdapter(config.region) : null;
    smusService = new SmusService(cacheService, dataZoneAdapter, config);
  }
  return smusService;
}

/**
 * SMUS integration status — tells the FE whether to show SMUS UI at all.
 * GET /api/smus/status
 */
export async function getSmusStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    return successResponse(event, { success: true, data: getSmusService().getStatus() });
  } catch (error: any) {
    logger.error('Failed to get SMUS status', { error });
    return errorResponse(
      event,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      error.message || 'Internal server error'
    );
  }
}

/**
 * Resolve SMUS catalog links for datasets (live catalog sweep, TTL-cached).
 * POST /api/smus/dataset-links  body: { datasetIds?: string[] }
 */
export async function getSmusDatasetLinks(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);

    const body = JSON.parse(event.body || '{}');
    const datasetIds: string[] | undefined = Array.isArray(body.datasetIds)
      ? body.datasetIds.filter((id: unknown) => typeof id === 'string')
      : undefined;

    const service = getSmusService();
    if (!service.getStatus().configured) {
      return successResponse(event, { success: true, data: { links: [] } });
    }

    const links = await service.getDatasetLinks(datasetIds);
    return successResponse(event, { success: true, data: { links } });
  } catch (error: any) {
    logger.error('Failed to resolve SMUS dataset links', { error });
    return errorResponse(
      event,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      error.message || 'Internal server error'
    );
  }
}
