/**
 * SmusCatalogService - the catalog, SMUS first.
 *
 * SMUS owns business metadata: glossary terms, metadata forms, descriptions,
 * the Glue table and its columns. The portal adds only what QuickSight knows
 * and SMUS cannot: which datasets read a published asset, their calculated
 * fields with expressions, lineage between fields, where each field is used
 * (down to the visual), conflicting definitions of the same calculated field
 * across assets, a portal-stored note for calculated fields, and the
 * template library.
 *
 * Everything is scoped to the SMUS projects selected in Settings, exactly as
 * Author is. Nothing outside those projects is listed.
 */

import type { SmusAsset } from '../../../features/smus/types';
import { ValidationError } from '../../../shared/errors/ValidationError';
import type { CacheService } from '../../../shared/services/cache/CacheService';
import type { FieldInfo } from '../../../shared/services/cache/types';
import type { SmusService } from '../../../shared/services/smus/SmusService';
import { logger } from '../../../shared/utils/logger';
import { canonicalExpression, extractFieldReferences } from '../lib/expressionAnalysis';
import {
  type CalculatedFieldTemplate,
  CalculatedFieldTemplateStore,
} from './CalculatedFieldTemplateStore';
import type { CatalogService } from './CatalogService';
import type { FieldMetadata, FieldMetadataService } from './FieldMetadataService';

export interface FieldUsedIn {
  assetType: 'dashboard' | 'analysis';
  assetId: string;
  assetName: string;
}

export interface FieldVisualUsage extends FieldUsedIn {
  sheetName?: string;
  visualId: string;
  visualName: string;
}

export interface DatasetCatalogField {
  name: string;
  dataType: string;
  isCalculated: boolean;
  expression?: string;
  references: string[];
  usedBy: string[];
  usage: { dashboards: number; analyses: number };
  usedIn: FieldUsedIn[];
  visuals?: FieldVisualUsage[];
  conflict?: { count: number; variants: Array<{ expression: string; sources: FieldUsedIn[] }> };
  smus?: { listingId: string; columnName: string; description?: string; url?: string };
  portal?: { description?: string; tags?: string[]; category?: string; sensitivity?: string };
  template?: { id: string };
}

export interface CatalogDataset {
  id: string;
  name: string;
  matchType: SmusAsset['datasets'][number]['matchType'];
  importMode?: string;
  calculatedFieldCount: number;
  fields: DatasetCatalogField[];
}

export interface SmusCatalogAssetSummary {
  listingId: string;
  assetId: string;
  name: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  url?: string;
  table?: SmusAsset['table'];
  glossaryTerms: SmusAsset['glossaryTerms'];
  columnCount: number;
  datasets: SmusAsset['datasets'];
  calculatedFieldCount: number;
  usage: { dashboards: number; analyses: number };
  updatedAt?: string;
}

export interface SmusCatalogAsset extends SmusCatalogAssetSummary {
  forms: SmusAsset['forms'];
  columns: NonNullable<SmusAsset['columns']>;
  datasets: CatalogDataset[];
}

export interface SmusCatalog {
  configured: boolean;
  projectFilter: string[];
  projects: Array<{ id: string; name: string; count: number }>;
  glossaryTerms: Array<{ name: string; shortDescription?: string; count: number }>;
  assets: SmusCatalogAssetSummary[];
}

export interface CatalogFilters {
  search?: string;
  term?: string;
  projectId?: string;
}

/** Everything QuickSight-side, indexed once per request. */
interface FieldIndex {
  /** dataset id -> its own field entries */
  byDataset: Map<string, FieldInfo[]>;
  /** `${datasetId}::${fieldName}` -> dashboard/analysis entries that use it */
  usersOf: Map<string, FieldInfo[]>;
  /** `${datasetId}::${fieldName}` -> visuals reading it */
  visualsOf: Map<string, FieldVisualUsage[]>;
  /** `${sourceId}::${fieldName}` -> portal note */
  notes: Map<string, FieldMetadata>;
  /** normalised expression -> template id */
  templates: Map<string, string>;
}

const VISUALS_CACHE_TTL_MS = 60_000;

