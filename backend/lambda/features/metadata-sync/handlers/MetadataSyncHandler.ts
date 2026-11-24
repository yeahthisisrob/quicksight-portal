import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { actorLabel, requireAuth } from '../../../shared/auth';
import { metadataBucketName } from '../../../shared/config/metadataBucket';
import { getMetadataSyncConfig } from '../../../shared/config/metadataSyncConfig';
import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { jobFactory } from '../../../shared/services/jobs/JobFactory';
import { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { emptyRecord, resolveConflict } from '../lib/merge';
import { MetadataSyncStore } from '../services/MetadataSyncStore';
import { SYNC_FIELDS, type SyncField, type SyncMode } from '../types';

const NOT_ENABLED = 'Metadata sync is turned off: turn it on in Settings first';
const NEEDS_SMUS = 'Metadata sync needs SMUS configured: set the domain id in Settings first';

function failed(event: APIGatewayProxyEvent, error: any, fallback: string): APIGatewayProxyResult {
  logger.error(fallback, { error });
  return errorResponse(
    event,
    error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
    error?.message || fallback
  );
}

/**
 * Whether the sync is on, and the last preview and the last run.
 * GET /api/metadata-sync/status
 */
export async function getMetadataSyncStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const config = getMetadataSyncConfig();
    if (!config.turnedOn) {
      return successResponse(event, {
        success: true,
        data: { ...config, lastPreview: null, lastRun: null },
      });
    }
    const store = new MetadataSyncStore();
    const [lastPreview, lastRun] = await Promise.all([
      store.getReport('preview'),
      store.getReport('run'),
    ]);
    return successResponse(event, { success: true, data: { ...config, lastPreview, lastRun } });
  } catch (error: any) {
    return failed(event, error, 'Failed to read the metadata sync status');
  }
}

/**
 * Queue a pass: a preview, which writes nothing, or a run. Single-flight.
 * POST /api/metadata-sync/sync  body: { mode: 'preview' | 'run' }
 */
export async function startMetadataSync(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    const config = getMetadataSyncConfig();
    if (!config.enabled) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        config.turnedOn ? NEEDS_SMUS : NOT_ENABLED
      );
    }
    const body = JSON.parse(event.body || '{}');
    const mode: SyncMode = body.mode === 'run' ? 'run' : 'preview';

    const jobStateService = new JobStateService('metadata-sync');
    const [existing] = await jobStateService.getActiveJobs();
    if (existing) {
      return createResponse(event, STATUS_CODES.OK, {
        success: true,
        data: {
          jobId: existing.jobId,
          status: existing.status,
          message: 'A metadata sync is already running; returning the existing job.',
        },
      });
    }

    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const result = await jobFactory.createJob({
      jobType: 'metadata-sync',
      accountId,
      bucketName: metadataBucketName(accountId),
      userId: user.userId,
      startedBy: actorLabel(user),
      options: { mode, startedBy: actorLabel(user) },
    });
    return createResponse(event, STATUS_CODES.ACCEPTED, {
      success: true,
      data: {
        jobId: result.jobId,
        status: result.status,
        message: mode === 'run' ? 'Metadata sync queued' : 'Metadata sync preview queued',
      },
    });
  } catch (error: any) {
    return failed(event, error, 'Failed to queue the metadata sync');
  }
}

interface ResolveBody {
  database: string;
  table: string;
  key: string;
  field: SyncField;
  value: string;
  sides: Record<string, string>;
}

function parseResolve(raw: string | null): ResolveBody {
  const body = JSON.parse(raw || '{}');
  for (const name of ['database', 'table', 'key', 'value'] as const) {
    if (typeof body[name] !== 'string' || !body[name].trim()) {
      throw new ValidationError(`'${name}' is required`);
    }
  }
  if (!SYNC_FIELDS.includes(body.field)) {
    throw new ValidationError(`'field' must be one of ${SYNC_FIELDS.join(', ')}`);
  }
  const sides = body.sides;
  if (
    !sides ||
    typeof sides !== 'object' ||
    Array.isArray(sides) ||
    Object.values(sides).some((v) => typeof v !== 'string')
  ) {
    throw new ValidationError("'sides' must say what each place showed when you picked");
  }
  return {
    database: body.database,
    table: body.table,
    key: body.key,
    field: body.field,
    value: body.value.trim(),
    sides,
  };
}

/**
 * Settle a conflict: the picked text becomes the table's, and the next run
 * copies it over what each place showed. Writes only the table's record.
 * POST /api/metadata-sync/resolve
 */
export async function resolveMetadataConflict(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    if (!getMetadataSyncConfig().turnedOn) {
      return errorResponse(event, STATUS_CODES.BAD_REQUEST, NOT_ENABLED);
    }
    const pick = parseResolve(event.body);
    const store = new MetadataSyncStore();
    const now = new Date().toISOString();
    const current =
      (await store.getRecord(pick.database, pick.table)) ??
      emptyRecord(pick.database, pick.table, now);
    const record = resolveConflict(current, { ...pick, by: actorLabel(user) }, now);
    await store.putRecord(record);
    return successResponse(event, {
      success: true,
      data: { database: pick.database, table: pick.table, key: pick.key, field: pick.field },
    });
  } catch (error: any) {
    return failed(event, error, 'Failed to settle the conflict');
  }
}
