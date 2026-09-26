import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { CloudTrailAdapter } from './adapters/aws/CloudTrailAdapter';
import { apiHandler } from './api/apiHandler';
import { ActivityService } from './features/activity/services/ActivityService';
import { CatalogService } from './features/data-catalog/services/CatalogService';
import { ExportOrchestrator } from './features/data-export/services/ExportOrchestrator';
import { STATUS_CODES } from './shared/constants';
import { registerActivityReader } from './shared/services/activity/activityReader';
import { registerAssetRefresher } from './shared/services/cache/assetRefresher';
import { cacheService } from './shared/services/cache/CacheService';
import { registerCatalogIndexer } from './shared/services/catalog/catalogIndexer';
import { GroupService } from './shared/services/organization/GroupService';
import { errorResponse, successResponse } from './shared/utils/cors';
import { logger } from './shared/utils/logger';

// The export rebuilds the data catalog through a port; the catalog slice does the work.
registerCatalogIndexer({
  clear: () => new CatalogService().clearCatalog(),
  rebuild: async () => {
    const catalog = new CatalogService();
    await catalog.rebuildCatalogIndex();
    await catalog.buildVisualFieldCatalog();
  },
});
// Slices read activity through a port; the activity slice's service is the reader.
registerActivityReader(() => {
  const region = process.env.AWS_REGION || 'us-east-1';
  return new ActivityService(
    cacheService,
    new CloudTrailAdapter(new CloudTrailClient({ region }), region),
    new GroupService()
  );
});

// A delete through the API archives what QuickSight has now (see worker.ts).
registerAssetRefresher((assets) =>
  new ExportOrchestrator(process.env.AWS_ACCOUNT_ID || '').refreshAssets(assets)
);

// Warm start optimization - keep track of initialization
let isWarm = false;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Allow Lambda to continue running after response is sent
  // This is crucial for fire-and-forget export operations
  context.callbackWaitsForEmptyEventLoop = false;

  // Strip stage name from path in production
  let path = event.path;
  if (event.requestContext?.stage && path.startsWith(`/${event.requestContext.stage}`)) {
    path = path.substring(event.requestContext.stage.length + 1) || '/';
  }

  const modifiedEvent = {
    ...event,
    path,
    lambdaContext: context, // Pass context for export handler
  };

  // Mark as warm after first execution
  if (!isWarm) {
    isWarm = true;
  }

  try {
    // Route to appropriate handler
    if (path.startsWith('/api')) {
      return await apiHandler(modifiedEvent);
    }

    // Health check endpoint
    if (path === '/health') {
      return successResponse(event, {
        status: 'healthy',
        isWarm,
        timestamp: new Date().toISOString(),
      });
    }

    // Keep-warm endpoint for scheduled pings
    if (path === '/keep-warm') {
      return successResponse(event, {
        status: 'warm',
        isWarm,
        timestamp: new Date().toISOString(),
      });
    }

    // 404 for unmatched routes
    return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Not found');
  } catch (error) {
    logger.error('Handler error', { error });
    return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};
