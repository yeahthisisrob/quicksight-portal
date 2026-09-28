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
import { keepCatalogFresh } from '../../../shared/services/catalog/assetFreshness';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { mergeTags, readDefaultTags, type TagPair } from '../../../shared/tags/tagStandards';
import { logger } from '../../../shared/utils/logger';
import type { AuthorableAssetType } from '../types';

/** QuickSight tag values are capped at 256 characters, and a resource at 50 tags. */
const TAG_VALUE_MAX = 256;
const TAG_COUNT_MAX = 50;

/**
 * QuickSight refuses a create over 50 tags or with an empty value, which
 * would lose the whole write over a tag. Empty values are dropped; past 50,
 * the portal's own go first (who made it), then the rest in order.
 */
function withinTagLimit(tags: TagPair[], assetId: string): TagPair[] {
  const valued = tags.filter((t) => t.value.trim() !== '');
  if (valued.length <= TAG_COUNT_MAX) return valued;
  const own = valued.filter((t) => t.key.startsWith('portal:'));
  const kept = [...own, ...valued.filter((t) => !t.key.startsWith('portal:'))].slice(
    0,
    TAG_COUNT_MAX
  );
  logger.warn("Tags past QuickSight's limit of 50 were left off", {
    assetId,
    dropped: valued.filter((t) => !kept.includes(t)).map((t) => t.key),
  });
  return kept;
}

interface WrittenAsset {
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

function parseVersionNumber(versionArn?: string): number | null {
  const match = versionArn?.match(/\/version\/(\d+)$/);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Who wrote it and through what, as tags; none when Settings turn them off or nobody is known. */
function provenanceTags(auth: AuthContext | undefined): TagPair[] {
  if (!auth || settingsStore.get('provenance.tagAssets') === false) return [];
  const { actor, channel } = actorFromAuth(auth);
  return [
    { key: 'portal:authored-by', value: `${actor.kind}:${actor.label}`.slice(0, TAG_VALUE_MAX) },
    { key: 'portal:channel', value: channel },
    { key: 'portal:at', value: new Date().toISOString() },
  ];
}

/**
 * Create it with its tags in the same call: the organisation's defaults,
 * the ones asked for, and who made it. Tagging afterwards left a window in
 * which it existed untagged, and a cache refresh landing in it kept it so.
 */
export async function createAsset(
  quickSight: QuickSightService,
  input: WriteInput & { permissions?: any[]; tags?: TagPair[]; auth?: AuthContext }
): Promise<WrittenAsset> {
  const tags = withinTagLimit(
    mergeTags(readDefaultTags(), input.tags, provenanceTags(input.auth)),
    input.assetId
  );
  const tagged = tags.length > 0 ? { tags } : {};
  if (input.assetType === 'analysis') {
    const created = await quickSight.createAnalysis({
      analysisId: input.assetId,
      name: input.name,
      definition: input.definition as any,
      permissions: input.permissions,
      themeArn: input.themeArn,
      ...tagged,
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
    ...tagged,
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

type ProvenanceAction =
  | 'authoring.create'
  | 'authoring.update'
  | 'authoring.clone'
  | 'authoring.restore';

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
  await keepCatalogFresh(
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
  // A new asset was created with these tags; an update records who changed it.
  const tags = entry.action === 'authoring.update' ? provenanceTags(auth) : [];
  if (tags.length === 0) {
    return;
  }
  try {
    await quickSight.tagResource(entry.assetType, entry.assetId, tags);
  } catch (error) {
    logger.warn('Provenance tags could not be written', {
      assetType: entry.assetType,
      assetId: entry.assetId,
      error,
    });
  }
}
