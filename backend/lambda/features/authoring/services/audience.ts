/**
 * Who sees what the portal builds, decided without asking anyone:
 *
 * - the person who builds it owns it: their sign-in email is matched to a
 *   QuickSight user in the export cache, and that user gets the owner
 *   actions on top of whatever audience the asset inherits;
 * - it is filed in the folders Settings names (authoring.defaultFolderIds),
 *   and in any folder the request names; a shared folder carries its
 *   members' access.
 *
 * Only when none of that applies does the asset stay admins-only, and the
 * result says why.
 */
import type { AuthContext } from '../../../shared/auth';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { logger } from '../../../shared/utils/logger';
import type { AuthorableAssetType } from '../types';

export const OWNER_ACTIONS: Record<AuthorableAssetType, string[]> = {
  analysis: [
    'quicksight:RestoreAnalysis',
    'quicksight:UpdateAnalysisPermissions',
    'quicksight:DeleteAnalysis',
    'quicksight:DescribeAnalysisPermissions',
    'quicksight:QueryAnalysis',
    'quicksight:DescribeAnalysis',
    'quicksight:UpdateAnalysis',
  ],
  dashboard: [
    'quicksight:DescribeDashboard',
    'quicksight:ListDashboardVersions',
    'quicksight:UpdateDashboardPermissions',
    'quicksight:QueryDashboard',
    'quicksight:UpdateDashboard',
    'quicksight:DeleteDashboard',
    'quicksight:DescribeDashboardPermissions',
    'quicksight:UpdateDashboardPublishedVersion',
  ],
};

interface Audience {
  permissions?: any[];
  folderIds: string[];
  /** The creator's QuickSight user, when their email matched one. */
  owner?: { userName: string; arn: string };
  warnings: string[];
}

/** The QuickSight user whose email is the signed-in person's, from the export cache. */
export async function quickSightUserFor(
  email: string | undefined
): Promise<{ userName: string; arn: string } | undefined> {
  const wanted = email?.trim().toLowerCase();
  if (!wanted) return undefined;
  try {
    const users = await cacheService.getCacheEntries({
      assetType: 'user',
      statusFilter: AssetStatusFilter.ACTIVE,
    });
    const match = users.find(
      (u: any) =>
        String(u.metadata?.email ?? '')
          .trim()
          .toLowerCase() === wanted && u.arn
    );
    return match
      ? { userName: String(match.assetName ?? match.assetId), arn: String(match.arn) }
      : undefined;
  } catch (error) {
    logger.warn('Creator lookup failed', { error });
    return undefined;
  }
}

/** Permissions with this principal added as an owner (merged when it is already there). */
export function withOwner(
  permissions: any[] | undefined,
  arn: string,
  assetType: AuthorableAssetType
): any[] {
  const actions = OWNER_ACTIONS[assetType];
  const list = (permissions ?? []).map((p) => ({ ...p, Actions: [...(p.Actions ?? [])] }));
  const existing = list.find((p) => p.Principal === arn);
  if (existing) {
    existing.Actions = [...new Set([...existing.Actions, ...actions])];
  } else {
    list.push({ Principal: arn, Actions: actions });
  }
  return list;
}

const PRINCIPAL_KIND = /:(user|group)\//;

/**
 * An archived audience, less the users and groups deleted since: QuickSight
 * refuses a whole create over one principal it does not know. Anything that
 * is not a user or group ARN (a namespace, an account) is kept as it is.
 * When the user and group caches cannot be read, nothing is dropped.
 */
export async function keepLivePrincipals(
  permissions: any[]
): Promise<{ permissions: any[]; dropped: string[]; warnings: string[] }> {
  if (permissions.length === 0) {
    return { permissions, dropped: [], warnings: [] };
  }
  let known: Set<string>;
  try {
    const [users, groups] = await Promise.all(
      (['user', 'group'] as const).map((assetType) =>
        cacheService.getCacheEntries({ assetType, statusFilter: AssetStatusFilter.ACTIVE })
      )
    );
    known = new Set([...(users ?? []), ...(groups ?? [])].map((e: any) => String(e.arn ?? '')));
  } catch (error) {
    logger.warn('Principal check skipped: users and groups could not be read', { error });
    return { permissions, dropped: [], warnings: [] };
  }
  const kept: any[] = [];
  const dropped: string[] = [];
  for (const permission of permissions) {
    const principal = String(permission?.Principal ?? '');
    if (PRINCIPAL_KIND.test(principal) && !known.has(principal)) {
      dropped.push(principal);
    } else {
      kept.push(permission);
    }
  }
  const warnings =
    dropped.length > 0
      ? [
          `${dropped.length} of its former users or groups no longer exist and were left out: ${dropped
            .map((arn) => arn.split('/').pop())
            .join(', ')}.`,
        ]
      : [];
  return { permissions: kept, dropped, warnings };
}

/** The folders every authored asset goes into, from Settings. */
function defaultFolderIds(): string[] {
  const value = settingsStore.get('authoring.defaultFolderIds');
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
}

/**
 * File a new asset in its folders. A folder that refuses (gone, no access)
 * is a warning, not a failed create: the asset exists either way.
 */
export async function fileInFolders(
  quickSight: {
    createFolderMembership: (
      folderId: string,
      assetId: string,
      memberType: any
    ) => Promise<unknown>;
  },
  folderIds: string[],
  assetId: string,
  assetType: AuthorableAssetType
): Promise<{ filed: string[]; warnings: string[] }> {
  const filed: string[] = [];
  const warnings: string[] = [];
  for (const folderId of folderIds) {
    try {
      await quickSight.createFolderMembership(
        folderId,
        assetId,
        assetType === 'dashboard' ? 'DASHBOARD' : 'ANALYSIS'
      );
      filed.push(folderId);
    } catch (error: any) {
      logger.warn('Filing an authored asset failed', { folderId, assetId, error });
      warnings.push(
        `It could not be filed in folder ${folderId}: ${error?.message ?? 'unknown error'}.`
      );
    }
  }
  return { filed, warnings };
}

/**
 * The audience for a new asset: what it inherits (permissionsFrom or a
 * template), plus the creator as owner, filed in the request's folder and
 * the default folders.
 */
export async function audienceFor(
  assetType: AuthorableAssetType,
  inherited: any[] | undefined,
  auth: AuthContext | undefined,
  requestFolderId?: string
): Promise<Audience> {
  const owner = await quickSightUserFor(auth?.email);
  const folderIds = [
    ...new Set([...(requestFolderId ? [requestFolderId] : []), ...defaultFolderIds()]),
  ];
  const permissions = owner ? withOwner(inherited, owner.arn, assetType) : inherited;
  const warnings: string[] = [];
  if (!owner && auth?.email && !auth.apiKey) {
    warnings.push(
      `No QuickSight user has the email ${auth.email}, so you were not made an owner; ask an admin to add you, or share it from Assets.`
    );
  }
  if (!permissions?.length && folderIds.length === 0) {
    warnings.push(
      'Only account admins will see this: nothing gave it an audience. Set default folders in Settings (Authored assets), or give it permissionsFrom.'
    );
  }
  return { permissions, folderIds, ...(owner ? { owner } : {}), warnings };
}
