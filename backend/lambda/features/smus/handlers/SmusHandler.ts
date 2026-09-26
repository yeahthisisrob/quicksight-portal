import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { jobFactory, type SmusExportJobConfig } from '../../../shared/services/jobs/JobFactory';
import { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { SmusService } from '../../../shared/services/smus/SmusService';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

let smusService: SmusService;

/**
 * Built per request: settings can change the domain, projects or patterns at
 * runtime. Reads come from the SMUS snapshot in the cache, never DataZone.
 */
function getSmusService(): SmusService {
  const config = getSmusConfig();
  const cacheService = CacheService.getInstance();
  const quickSightService = ClientFactory.getQuickSightService(process.env.AWS_ACCOUNT_ID || '');
  smusService = new SmusService(cacheService, config, quickSightService);
  return smusService;
}

/**
 * Queue a SMUS export: one sweep of the domain into the snapshot. Single-flight.
 * POST /api/smus/export
 */
export async function startSmusExport(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    const config = getSmusConfig();
    if (!config.enabled) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'SMUS is not configured: set the domain id in Settings first'
      );
    }

    const jobStateService = new JobStateService('smus-export');
    const [existing] = await jobStateService.getActiveJobs();
    if (existing) {
      return createResponse(event, STATUS_CODES.OK, {
        success: true,
        data: {
          jobId: existing.jobId,
          status: existing.status,
          message: 'A SMUS export is already running; returning the existing job.',
        },
      });
    }

    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const jobConfig: SmusExportJobConfig = {
      jobType: 'smus-export',
      accountId,
      bucketName: process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`,
      userId: user.userId,
      options: { smus: config },
    };
    const result = await jobFactory.createJob(jobConfig);
    return createResponse(event, STATUS_CODES.ACCEPTED, {
      success: true,
      data: { jobId: result.jobId, status: result.status, message: 'SMUS export queued' },
    });
  } catch (error: any) {
    logger.error('Failed to queue SMUS export', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to queue SMUS export'
    );
  }
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
    if (
      body.dataSourceId !== undefined &&
      (typeof body.dataSourceId !== 'string' || !body.dataSourceId)
    ) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'dataSourceId must be a data source id'
      );
    }
    if (
      body.importMode !== undefined &&
      body.importMode !== 'DIRECT_QUERY' &&
      body.importMode !== 'SPICE'
    ) {
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
 * The Athena data source a new dataset over a listing reads through, and
 * every Athena source with how many governed datasets use it.
 * GET /api/smus/data-source
 */
export async function getSmusDataSource(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    return successResponse(event, {
      success: true,
      data: await getSmusService().defaultDataSource(),
    });
  } catch (error: any) {
    logger.error('Failed to choose the SMUS data source', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to choose a data source'
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
    return successResponse(event, { success: true, data: await getSmusService().getStatus() });
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
 * Resolve SMUS catalog links for datasets from the snapshot (TTL-cached link map).
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
    if (!(await service.getStatus()).configured) {
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
