/**
 * The one place authoring writes a dashboard or analysis to QuickSight, so
 * every path (rebind, from nothing, a raw definition) publishes the same
 * way: an analysis is written as-is, a dashboard gets a new version that
 * is published at once, since an unpublished version shows viewers nothing
 * new.
 */
import type { AuthContext } from '../../../shared/auth';
import { actorFromAuth, auditLog } from '../../../shared/services/audit/AuditLog';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { keepCacheFresh } from '../../../shared/services/cache/assetFreshness';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { logger } from '../../../shared/utils/logger';
import type { AuthorableAssetType } from '../types';

/** QuickSight tag values are capped at 256 characters. */
const TAG_VALUE_MAX = 256;

export interface WrittenAsset {
  assetId: string;
  arn: string;
  /** Dashboards: the version that was created (and published). */
  versionNumber?: number;
}

interface WriteInput {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  definition: Record<string, any>;
  themeArn?: string;
  dashboardPublishOptions?: any;
}

export function parseVersionNumber(versionArn?: string): number | null {
  const match = versionArn?.match(/\/version\/(\d+)$/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function createAsset(
  quickSight: QuickSightService,
  input: WriteInput & { permissions?: any[] }
): Promise<WrittenAsset> {
  if (input.assetType === 'analysis') {
    const created = await quickSight.createAnalysis({
      analysisId: input.assetId,
      name: input.name,
      definition: input.definition as any,
      permissions: input.permissions,
      themeArn: input.themeArn,
    });
    return { assetId: created.analysisId, arn: created.arn };
  }
  const created = await quickSight.createDashboard({
    dashboardId: input.assetId,
    name: input.name,
    definition: input.definition as any,
    permissions: input.permissions,
    themeArn: input.themeArn,
    dashboardPublishOptions: input.dashboardPublishOptions,
  });
  return {
    assetId: created.dashboardId,
    arn: created.arn,
    versionNumber: parseVersionNumber(created.versionArn) ?? undefined,
  };
}

export async function updateAsset(
  quickSight: QuickSightService,
  input: WriteInput
): Promise<WrittenAsset> {
  if (input.assetType === 'analysis') {
    const result = await quickSight.updateAnalysis({
      analysisId: input.assetId,
      name: input.name,
      definition: input.definition,
      themeArn: input.themeArn,
    });
    return { assetId: input.assetId, arn: result?.arn ?? result?.Arn ?? '' };
  }
  const updated = await quickSight.updateDashboard({
    dashboardId: input.assetId,
    name: input.name,
    definition: input.definition,
    themeArn: input.themeArn,
    dashboardPublishOptions: input.dashboardPublishOptions,
  });
  // UpdateDashboard only creates a draft; publish it or viewers see nothing new.
  const versionNumber = parseVersionNumber(updated?.versionArn ?? updated?.VersionArn);
  if (versionNumber === null) {
    throw new Error('Dashboard was updated but the new version could not be determined');
  }
  await quickSight.updateDashboardPublishedVersion(input.assetId, versionNumber);
  return { assetId: input.assetId, arn: updated?.arn ?? updated?.Arn ?? '', versionNumber };
}

export type ProvenanceAction = 'authoring.create' | 'authoring.update' | 'authoring.clone';

/**
 * After every write: the cache learns of the asset at once and queues its
 * full refresh (and the folder's, when it was filed), so nobody has to run
 * an export to see it; then the portal's own trace of the write, an audit
 * record (who, through what) and tags on the asset so the fact survives
 * outside the portal. None of it may fail the write it follows.
 */
export async function recordProvenance(
  quickSight: QuickSightService,
  entry: {
    action: ProvenanceAction;
    assetType: AuthorableAssetType;
    assetId: string;
    name: string;
    arn?: string;
    /** The folders it was filed in, whose members changed. */
    folderIds?: string[];
    details: Record<string, unknown>;
  },
  auth?: AuthContext
): Promise<void> {
  await keepCacheFresh(
    [
      { assetType: entry.assetType, assetId: entry.assetId, name: entry.name, arn: entry.arn },
      ...(entry.folderIds ?? []).map((assetId) => ({ assetType: 'folder' as const, assetId })),
    ],
    { accountId: auth?.accountId, userId: auth?.userId }
  );
  if (!auth) {
    return;
  }
  const { actor, channel } = actorFromAuth(auth);
  await auditLog.record({
    actor,
    channel,
    action: entry.action,
    assetType: entry.assetType,
    assetId: entry.assetId,
    assetName: entry.name,
    details: entry.details,
  });
  if (settingsStore.get('provenance.tagAssets') === false) {
    return;
  }
  try {
    await quickSight.tagResource(entry.assetType, entry.assetId, [
      {
        key: 'portal:authored-by',
        value: `${actor.kind}:${actor.label}`.slice(0, TAG_VALUE_MAX),
      },
      { key: 'portal:channel', value: channel },
      { key: 'portal:at', value: new Date().toISOString() },
    ]);
  } catch (error) {
    logger.warn('Provenance tags could not be written', {
      assetType: entry.assetType,
      assetId: entry.assetId,
      error,
    });
  }
}
