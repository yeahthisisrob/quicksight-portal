import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { DataZoneAdapter } from '../../../adapters/aws/DataZoneAdapter';
import { requireAuth } from '../../../shared/auth';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { SmusService } from '../services/SmusService';

let smusService: SmusService;

/**
 * Built per request: settings can change the domain, projects or patterns at
 * runtime, and the expensive parts (catalog sweeps) are cached statically
 * inside SmusService anyway.
 */
function getSmusService(): SmusService {
  const config = getSmusConfig();
  const cacheService = CacheService.getInstance();
  const dataZoneAdapter = config.enabled ? new DataZoneAdapter(config.region) : null;
  const quickSightService = ClientFactory.getQuickSightService(process.env.AWS_ACCOUNT_ID || '');
  smusService = new SmusService(cacheService, dataZoneAdapter, config, quickSightService);
  return smusService;
}

/**
 * Published SMUS assets with the QuickSight datasets already reading them.
 * GET /api/smus/assets?search=
 */
export async function listSmusAssets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const search = event.queryStringParameters?.search || undefined;
    const result = await getSmusService().listAssets(search);
    return successResponse(event, { success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to list SMUS assets', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to list SMUS assets'
    );
  }
}

/**
 * Create a QuickSight dataset over a published asset's Glue table.
 * POST /api/smus/assets/{listingId}/dataset
 */
export async function createSmusDataset(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    const listingId = event.pathParameters?.listingId || '';
    if (!listingId) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Listing id is required');
    }
    const body = JSON.parse(event.body || '{}');
    if (typeof body.dataSourceId !== 'string' || !body.dataSourceId) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'dataSourceId is required');
    }
    if (body.importMode !== 'DIRECT_QUERY' && body.importMode !== 'SPICE') {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'importMode must be DIRECT_QUERY or SPICE'
      );
    }
    logger.info('SMUS dataset creation requested', { user: user.email, listingId });
    const result = await getSmusService().createDatasetFromListing(listingId, {
      dataSourceId: body.dataSourceId,
      name: typeof body.name === 'string' ? body.name : undefined,
      importMode: body.importMode,
      permissionsFromDataSetId:
        typeof body.permissionsFromDataSetId === 'string'
          ? body.permissionsFromDataSetId
          : undefined,
    });
    return successResponse(event, { success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to create dataset from SMUS asset', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.BAD_REQUEST,
      error?.message || 'Failed to create the dataset'
    );
  }
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
