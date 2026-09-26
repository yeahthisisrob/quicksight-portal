/**
 * Where a calculated field is used, flattened for a table.
 *
 * The detail endpoint answers two lists — the dashboards and analyses that
 * read the field, and the visuals inside them — which is the right shape for
 * an API and the wrong one for a reader: an asset with forty visuals buried
 * the one without any. One row per place the field actually appears puts them
 * on the same footing, sorts, filters and counts as one, and is what lets the
 * table stay a table at a thousand rows.
 */
import type { FieldUsedIn, FieldVisualUsage } from '@/shared/api/modules/data-catalog';

export interface FieldUsageRow {
  id: string;
  assetType: 'dashboard' | 'analysis';
  assetId: string;
  assetName: string;
  sheetName: string;
  visualName: string;
  /** False when the asset reads the field but no visual was identified. */
  inVisual: boolean;
}

interface FieldUsageSummary {
  dashboards: number;
  analyses: number;
  visuals: number;
  /** Assets that read the field without a visual naming it. */
  withoutVisual: number;
}

export function usageRows(usedIn: FieldUsedIn[], visuals: FieldVisualUsage[]): FieldUsageRow[] {
  const withVisuals = new Set(visuals.map((v) => v.assetId));
  const rows: FieldUsageRow[] = visuals.map((visual) => ({
    id: `${visual.assetId}:${visual.visualId}`,
    assetType: visual.assetType,
    assetId: visual.assetId,
    assetName: visual.assetName,
    sheetName: visual.sheetName ?? '',
    visualName: visual.visualName,
    inVisual: true,
  }));
  for (const asset of usedIn) {
    if (withVisuals.has(asset.assetId)) {
      continue;
    }
    rows.push({
      id: asset.assetId,
      assetType: asset.assetType,
      assetId: asset.assetId,
      assetName: asset.assetName,
      sheetName: '',
      visualName: '',
      inVisual: false,
    });
  }
  return rows.sort(
    (a, b) =>
      a.assetName.localeCompare(b.assetName) ||
      a.sheetName.localeCompare(b.sheetName) ||
      a.visualName.localeCompare(b.visualName)
  );
}

export function summarizeUsage(rows: FieldUsageRow[]): FieldUsageSummary {
  const assets = new Map<string, FieldUsageRow['assetType']>();
  let visuals = 0;
  let withoutVisual = 0;
  for (const row of rows) {
    assets.set(row.assetId, row.assetType);
    if (row.inVisual) {
      visuals += 1;
    } else {
      withoutVisual += 1;
    }
  }
  const types = [...assets.values()];
  return {
    dashboards: types.filter((t) => t === 'dashboard').length,
    analyses: types.filter((t) => t === 'analysis').length,
    visuals,
    withoutVisual,
  };
}

/** Free-text match over the asset, the sheet and the visual. */
export function filterUsage(rows: FieldUsageRow[], search: string): FieldUsageRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return rows;
  }
  return rows.filter((row) =>
    `${row.assetName} ${row.sheetName} ${row.visualName}`.toLowerCase().includes(needle)
  );
}
