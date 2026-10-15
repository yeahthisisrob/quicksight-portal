/**
 * The versions a dashboard, analysis or dataset has been through: list
 * them, read one, and compare one with the version before it, another
 * version, or what is live now. Putting a version back is an authoring
 * write (`/authoring/{type}/{id}/versions/{versionId}/restore`).
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { metadataBucketName } from '../../../shared/config/metadataBucket';
import { STATUS_CODES } from '../../../shared/constants';
import { S3Service } from '../../../shared/services/aws/S3Service';
import {
  type AssetVersion,
  assetHistory,
  type StoredSnapshot,
} from '../../../shared/services/history/AssetHistory';
import {
  isVersionedType,
  snapshotOf,
  type VersionedAssetType,
} from '../../../shared/services/history/definitionSnapshot';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { buildAssetCacheKey } from '../../../shared/utils/s3KeyUtils';

const MAX_LIMIT = 200;
const DEFAULT_RECENT = 50;
const PLURAL: Record<VersionedAssetType, string> = {
  dashboard: 'dashboards',
  analysis: 'analyses',
  dataset: 'datasets',
};

function fail(event: APIGatewayProxyEvent, error: any, fallback: string): APIGatewayProxyResult {
  logger.error(fallback, { error });
  return errorResponse(
    event,
    error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
    error?.message || fallback
  );
}

function limitOf(event: APIGatewayProxyEvent, fallback: number): number {
  const raw = Number(event.queryStringParameters?.limit);
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : fallback;
}

function target(
  event: APIGatewayProxyEvent
): { assetType: VersionedAssetType; assetId: string } | APIGatewayProxyResult {
  const assetType = event.pathParameters?.assetType ?? '';
  const assetId = decodeURIComponent(event.pathParameters?.assetId ?? '');
  if (!isVersionedType(assetType as any)) {
    return errorResponse(
      event,
      STATUS_CODES.BAD_REQUEST,
      'History is kept for dashboards, analyses and datasets'
    );
  }
  if (!assetId) {
    return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset id is required');
  }
  return { assetType: assetType as VersionedAssetType, assetId };
}

function isResponse(value: unknown): value is APIGatewayProxyResult {
  return typeof (value as APIGatewayProxyResult)?.statusCode === 'number';
}

/** What is live now, as a snapshot, from the export document; null when there is none. */
async function liveSnapshot(
  assetType: VersionedAssetType,
  assetId: string
): Promise<StoredSnapshot | null> {
  const accountId = process.env.AWS_ACCOUNT_ID || '';
  const s3 = new S3Service(accountId);
  try {
    const doc = await s3.getObject(
      metadataBucketName(accountId),
      buildAssetCacheKey(PLURAL[assetType], assetId)
    );
    const snapshot = snapshotOf(assetType, doc);
    if (!snapshot) return null;
    return {
      assetType,
      assetId,
      versionId: 'live',
      at: doc?.apiResponses?.definition?.timestamp ?? doc?.apiResponses?.describe?.timestamp ?? '',
      name: snapshot.name,
      hash: snapshot.hash,
      definition: snapshot.definition,
    };
  } catch (error: any) {
    if (
      error?.name === 'NoSuchKey' ||
      error?.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND
    ) {
      return null;
    }
    throw error;
  }
}

/** GET /history?limit= - every version across the account, newest first. */
export async function listRecent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const versions = await assetHistory().recent(limitOf(event, DEFAULT_RECENT));
    return successResponse(event, { success: true, data: { versions } });
  } catch (error: any) {
    return fail(event, error, 'History could not be read');
  }
}

/** GET /history/{assetType}/{assetId} - the asset's versions, newest first. */
export async function listVersions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const t = target(event);
    if (isResponse(t)) return t;
    const versions = await assetHistory().list(t.assetType, t.assetId, limitOf(event, MAX_LIMIT));
    return successResponse(event, { success: true, data: { versions } });
  } catch (error: any) {
    return fail(event, error, 'History could not be read');
  }
}

/** GET /history/{assetType}/{assetId}/{versionId} - one version with its definition. */
export async function getVersion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const t = target(event);
    if (isResponse(t)) return t;
    const versionId = event.pathParameters?.versionId ?? '';
    const history = assetHistory();
    const version = await history.get(t.assetType, t.assetId, versionId);
    if (!version) {
      return errorResponse(event, STATUS_CODES.NOT_FOUND, `No version ${versionId}`);
    }
    const snapshot = await history.snapshot(t.assetType, t.assetId, versionId);
    return successResponse(event, {
      success: true,
      data: { version, definition: snapshot.definition },
    });
  } catch (error: any) {
    return fail(event, error, 'The version could not be read');
  }
}

/**
 * GET /history/{assetType}/{assetId}/{versionId}/diff?against=
 * What changed from the version before (the default), from another
 * version (`against=<versionId>`), or from this version to what is live now
 * (`against=live`).
 */
export async function diffVersion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const t = target(event);
    if (isResponse(t)) return t;
    const versionId = event.pathParameters?.versionId ?? '';
    const against = event.queryStringParameters?.against || 'previous';
    const history = assetHistory();
    const version = await history.get(t.assetType, t.assetId, versionId);
    if (!version) {
      return errorResponse(event, STATUS_CODES.NOT_FOUND, `No version ${versionId}`);
    }
    const snapshot = await history.snapshot(t.assetType, t.assetId, versionId);

    let from: AssetVersion | null;
    let fromSnapshot: StoredSnapshot | null;
    let to: AssetVersion | null = version;
    let toSnapshot: StoredSnapshot | null = snapshot;
    let live = false;
    if (against === 'live') {
      from = version;
      fromSnapshot = snapshot;
      to = null;
      toSnapshot = await liveSnapshot(t.assetType, t.assetId);
      live = true;
      if (!toSnapshot) {
        return errorResponse(
          event,
          STATUS_CODES.NOT_FOUND,
          'Nothing is live for it: it is not in the export (archived, or not exported yet)'
        );
      }
    } else if (against === 'previous') {
      from = await history.previous(version);
      fromSnapshot = from ? await history.snapshot(t.assetType, t.assetId, from.versionId) : null;
    } else {
      from = await history.get(t.assetType, t.assetId, against);
      if (!from) {
        return errorResponse(
          event,
          STATUS_CODES.NOT_FOUND,
          `No version ${against} to compare with`
        );
      }
      fromSnapshot = await history.snapshot(t.assetType, t.assetId, from.versionId);
    }
    const diff = history.diff(fromSnapshot, toSnapshot as StoredSnapshot);
    // The definitions themselves only when asked: a side-by-side view needs them, a summary does not.
    const withDefinitions = event.queryStringParameters?.include === 'definitions';
    return successResponse(event, {
      success: true,
      data: {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        live,
        ...diff,
        ...(withDefinitions
          ? {
              fromDefinition: fromSnapshot?.definition ?? null,
              toDefinition: (toSnapshot as StoredSnapshot).definition,
            }
          : {}),
      },
    });
  } catch (error: any) {
    return fail(event, error, 'The versions could not be compared');
  }
}
