/** One time an archived asset was brought back, and as what. */
interface Restoration {
  restoredAt: string;
  restoredBy: string;
  restoredAs: string;
}

/** Why and when an asset was archived, and every restore since: the archive's ledger line. */
export interface ArchiveRecord {
  archivedAt: string;
  archiveReason?: string;
  archivedBy?: string;
  originalPath?: string;
  restorations?: Restoration[];
}

/**
 * Shared archive types for consistent archive handling across services
 */
import type { AssetType } from '../models/asset.model';

/**
 * Result of an archive operation
 */
export interface ArchiveResult {
  success: boolean;
  assetId: string;
  assetType: AssetType;
  originalPath: string;
  archivePath: string;
  archivedAt: string;
  error?: string;
}

/**
 * Archive statistics
 */
export interface ArchiveStats {
  totalArchived: number;
  totalSizeGB: number;
  byType: Record<AssetType, number>;
  oldestArchive: string;
  growthRateGB: number;
}
