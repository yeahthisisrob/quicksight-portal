/**
 * A catalog entry from an asset's export document: the one way an entry is
 * built, whether the asset is stored alone or in a collection (users,
 * groups, folders), live or archived. Pure: the caller reads the document.
 */
import * as mappers from '../../mappers/quicksight.mapper';
import type { AssetType, CatalogEntry } from '../../models/asset.model';
import { getAssetName } from '../../models/quicksight-domain.model';
import { ASSET_TYPES, ASSET_TYPES_PLURAL, isCollectionType } from '../../types/assetTypes';
import { pascalToCamel } from '../../utils/caseConverter';
import { determinePrincipalType } from '../../utils/permissions';
import type { AssetParserService } from '../parsing/AssetParserService';
import { PARSER_METADATA_VERSION } from '../parsing/parserVersion';

export type EntryState = 'live' | 'archived';

/** Where an asset's export document lives. */
export function exportFilePath(assetType: AssetType, assetId: string, state: EntryState): string {
  const root = state === 'archived' ? 'archived' : 'assets';
  return isCollectionType(assetType)
    ? `${root}/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
    : `${root}/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;
}

/** The export's list summary in the domain's shape (the SDK's is PascalCase and per type). */
function withDomainSummary(assetType: AssetType, document: any): any {
  const summary = document?.apiResponses?.list?.data;
  if (!summary) return document;
  const toDomain: Partial<Record<AssetType, (s: any) => any>> = {
    [ASSET_TYPES.dashboard]: mappers.mapSDKDashboardSummaryToDomain,
    [ASSET_TYPES.analysis]: mappers.mapSDKAnalysisSummaryToDomain,
    [ASSET_TYPES.dataset]: mappers.mapSDKDataSetSummaryToDomain,
    [ASSET_TYPES.datasource]: mappers.mapSDKDataSourceSummaryToDomain,
    [ASSET_TYPES.folder]: mappers.mapSDKFolderSummaryToDomain,
    [ASSET_TYPES.user]: mappers.mapSDKUserSummaryToDomain,
    [ASSET_TYPES.group]: mappers.mapSDKGroupSummaryToDomain,
  };
  const map = toDomain[assetType];
  return map
    ? {
        ...document,
        apiResponses: {
          ...document.apiResponses,
          list: { ...document.apiResponses.list, data: map(summary) },
        },
      }
    : document;
}

/**
 * Permissions as the catalog keeps them: principal, its kind, actions. A
 * dashboard's API answer is an object with link-sharing permissions beside
 * the rest; other types answer with a list.
 */
function catalogPermissions(permissions: any): CatalogEntry['permissions'] {
  const list: any[] = Array.isArray(permissions)
    ? permissions
    : permissions && typeof permissions === 'object'
      ? [
          ...(Array.isArray(permissions.permissions) ? permissions.permissions : []),
          ...(Array.isArray(permissions.linkSharingConfiguration?.permissions)
            ? permissions.linkSharingConfiguration.permissions
            : []),
        ]
      : [];
  return list.map((permission) => ({
    principal: permission.principal || '',
    principalType: determinePrincipalType(permission.principal || ''),
    actions: permission.actions || [],
  }));
}

const dateOr = (value: unknown, fallback: Date): Date =>
  value ? new Date(value as string) : fallback;

/** The entry for one export document, or null when its metadata cannot be read. */
export function catalogEntryFromExport(
  parser: AssetParserService,
  assetType: AssetType,
  assetKey: string,
  document: any,
  state: EntryState,
  now: Date = new Date()
): CatalogEntry | null {
  const transformed = pascalToCamel(withDomainSummary(assetType, document));
  const metadata = parser.extractMetadata(assetType, document, transformed);
  if (!metadata) return null;
  const enrichmentStatus = parser.determineEnrichmentStatus(document);
  const exportTime = document?.apiResponses?.list?.timestamp;
  const assetId = metadata.assetId || assetKey;
  return {
    assetId,
    assetType,
    assetName: getAssetName(transformed.apiResponses?.list?.data || metadata),
    arn: metadata.arn || '',
    status: state === 'archived' ? 'archived' : 'active',
    lastUpdatedTime: dateOr(metadata.lastUpdatedTime, now),
    createdTime: dateOr(metadata.createdTime, now),
    exportedAt: dateOr(exportTime, now),
    enrichmentStatus,
    enrichmentTimestamps: parser.extractEnrichmentTimestamps(document),
    tags: transformed.apiResponses?.tags?.data || [],
    permissions: catalogPermissions(transformed.apiResponses?.permissions?.data),
    metadata: {
      ...metadata,
      parserVersion: PARSER_METADATA_VERSION,
      enrichmentStatus,
      exportTime,
      ...(state === 'archived' && document?.archivedMetadata
        ? { archived: document.archivedMetadata }
        : {}),
    },
    exportFilePath: exportFilePath(assetType, assetKey, state),
    storageType: isCollectionType(assetType) ? 'collection' : 'individual',
  };
}

/**
 * An export that only refreshed permissions or tags keeps what the last full
 * export found (definition, lineage, fields) and takes only what it read.
 */
export function mergeMetadataOnlyExport(
  existing: CatalogEntry | undefined,
  fresh: CatalogEntry
): CatalogEntry {
  const metadataOnly =
    fresh.enrichmentStatus === 'metadata-update' || fresh.enrichmentStatus === 'skeleton';
  const hasFuller =
    existing?.enrichmentStatus === 'enriched' || existing?.enrichmentStatus === 'partial';
  if (!metadataOnly || !existing || !hasFuller) return fresh;
  return {
    ...existing,
    permissions: fresh.permissions.length > 0 ? fresh.permissions : existing.permissions,
    tags: fresh.tags.length > 0 ? fresh.tags : existing.tags,
    exportedAt: fresh.exportedAt,
    enrichmentTimestamps: { ...existing.enrichmentTimestamps, ...fresh.enrichmentTimestamps },
  };
}
