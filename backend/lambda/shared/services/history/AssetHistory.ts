/**
 * Every version of a dashboard, analysis or dataset the portal has seen:
 * one row in the portal table per change (when, who, what changed, in
 * words) and the definition itself as an object in the bucket under
 * `history/`. A version is kept only when the definition's hash moved, so
 * an export that found nothing changed adds nothing, and the history reads
 * as a list of edits.
 *
 * Who made a change is known when the portal made it (the authoring write
 * hands its actor and change list down to the refresh that records the
 * version); a change an export finds was made outside the portal, and says
 * so. Retention is a count per asset (Settings › History).
 */
import { randomBytes } from 'node:crypto';

import { metadataBucketName } from '../../config/metadataBucket';
import { logger } from '../../utils/logger';
import { sanitizeS3Key } from '../../utils/s3KeyUtils';
import { S3Service } from '../aws/S3Service';
import { settingsStore } from '../settings/SettingsStore';
import { type AssetVersionRow, type AssetVersionSource, portal } from '../store/portalTable';
import { type DefinitionDiff, diffDefinitions } from './definitionDiff';
import {
  type DefinitionSnapshot,
  definitionHash,
  type VersionedAssetType,
} from './definitionSnapshot';

export interface AssetVersion {
  assetType: VersionedAssetType;
  assetId: string;
  versionId: string;
  at: string;
  name: string;
  hash: string;
  source: AssetVersionSource;
  by: string;
  action?: string;
  summary: string;
  changes: string[];
  previousVersionId?: string;
  quickSightVersion?: number;
  size: number;
}

/** The object kept in the bucket for a version. */
export interface StoredSnapshot {
  assetType: VersionedAssetType;
  assetId: string;
  versionId: string;
  at: string;
  name: string;
  hash: string;
  definition: Record<string, unknown>;
}

/** Where a change came from, handed to the export that records it. */
export interface VersionProvenance {
  source: Exclude<AssetVersionSource, 'export'>;
  by: string;
  action?: string;
  /** What the portal changed, in its own words; wins over the computed lines. */
  changes?: string[];
}

/** The bucket operations the history needs; S3Service in production, a map in tests. */
export interface ObjectStore {
  putObject(bucket: string, key: string, body: unknown): Promise<unknown>;
  getObject<T = any>(bucket: string, key: string): Promise<T>;
  deleteObject(bucket: string, key: string): Promise<void>;
}

const PLURAL: Record<VersionedAssetType, string> = {
  dashboard: 'dashboards',
  analysis: 'analyses',
  dataset: 'datasets',
};

const MAX_LIST = 200;
const MAX_RECENT = 200;
const RANDOM_BYTES = 3;
/** Versions kept per asset when Settings says nothing. */
const DEFAULT_KEEP = 50;
/** Changes seen by an export were made outside the portal. */
export const SEEN_BY_EXPORT = 'Outside the portal';
/** "2026-10-15T07:15" is as fine as a version's moment needs to read. */
const MOMENT_LENGTH = 16;

/** A version's time as people read it: "2026-10-15 07:15". */
export function versionMoment(at: string): string {
  return at.slice(0, MOMENT_LENGTH).replace('T', ' ');
}

function rowToVersion(row: AssetVersionRow): AssetVersion {
  return {
    assetType: row.assetType as VersionedAssetType,
    assetId: row.assetId,
    versionId: row.versionId,
    at: row.at,
    name: row.name,
    hash: row.hash,
    source: row.source,
    by: row.by,
    ...(row.action ? { action: row.action } : {}),
    summary: row.summary,
    changes: row.changes ?? [],
    ...(row.previousVersionId ? { previousVersionId: row.previousVersionId } : {}),
    ...(typeof row.quickSightVersion === 'number'
      ? { quickSightVersion: row.quickSightVersion }
      : {}),
    size: row.size,
  };
}

/** How many versions of each asset Settings keeps. */
function versionsToKeep(): number {
  const raw = Number(settingsStore.get('history.keep'));
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_KEEP;
}

export class AssetHistory {
  public constructor(
    private readonly objects: ObjectStore,
    private readonly bucket: string
  ) {}

  public key(assetType: VersionedAssetType, assetId: string, versionId: string): string {
    return `history/${PLURAL[assetType]}/${sanitizeS3Key(assetId)}/${versionId}.json`;
  }

  /** Newest first. */
  public async list(
    assetType: VersionedAssetType,
    assetId: string,
    limit = MAX_LIST
  ): Promise<AssetVersion[]> {
    const { data } = await portal()
      .assetVersion.query.byAsset({ assetType, assetId })
      .go({ order: 'desc', limit: Math.min(limit, MAX_LIST) });
    return data.map(rowToVersion);
  }

  public async latest(
    assetType: VersionedAssetType,
    assetId: string
  ): Promise<AssetVersion | null> {
    const [first] = await this.list(assetType, assetId, 1);
    return first ?? null;
  }