export class SmusCatalogService {
  private static visualsCache: { expiresAt: number; promise: Promise<FieldVisualUsage[]> } | null =
    null;

  public constructor(
    private readonly smusService: SmusService,
    private readonly cacheService: CacheService,
    private readonly catalogService: CatalogService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly templateStore: CalculatedFieldTemplateStore = new CalculatedFieldTemplateStore()
  ) {}

  public async list(filters: CatalogFilters = {}): Promise<SmusCatalog> {
    const result = await this.smusService.listAssets(filters.search);
    if (!result.configured) {
      return { configured: false, projectFilter: [], projects: [], glossaryTerms: [], assets: [] };
    }

    const index = await this.buildFieldIndex();
    const all = result.assets.map((asset) => this.summarize(asset, index));

    const projects = countBy(
      all.filter((a) => a.projectId),
      (a) => a.projectId as string,
      (a) => a.projectName ?? (a.projectId as string)
    );
    const inProject = filters.projectId
      ? all.filter((a) => a.projectId === filters.projectId)
      : all;
    const glossaryTerms = countTerms(inProject);
    const assets = filters.term
      ? inProject.filter((a) => a.glossaryTerms.some((t) => t.name === filters.term))
      : inProject;

    return {
      configured: true,
      projectFilter: result.projectFilter,
      projects,
      glossaryTerms,
      assets,
    };
  }

  public async get(listingId: string): Promise<SmusCatalogAsset> {
    const result = await this.smusService.listAssets();
    if (!result.configured) {
      throw new ValidationError('SMUS is not configured');
    }
    const asset = result.assets.find((a) => a.listingId === listingId);
    if (!asset) {
      throw Object.assign(
        new ValidationError(`No published asset '${listingId}' in the selected projects`),
        {
          statusCode: 404,
        }
      );
    }
    const index = await this.buildFieldIndex();
    return {
      ...this.summarize(asset, index),
      forms: asset.forms,
      columns: asset.columns ?? [],
      datasets: asset.datasets.map((d) => this.describeDataset(d, asset, index)),
    };
  }

  // ---------------------------------------------------------------------------

  private summarize(asset: SmusAsset, index: FieldIndex): SmusCatalogAssetSummary {
    let calculated = 0;
    let dashboards = 0;
    let analyses = 0;
    for (const dataset of asset.datasets) {
      const fields = index.byDataset.get(dataset.id) ?? [];
      calculated += fields.filter((f) => f.isCalculated).length;
      for (const f of fields) {
        dashboards += f.dashboardCount ?? 0;
        analyses += f.analysisCount ?? 0;
      }
    }
    return {
      listingId: asset.listingId,
      assetId: asset.assetId,
      name: asset.name,
      description: asset.description,
      projectId: asset.projectId,
      projectName: asset.projectName,
      url: asset.url,
      table: asset.table,
      glossaryTerms: asset.glossaryTerms,
      columnCount: asset.columns?.length ?? 0,
      datasets: asset.datasets,
      calculatedFieldCount: calculated,
      usage: { dashboards, analyses },
      updatedAt: asset.createdAt,
    };
  }

