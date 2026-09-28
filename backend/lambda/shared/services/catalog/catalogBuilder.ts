/**
 * Builds catalog entries from the export documents in S3 and writes them
 * through the catalog store: a full rebuild, one type, or just the assets an
 * export touched. Reading S3 is the builder's; keys, revisions and
 * versions are the store's.
 */
import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../config/exportConfig';
import { metadataBucketName } from '../../config/metadataBucket';
import { TIME_UNITS } from '../../constants/timeConstants';
import type { AssetType, CatalogEntry } from '../../models/asset.model';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { ASSET_TYPES, ASSET_TYPES_PLURAL, isCollectionType } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { S3Service } from '../aws/S3Service';
import { AssetParserService } from '../parsing/AssetParserService';
import {
  catalogEntryFromExport,
  type EntryState,
  exportFilePath,
  mergeMetadataOnlyExport,
} from './catalogEntry';
import { resolveFolderPaths, resolveLineageNames } from './catalogResolve';
import { catalog } from './catalogStore';

/** Where a long build reports progress (an export job's log and heartbeat). */
export interface BuildProgress {
  appendLog(message: string, level: 'info' | 'warn' | 'error'): Promise<void>;
  checkpoint(): Promise<void>;
}

const ALL_TYPES = Object.values(ASSET_TYPES) as AssetType[];
const LINEAGE_TYPES = new Set<AssetType>([
  ASSET_TYPES.dashboard,
  ASSET_TYPES.analysis,
  ASSET_TYPES.dataset,
]);
/** Archived copies an earlier archive kept aside; never an asset of their own. */
const BACKUP_COPY = '-previous-archive-';

let s3: S3Service | null = null;
const s3Service = () => (s3 ??= new S3Service(process.env.AWS_ACCOUNT_ID || ''));
const parser = new AssetParserService();

const secondsSince = (started: number) => ((Date.now() - started) / TIME_UNITS.SECOND).toFixed(1);

/** Every export document of a type in one state, by asset key. */
async function readDocuments(assetType: AssetType, state: EntryState): Promise<Map<string, any>> {
  const bucket = metadataBucketName();
  if (isCollectionType(assetType)) {
    const collection = await s3Service()
      .getObject<Record<string, any>>(bucket, exportFilePath(assetType, '', state))
      .catch(() => null);
    return new Map(Object.entries(collection ?? {}));
  }
  const root = state === 'archived' ? 'archived' : 'assets';
  const objects = await s3Service()
    .listObjects(bucket, `${root}/${ASSET_TYPES_PLURAL[assetType]}/`)
    .catch(() => []);
  const keys = objects
    .map((o: { key: string }) => o.key)
    .filter((key: string) => key.endsWith('.json') && !key.includes(BACKUP_COPY))
    .map((key: string) =>
      key
        .split('/')
        .pop()!
        .replace(/\.json$/, '')
    );
  return await readIndividual(assetType, keys, state);
}

/** These assets' export documents (individual types), by key; a missing one is left out. */
async function readIndividual(
  assetType: AssetType,
  keys: string[],
  state: EntryState
): Promise<Map<string, any>> {
  const bucket = metadataBucketName();
  const limit = pLimit(EXPORT_CONFIG.catalogRebuild.maxConcurrentReads);
  const read = await Promise.all(
    keys.map((key) =>
      limit(async () => {
        const document = await s3Service()
          .getObject(bucket, exportFilePath(assetType, key, state))
          .catch(() => null);
        return [key, document] as const;
      })
    )
  );
  return new Map(read.filter(([, document]) => document));
}

function entriesFrom(
  assetType: AssetType,
  documents: Map<string, any>,
  state: EntryState
): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const [key, document] of documents) {
    const entry = catalogEntryFromExport(parser, assetType, key, document, state);
    if (entry) entries.push(entry);
    else logger.warn(`Could not read the metadata of ${state} ${assetType}/${key}`);
  }
  return entries;
}