  public async get(
    assetType: VersionedAssetType,
    assetId: string,
    versionId: string
  ): Promise<AssetVersion | null> {
    const { data } = await portal().assetVersion.get({ assetType, assetId, versionId }).go();
    return data ? rowToVersion(data) : null;
  }

  /** The version before this one in the asset's history, or null for the first. */
  public previous(version: AssetVersion): Promise<AssetVersion | null> {
    if (!version.previousVersionId) return Promise.resolve(null);
    return this.get(version.assetType, version.assetId, version.previousVersionId);
  }

  /** Every version across the account, newest first. */
  public async recent(limit = 50): Promise<AssetVersion[]> {
    const { data } = await portal()
      .assetVersion.query.byTime({ feed: 'all' })
      .go({ order: 'desc', limit: Math.min(limit, MAX_RECENT) });
    return data.map(rowToVersion);
  }

  public snapshot(
    assetType: VersionedAssetType,
    assetId: string,
    versionId: string
  ): Promise<StoredSnapshot> {
    return this.objects.getObject<StoredSnapshot>(
      this.bucket,
      this.key(assetType, assetId, versionId)
    );
  }

  /** The words and the paths between two versions (or from nothing to the first). */
  public diff(from: StoredSnapshot | null, to: StoredSnapshot): DefinitionDiff {
    return diffDefinitions(to.assetType, from?.definition ?? null, to.definition);
  }

  /**
   * Keep this snapshot as a version when it differs from the latest kept.
   * Returns the version kept, or null when nothing changed. Never throws
   * past a log line: a version is worth less than the export it rides on.
   */
  public async keep(input: {
    assetType: VersionedAssetType;
    assetId: string;
    snapshot: DefinitionSnapshot;
    provenance?: VersionProvenance;
    at?: string;
  }): Promise<AssetVersion | null> {
    const { assetType, assetId, snapshot } = input;
    const latest = await this.latest(assetType, assetId);
    if (latest && latest.hash === snapshot.hash) {
      return null;
    }
    const at = input.at ?? new Date().toISOString();
    const versionId = `${at.replace(/[-:.]/g, '')}-${randomBytes(RANDOM_BYTES).toString('hex')}`;
    const stored: StoredSnapshot = {
      assetType,
      assetId,
      versionId,
      at,
      name: snapshot.name,
      hash: snapshot.hash,
      definition: snapshot.definition,
    };
    const before = latest
      ? await this.snapshot(assetType, assetId, latest.versionId).catch(() => null)
      : null;
    const diff = diffDefinitions(assetType, before?.definition ?? null, snapshot.definition);
    const provenance = input.provenance;
    const changes = provenance?.changes?.length ? provenance.changes : diff.changes;
    await this.objects.putObject(this.bucket, this.key(assetType, assetId, versionId), stored);
    const row: AssetVersionRow = {
      assetType,
      assetId,
      versionId,
      at,
      name: snapshot.name,
      hash: snapshot.hash,
      source: provenance?.source ?? 'export',
      by: provenance?.by ?? SEEN_BY_EXPORT,
      ...(provenance?.action ? { action: provenance.action } : {}),
      summary: diff.summary,
      changes,
      ...(latest ? { previousVersionId: latest.versionId } : {}),
      ...(snapshot.quickSightVersion !== undefined
        ? { quickSightVersion: snapshot.quickSightVersion }
        : {}),
      size: Buffer.byteLength(JSON.stringify(stored)),
      feed: 'all',
    };
    await portal().assetVersion.put(row).go();
    await this.prune(assetType, assetId, versionsToKeep());
    return rowToVersion(row);
  }

  /** Drop the oldest versions past `keep`, rows and objects both. */
  public async prune(
    assetType: VersionedAssetType,
    assetId: string,
    keep: number
  ): Promise<number> {
    const all = await this.list(assetType, assetId, MAX_LIST);
    const extra = all.slice(keep);
    for (const version of extra) {
      await this.remove(version);
    }
    return extra.length;
  }

  public async remove(version: AssetVersion): Promise<void> {
    const { assetType, assetId, versionId } = version;
    try {
      await this.objects.deleteObject(this.bucket, this.key(assetType, assetId, versionId));
    } catch (error) {
      logger.warn('History: a version object could not be deleted', {
        assetType,
        assetId,
        versionId,
        error,
      });
    }
    await portal().assetVersion.delete({ assetType, assetId, versionId }).go();
  }

  /** The hash a definition would have, for comparing the live export document with a version. */
  public static hashOf(definition: unknown): string {
    return definitionHash(definition);
  }
}

let instance: AssetHistory | null = null;

/** The account's history, on the metadata bucket (one per process). */
export function assetHistory(): AssetHistory {
  if (!instance) {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    instance = new AssetHistory(new S3Service(accountId), metadataBucketName(accountId));
  }
  return instance;
}