  private describeDataset(
    dataset: SmusAsset['datasets'][number],
    asset: SmusAsset,
    index: FieldIndex
  ): CatalogDataset {
    const own = index.byDataset.get(dataset.id) ?? [];
    const calculatedByName = new Map(
      own.filter((f) => f.isCalculated).map((f) => [f.fieldName, f])
    );
    const referencesOf = new Map<string, string[]>();
    for (const [name, field] of calculatedByName) {
      referencesOf.set(name, extractFieldReferences(field.expression ?? ''));
    }
    const columnsByName = new Map(
      (asset.columns ?? []).map((c) => [c.name.toLowerCase(), c] as const)
    );

    const fields = own
      .map<DatasetCatalogField>((field) => {
        const key = `${dataset.id}::${field.fieldName}`;
        const users = index.usersOf.get(key) ?? [];
        const usedIn = dedupeUsers(users);
        const references = referencesOf.get(field.fieldName) ?? [];
        const usedBy = [...calculatedByName.keys()].filter(
          (name) =>
            name !== field.fieldName && (referencesOf.get(name) ?? []).includes(field.fieldName)
        );
        const out: DatasetCatalogField = {
          name: field.fieldName,
          dataType: field.dataType,
          isCalculated: field.isCalculated,
          expression: field.isCalculated ? field.expression : undefined,
          references,
          usedBy,
          usage: {
            dashboards: usedIn.filter((u) => u.assetType === 'dashboard').length,
            analyses: usedIn.filter((u) => u.assetType === 'analysis').length,
          },
          usedIn,
        };
        const visuals = index.visualsOf.get(key);
        if (visuals && visuals.length > 0) {
          out.visuals = visuals;
        }
        if (field.isCalculated) {
          const conflict = conflictsFor(field, users);
          if (conflict) {
            out.conflict = conflict;
          }
          const note = index.notes.get(`${dataset.id}::${field.fieldName}`);
          if (note) {
            out.portal = {
              description: note.description,
              tags: note.tags,
              category: note.category,
              sensitivity: note.sensitivity,
            };
          }
          const templateId = index.templates.get(canonicalExpression(field.expression));
          if (templateId) {
            out.template = { id: templateId };
          }
        } else {
          const column = columnsByName.get((field.columnName ?? field.fieldName).toLowerCase());
          if (column) {
            out.smus = {
              listingId: asset.listingId,
              columnName: column.name,
              description: column.description,
              url: asset.url,
            };
          }
        }
        return out;
      })
      .sort(
        (a, b) => Number(b.isCalculated) - Number(a.isCalculated) || a.name.localeCompare(b.name)
      );

    return {
      id: dataset.id,
      name: dataset.name,
      matchType: dataset.matchType,
      calculatedFieldCount: fields.filter((f) => f.isCalculated).length,
      fields,
    };
  }

  private async buildFieldIndex(): Promise<FieldIndex> {
    const [fields, notes, templates, visuals] = await Promise.all([
      this.cacheService.searchFields({}) as Promise<FieldInfo[]>,
      this.fieldMetadataService.getAllFieldMetadata({ sourceType: 'dataset' }).catch((error) => {
        logger.warn('Field notes unavailable', { error });
        return [] as FieldMetadata[];
      }),
      this.templateStore.list().catch((error) => {
        logger.warn('Template library unavailable', { error });
        return [] as CalculatedFieldTemplate[];
      }),
      this.loadVisuals(),
    ]);

    const byDataset = new Map<string, FieldInfo[]>();
    const usersOf = new Map<string, FieldInfo[]>();
    for (const field of fields) {
      if (field.sourceAssetType === 'dataset') {
        push(byDataset, field.sourceAssetId, field);
      } else if (
        (field.sourceAssetType === 'dashboard' || field.sourceAssetType === 'analysis') &&
        field.datasetId
      ) {
        push(usersOf, `${field.datasetId}::${field.fieldName}`, field);
      }
    }

    // The visual-field catalog names the owning asset by id only; the field
    // index says whether that id is a dashboard or an analysis.
    const assetTypes = new Map<string, 'dashboard' | 'analysis'>();
    for (const field of fields) {
      if (field.sourceAssetType === 'dashboard' || field.sourceAssetType === 'analysis') {
        assetTypes.set(field.sourceAssetId, field.sourceAssetType);
      }
    }
    const visualsOf = new Map<string, FieldVisualUsage[]>();
    for (const visual of visuals) {
      const assetType = assetTypes.get(visual.assetId) ?? visual.assetType;
      const typed = { ...visual, assetType };
      for (const datasetId of visualDatasetIds(typed, fields)) {
        const { fieldName: _fieldName, ...usage } = typed;
        push(visualsOf, `${datasetId}::${visual.fieldName}`, usage);
      }
    }

    return {
      byDataset,
      usersOf,
      visualsOf,
      notes: new Map(notes.map((n) => [`${n.sourceId}::${n.fieldName}`, n])),
      templates: CalculatedFieldTemplateStore.indexByExpression(templates),
    };
  }