/** A type's entries from its export documents, live and archived, keeping fuller data a metadata-only export lacks. */
async function buildType(assetType: AssetType, progress?: BuildProgress): Promise<CatalogEntry[]> {
  const [liveDocs, archivedDocs, existing] = await Promise.all([
    readDocuments(assetType, 'live'),
    readDocuments(assetType, 'archived'),
    catalog.list(assetType, AssetStatusFilter.ACTIVE),
  ]);
  await progress?.appendLog(
    `Found ${liveDocs.size} active and ${archivedDocs.size} archived ${assetType} assets`,
    'info'
  );
  const previous = new Map(existing.map((e) => [e.assetId, e]));
  return [
    ...entriesFrom(assetType, liveDocs, 'live').map((e) =>
      mergeMetadataOnlyExport(previous.get(e.assetId), e)
    ),
    ...entriesFrom(assetType, archivedDocs, 'archived'),
  ];
}

/** Folder paths and lineage names for these entries, looked up in every entry of the catalog. */
async function resolve(assetType: AssetType, entries: CatalogEntry[]): Promise<void> {
  if (assetType === ASSET_TYPES.folder) {
    resolveFolderPaths(entries, await catalog.list(ASSET_TYPES.folder, AssetStatusFilter.ALL));
  }
  if (LINEAGE_TYPES.has(assetType)) {
    const [datasets, datasources] = await Promise.all([
      assetType === ASSET_TYPES.dataset
        ? entries
        : catalog.list(ASSET_TYPES.dataset, AssetStatusFilter.ALL),
      catalog.list(ASSET_TYPES.datasource, AssetStatusFilter.ALL),
    ]);
    resolveLineageNames(entries, datasets, datasources);
  }
}

/** Rebuild one type's entries from its export documents. */
export async function rebuildCatalogType(
  assetType: AssetType,
  progress?: BuildProgress
): Promise<void> {
  const started = Date.now();
  const entries = await buildType(assetType, progress);
  await resolve(assetType, entries);
  await catalog.replaceType(assetType, entries);
  await progress?.appendLog(
    `Catalog for ${assetType}: ${entries.length} entries in ${secondsSince(started)}s`,
    'info'
  );
  await progress?.checkpoint();
}

/** Rebuild every type, resolving folder paths and lineage names across all of them. */
export async function rebuildCatalog(progress?: BuildProgress): Promise<void> {
  const started = Date.now();
  const built = new Map<AssetType, CatalogEntry[]>();
  for (const assetType of ALL_TYPES) {
    try {
      built.set(assetType, await buildType(assetType, progress));
      await progress?.checkpoint();
    } catch (error) {
      logger.warn(`Could not build the catalog for ${assetType}`, { error });
    }
  }
  const of = (t: AssetType) => built.get(t) ?? [];
  resolveFolderPaths(of(ASSET_TYPES.folder), of(ASSET_TYPES.folder));
  resolveLineageNames(
    [...of(ASSET_TYPES.dashboard), ...of(ASSET_TYPES.analysis), ...of(ASSET_TYPES.dataset)],
    of(ASSET_TYPES.dataset),
    of(ASSET_TYPES.datasource)
  );
  const limit = pLimit(EXPORT_CONFIG.catalogRebuild.maxConcurrentWrites);
  await Promise.all([...built].map(([t, entries]) => limit(() => catalog.replaceType(t, entries))));
  logger.info('Catalog rebuilt', {
    seconds: secondsSince(started),
    entries: Object.fromEntries([...built].map(([t, e]) => [t, e.length])),
  });
}

/**
 * Write the entries of just these assets from their export documents (what
 * an export or a refresh touched). A collection type is one document, so
 * the whole type is rebuilt from it.
 */
export async function upsertCatalogAssets(
  assetType: AssetType,
  assetIds: string[],
  progress?: BuildProgress
): Promise<void> {
  if (assetIds.length === 0) return;
  if (isCollectionType(assetType)) {
    await rebuildCatalogType(assetType, progress);
    return;
  }
  const [documents, existing] = await Promise.all([
    readIndividual(assetType, assetIds, 'live'),
    catalog.list(assetType, AssetStatusFilter.ACTIVE),
  ]);
  const previous = new Map(existing.map((e) => [e.assetId, e]));
  const entries = entriesFrom(assetType, documents, 'live').map((e) =>
    mergeMetadataOnlyExport(previous.get(e.assetId), e)
  );
  await resolve(assetType, entries);
  await catalog.put(entries);
  logger.info(`Upserted ${entries.length} ${assetType} catalog entries`, {
    requested: assetIds.length,
  });
}
