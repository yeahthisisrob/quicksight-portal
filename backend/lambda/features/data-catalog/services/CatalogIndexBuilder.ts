/**
 * CatalogIndexBuilder
 *
 * Builds and persists the pre-computed catalog index (catalog/catalog-index.json).
 * The index groups the flat field cache by field name, bakes in calculated-field
 * expression analysis (references, comments, length), and computes reverse
 * lineage. Serving a catalog page then becomes a cheap scope-filter +
 * re-aggregation over the per-source rows (see CatalogService).
 *
 * VSA: all catalog-specific logic lives in this slice. Only generic S3 access is
 * borrowed from the shared layer via ClientFactory.
 */
import { type FieldInfo } from '../../../shared/services/cache/types';
import { logger } from '../../../shared/utils/logger';
import { extractFieldReferences, expressionLength, hasComments } from '../lib/expressionAnalysis';
import { type CatalogIndex, type IndexedCatalogField, type IndexedFieldSource } from '../types';

const CATALOG_INDEX_KEY = 'catalog/catalog-index.json';
const CATALOG_INDEX_VERSION = '1';

export class CatalogIndexBuilder {
  /**
   * Build the catalog index from the flat field cache.
   * Pure transform (no I/O) so it is trivially unit-testable.
   */
  public build(fieldInfos: FieldInfo[]): CatalogIndex {
    const fieldMap = new Map<string, IndexedCatalogField>();

    for (const field of fieldInfos) {
      if (!field?.fieldName) {
        continue;
      }

      const source = this.toIndexedSource(field);

      const existing = fieldMap.get(field.fieldName);
      if (existing) {
        existing.perSource.push(source);
        // Keep the first non-empty description / tags we encounter.
        if (!existing.description && field.description) {
          existing.description = field.description;
        }
        if ((!existing.tags || existing.tags.length === 0) && field.tags?.length) {
          existing.tags = field.tags;
        }
      } else {
        fieldMap.set(field.fieldName, {
          fieldName: field.fieldName,
          description: field.description || '',
          tags: field.tags || [],
          perSource: [source],
        });
      }
    }

    const fields = Array.from(fieldMap.values());
    const lineage = this.buildReverseLineage(fields);

    return {
      version: CATALOG_INDEX_VERSION,
      builtAt: new Date().toISOString(),
      fields,
      lineage,
      summary: {
        totalDistinctFields: fields.length,
        builtFromFieldCount: fieldInfos.length,
      },
    };
  }

  /**
   * Load the index from S3. Returns null when missing/unavailable so callers can
   * fall back to an on-demand build.
   */
  public async load(): Promise<CatalogIndex | null> {
    try {
      const bucketName = process.env.BUCKET_NAME;
      if (!bucketName) {
        return null;
      }
      const { ClientFactory } = await import('../../../shared/services/aws/ClientFactory');
      const s3Service = ClientFactory.getS3Service();
      const data = await s3Service.getObject<CatalogIndex>(bucketName, CATALOG_INDEX_KEY);
      if (!data || !Array.isArray(data.fields)) {
        return null;
      }
      return data;
    } catch {
      // Index does not exist yet (e.g. first deploy before a rebuild) - normal.
      return null;
    }
  }

  /**
   * Persist the index to S3. Best-effort: failures are logged, not thrown, so a
   * persistence hiccup never breaks the export/rebuild pipeline.
   */
  public async persist(index: CatalogIndex): Promise<void> {
    try {
      const bucketName = process.env.BUCKET_NAME;
      if (!bucketName) {
        logger.warn('No BUCKET_NAME configured, skipping catalog index persist');
        return;
      }
      const { ClientFactory } = await import('../../../shared/services/aws/ClientFactory');
      const s3Service = ClientFactory.getS3Service();
      await s3Service.putObject(bucketName, CATALOG_INDEX_KEY, index);
      logger.info('Catalog index persisted', {
        distinctFields: index.summary.totalDistinctFields,
        builtFromFieldCount: index.summary.builtFromFieldCount,
      });
    } catch (error) {
      logger.error('Failed to persist catalog index', { error });
    }
  }

  /**
   * For each field, collect the names of calculated fields that reference it.
   * Scope-independent (covers all sources); the serve layer can present it as-is.
   */
  private buildReverseLineage(fields: IndexedCatalogField[]): Record<string, string[]> {
    const usedBy = new Map<string, Set<string>>();

    for (const field of fields) {
      const refs = new Set<string>();
      for (const source of field.perSource) {
        for (const ref of source.fieldReferences || []) {
          refs.add(ref);
        }
      }
      for (const ref of refs) {
        let dependents = usedBy.get(ref);
        if (!dependents) {
          dependents = new Set<string>();
          usedBy.set(ref, dependents);
        }
        dependents.add(field.fieldName);
      }
    }

    const lineage: Record<string, string[]> = {};
    for (const [fieldName, dependents] of usedBy.entries()) {
      lineage[fieldName] = Array.from(dependents).sort();
    }
    return lineage;
  }

  private toIndexedSource(field: FieldInfo): IndexedFieldSource {
    const source: IndexedFieldSource = {
      assetType: field.sourceAssetType,
      assetId: field.sourceAssetId,
      assetName: field.sourceAssetName,
      datasetId: field.datasetId,
      datasetName: field.datasetName,
      dataType: field.dataType || 'STRING',
      lastUpdated: field.lastUpdated || new Date().toISOString(),
      isCalculated: !!field.isCalculated,
    };

    if (field.isCalculated && field.expression) {
      source.expression = field.expression;
      source.expressionLength = expressionLength(field.expression);
      source.hasComments = hasComments(field.expression);
      source.fieldReferences = extractFieldReferences(field.expression, field.fieldName);
    }

    return source;
  }
}

export const catalogIndexBuilder = new CatalogIndexBuilder();