  /** Visual-level usage from the visual-field catalog, cached per container. */
  private loadVisuals(): Promise<Array<FieldVisualUsage & { fieldName: string }>> {
    const cached = SmusCatalogService.visualsCache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise as Promise<Array<FieldVisualUsage & { fieldName: string }>>;
    }
    const promise = this.catalogService
      .buildVisualFieldCatalog()
      .then((catalog) =>
        catalog.visualFields.map((v) => ({
          assetType: 'dashboard' as const,
          assetId: v.dashboardId,
          assetName: v.dashboardName,
          sheetName: v.sheetName,
          visualId: v.visualId,
          visualName: v.visualName,
          fieldName: v.fieldName,
        }))
      )
      .catch((error) => {
        logger.warn('Visual-field catalog unavailable; visual usage omitted', { error });
        SmusCatalogService.visualsCache = null;
        return [] as Array<FieldVisualUsage & { fieldName: string }>;
      });
    SmusCatalogService.visualsCache = { expiresAt: Date.now() + VISUALS_CACHE_TTL_MS, promise };
    return promise;
  }
}

// -----------------------------------------------------------------------------

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

function dedupeUsers(users: FieldInfo[]): FieldUsedIn[] {
  const seen = new Set<string>();
  const out: FieldUsedIn[] = [];
  for (const u of users) {
    const key = `${u.sourceAssetType}:${u.sourceAssetId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      assetType: u.sourceAssetType as 'dashboard' | 'analysis',
      assetId: u.sourceAssetId,
      assetName: u.sourceAssetName,
    });
  }
  return out.sort((a, b) => a.assetName.localeCompare(b.assetName));
}

/**
 * The same calculated field redefined with a different expression in a
 * dashboard or analysis. The dataset's expression is the reference; only
 * differing variants are reported, grouped by normalised expression.
 */
function conflictsFor(
  own: FieldInfo,
  users: FieldInfo[]
): DatasetCatalogField['conflict'] | undefined {
  const reference = canonicalExpression(own.expression);
  const variants = new Map<string, { expression: string; sources: FieldInfo[] }>();
  for (const u of users) {
    if (!u.isCalculated || !u.expression) {
      continue;
    }
    const key = canonicalExpression(u.expression);
    if (key === reference) {
      continue;
    }
    const entry = variants.get(key) ?? { expression: u.expression, sources: [] };
    entry.sources.push(u);
    variants.set(key, entry);
  }
  if (variants.size === 0) {
    return undefined;
  }
  return {
    count: variants.size + 1,
    variants: [...variants.values()].map((v) => ({
      expression: v.expression,
      sources: dedupeUsers(v.sources),
    })),
  };
}

/**
 * The visual-field catalog knows the dashboard and field name but not the
 * dataset; resolve it through the dashboard's own field entries.
 */
function visualDatasetIds(
  visual: { assetId: string; assetType: string; fieldName: string },
  fields: FieldInfo[]
): string[] {
  const ids = new Set<string>();
  for (const f of fields) {
    if (
      f.sourceAssetType === visual.assetType &&
      f.sourceAssetId === visual.assetId &&
      f.fieldName === visual.fieldName &&
      f.datasetId
    ) {
      ids.add(f.datasetId);
    }
  }
  return [...ids];
}

function countBy<T>(
  items: T[],
  id: (item: T) => string,
  name: (item: T) => string
): Array<{ id: string; name: string; count: number }> {
  const map = new Map<string, { id: string; name: string; count: number }>();
  for (const item of items) {
    const key = id(item);
    const entry = map.get(key) ?? { id: key, name: name(item), count: 0 };
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function countTerms(
  assets: SmusCatalogAssetSummary[]
): Array<{ name: string; shortDescription?: string; count: number }> {
  const map = new Map<string, { name: string; shortDescription?: string; count: number }>();
  for (const asset of assets) {
    for (const term of asset.glossaryTerms) {
      const entry = map.get(term.name) ?? {
        name: term.name,
        shortDescription: term.shortDescription,
        count: 0,
      };
      entry.count += 1;
      map.set(term.name, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
