/**
 * The field cache: every field and calculated field of every active
 * dataset, analysis and dashboard, flattened from the catalog into one
 * document (the data catalog and search read it whole). A projection of the
 * catalog: only rebuildFieldCache writes it, from the catalog.
 */
import type { AssetType } from '../../models/asset.model';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { ASSET_TYPES_WITH_FIELDS } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { cacheService } from '../cache/CacheService';
import { catalog } from './catalogStore';
import type { FieldInfo } from './fieldTypes';

const FIELD_CACHE_KEY = 'cache/field-cache.json';

/** Every field in the field cache, or only those matching the filter. */
export async function readFields(
  filter: {
    /** Text in the field's name, display name or description, any case. */
    query?: string;
    assetTypes?: AssetType[];
    dataType?: string;
    isCalculated?: boolean;
  } = {}
): Promise<FieldInfo[]> {
  const fields = (await cacheService.get<FieldInfo[]>(FIELD_CACHE_KEY)) ?? [];
  const query = filter.query?.toLowerCase();
  const matches = (text: string | undefined) => (text ?? '').toLowerCase().includes(query!);
  return fields.filter(
    (field) =>
      (!query ||
        matches(field.fieldName) ||
        matches(field.displayName) ||
        matches(field.description)) &&
      (!filter.assetTypes || filter.assetTypes.includes(field.sourceAssetType)) &&
      (!filter.dataType || field.dataType === filter.dataType) &&
      (filter.isCalculated === undefined || field.isCalculated === filter.isCalculated)
  );
}

/** Rebuild the field cache from the catalog's active assets. */
export async function rebuildFieldCache(): Promise<void> {
  const fields = new Map<string, FieldInfo>();
  for (const assetType of ASSET_TYPES_WITH_FIELDS) {
    for (const asset of await catalog.list(assetType, AssetStatusFilter.ACTIVE)) {
      const metadata = asset.metadata ?? {};
      const all = [
        ...(metadata.fields ?? []).map((f) => ({ ...f, isCalculated: false })),
        ...(metadata.calculatedFields ?? []).map((f) => ({ ...f, isCalculated: true })),
      ] as Array<Record<string, any>>;
      for (const field of all) {
        // Parsers disagree on the shape: a dataset's calculated fields arrive
        // as { name, expression }, a dashboard's in the full field shape.
        // A field with no name at all is skipped rather than keyed on undefined.
        const fieldName = field.fieldName || field.name;
        if (!fieldName) continue;
        const fieldId = field.fieldId || fieldName;
        fields.set(`${fieldId}:${asset.assetId}`, {
          fieldId,
          fieldName,
          displayName: field.displayName || fieldName,
          dataType: field.dataType,
          description: field.isCalculated ? '' : field.description || '',
          isCalculated: field.isCalculated,
          expression: field.isCalculated ? field.expression : undefined,
          sourceAssetType: assetType,
          sourceAssetId: asset.assetId,
          sourceAssetName: asset.assetName,
          datasetId: field.sourceDatasetId || (assetType === 'dataset' ? asset.assetId : undefined),
          datasetName:
            field.sourceDatasetName || (assetType === 'dataset' ? asset.assetName : undefined),
          columnName: field.isCalculated ? undefined : field.columnName || fieldName,
          dependencies: field.isCalculated ? field.dependencies || [] : [],
          usageCount: 0,
          analysisCount: 0,
          dashboardCount: 0,
          lastUpdated: asset.lastUpdatedTime.toISOString(),
          tags: asset.tags || [],
          ...(Array.isArray(field.visuals) && field.visuals.length
            ? { visuals: field.visuals }
            : {}),
        });
      }
    }
  }
  await cacheService.put(FIELD_CACHE_KEY, [...fields.values()], { compact: true });
  logger.info(`Field cache rebuilt: ${fields.size} fields`);
}
