/**
 * What the portal holds after its exports: live and archived assets by
 * type, field totals and when the catalog last changed. Counted from the
 * catalog on each call, so it can never disagree with it.
 */
import type { AssetType } from '../../../shared/models/asset.model';
import { catalog } from '../../../shared/services/catalog/catalogStore';
import { readFields } from '../../../shared/services/catalog/fieldCache';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';

type TypeCounts = Record<(typeof ASSET_TYPES_PLURAL)[AssetType], number>;

export interface ExportSummary {
  totalAssets: number;
  exportedAssets: number;
  lastExportDate: string | null;
  exportInProgress: boolean;
  needsInitialExport: boolean;
  assetTypeCounts: TypeCounts;
  archivedAssetCounts: TypeCounts & { total: number };
  fieldStatistics: {
    totalFields: number;
    totalCalculatedFields: number;
    totalUniqueFields: number;
  } | null;
}

const TYPES = Object.values(ASSET_TYPES) as AssetType[];

const byPlural = (counts: Partial<Record<AssetType, number>>): TypeCounts =>
  Object.fromEntries(TYPES.map((t) => [ASSET_TYPES_PLURAL[t], counts[t] ?? 0])) as TypeCounts;

const sum = (counts: TypeCounts) => Object.values(counts).reduce((a, b) => a + b, 0);

export async function exportSummary(): Promise<ExportSummary> {
  const [live, archived, fields, updated] = await Promise.all([
    catalog.counts(AssetStatusFilter.ACTIVE),
    catalog.counts(AssetStatusFilter.ARCHIVED),
    readFields({}),
    Promise.all(TYPES.map((t) => catalog.updatedAt(t))),
  ]);
  const assetTypeCounts = byPlural(live);
  const archivedAssetCounts = byPlural(archived);
  const totalAssets = sum(assetTypeCounts);
  const lastExportDate =
    updated
      .filter((d): d is string => !!d)
      .sort()
      .at(-1) ?? null;
  const calculated = fields.filter((f) => f.isCalculated).length;
  return {
    totalAssets,
    exportedAssets: totalAssets,
    lastExportDate,
    exportInProgress: false,
    needsInitialExport: lastExportDate === null,
    assetTypeCounts,
    archivedAssetCounts: { ...archivedAssetCounts, total: sum(archivedAssetCounts) },
    fieldStatistics:
      fields.length === 0
        ? null
        : {
            totalFields: fields.length,
            totalCalculatedFields: calculated,
            totalUniqueFields: fields.length - calculated,
          },
  };
}
