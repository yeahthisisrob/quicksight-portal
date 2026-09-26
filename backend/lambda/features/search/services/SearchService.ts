/**
 * SearchService - what the portal knows, two ways, built in one pass from
 * the caches already in memory (the master cache, the field cache, the SMUS
 * snapshot, the template library) and kept per container until any of
 * them changes:
 *
 * - a ranked index: asked in natural words, it answers with hits that say
 *   why they matched, in one line each, for people and for agents;
 * - a context graph: the same things as entities with typed relationships
 *   (a listing in a project, a dataset reading a listing through a data
 *   source, a calculated field reading a column), for agents to walk.
 *   Shaped like AWS Context, so an agent can later move to it unchanged.
 *
 * SMUS listings come through the scoped list the Data Catalog uses, so a
 * listing outside the selected projects is invisible here too.
 */

import { CACHE_TTL } from '../../../shared/constants/timeConstants';
import { CacheService } from '../../../shared/services/cache/CacheService';
import type { FieldInfo } from '../../../shared/services/cache/types';
import { SmusService } from '../../../shared/services/smus/SmusService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { logger } from '../../../shared/utils/logger';
import { CalculatedFieldTemplateStore } from '../../data-catalog/services/CalculatedFieldTemplateStore';
import { calculatedFieldKey } from '../../data-catalog/services/FieldCatalogService';
import { buildContextGraph } from '../lib/buildContextGraph';
import { type ContextGraph, entityId } from '../lib/contextGraph';
import { SearchIndex } from '../lib/searchIndex';
import type { SearchDocument, SearchHit, SearchRequest, SearchResponse } from '../types';

const INDEX_TTL_MS = CACHE_TTL.SHORT;
/** How many names a summary lists before "…". */
const SUMMARY_NAMES = 3;
const SUMMARY_FIELDS = 6;
const EXPRESSION_SUMMARY_LENGTH = 120;
const DEFINED_IN_LIMIT = 50;

interface Built {
  index: SearchIndex;
  graph: ContextGraph;
}

interface IndexEntry {
  key: string;
  expiresAt: number;
  promise: Promise<Built>;
}

/** Search document kinds to graph entity kinds. */
const ENTITY_TYPE = {
  dashboard: 'dashboard',
  analysis: 'analysis',
  dataset: 'dataset',
  datasource: 'datasource',
  folder: 'folder',
  'smus-listing': 'listing',
  'smus-column': 'listing-column',
  project: 'project',
  'calculated-field': 'calculated-field',
  visual: 'visual',
  template: 'template',
} as const;

type ParentType = 'dashboard' | 'analysis' | 'dataset';

function trimExpression(expression: string): string {
  const flat = expression.replace(/\s+/g, ' ').trim();
  return flat.length > EXPRESSION_SUMMARY_LENGTH
    ? `${flat.slice(0, EXPRESSION_SUMMARY_LENGTH - 1)}…`
    : flat;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export class SearchService {
  private static index: IndexEntry | null = null;

  /** Test hook / after an export: forget the container's index. */
  public static invalidate(): void {
    SearchService.index = null;
  }

  public constructor(
    private readonly cacheService: CacheService = CacheService.getInstance(),
    private readonly smusService: SmusService = new SmusService(CacheService.getInstance()),
    private readonly templateStore: CalculatedFieldTemplateStore = new CalculatedFieldTemplateStore()
  ) {}

  public async search(request: SearchRequest): Promise<SearchResponse> {
    const { index } = await this.getBuilt();
    const hits: SearchHit[] = index.search(request.q, {
      types: request.types,
      limit: request.limit,
      projectId: request.projectId,
    });
    return { q: request.q, hits, indexed: index.counts, indexedAt: index.indexedAt };
  }

  /** The context graph, built with the index. */
  public async graph(): Promise<ContextGraph> {
    return (await this.getBuilt()).graph;
  }

  /** One index and graph per container, rebuilt when the caches they read have changed. */
  private async getBuilt(): Promise<Built> {
    const { cache, version } = await this.cacheService.getMasterCacheWithVersion({
      statusFilter: AssetStatusFilter.ACTIVE,
    });
    const snapshot = await this.smusService.getSnapshot();
    const key = `${version}|${snapshot?.exportedAt ?? ''}`;
    const cached = SearchService.index;
    if (cached && cached.key === key && cached.expiresAt > Date.now()) {
      return cached.promise;
    }
    const promise = this.smusService
      .listAssets()
      .catch((error) => {
        logger.warn('Search: SMUS assets unavailable', { error });
        return { assets: [] as any[] };
      })
      .then((scoped) => this.build(cache.entries, scoped.assets as any[], snapshot?.projects ?? []))
      .catch((error) => {
        SearchService.index = null;
        throw error;
      });
    SearchService.index = { key, expiresAt: Date.now() + INDEX_TTL_MS, promise };
    return promise;
  }

  private async build(
    entries: Record<string, any[]>,
    listings: Array<Record<string, any>>,
    projects: Array<{ id: string; name: string; description?: string }>
  ): Promise<Built> {
    const started = Date.now();
    const [fields, templates] = await Promise.all([
      this.cacheService.searchFields({}) as Promise<FieldInfo[]>,
      this.templateStore.list().catch((error) => {
        logger.warn('Search: template library unavailable', { error });
        return [];
      }),
    ]);

    const folderNames = new Map<string, string>();
    for (const folder of entries.folder ?? []) {
      folderNames.set(folder.arn, folder.assetName);
    }
    const assetNames = new Map<string, string>();
    const docs: SearchDocument[] = [];

    // 1. Assets.
    for (const type of ['dashboard', 'analysis', 'dataset', 'datasource', 'folder'] as const) {
      for (const entry of entries[type] ?? []) {
        const assetName = String(entry.assetName ?? entry.assetId ?? '');
        if (!entry.assetId || !assetName) {
          continue;
        }
        assetNames.set(`${type}:${entry.assetId}`, assetName);
        const meta = entry.metadata ?? {};
        const columns: string[] = [
          ...(meta.fields ?? []).map((f: any) => f.fieldName ?? f.name).filter(Boolean),
        ];
        const calculated: string[] = (meta.calculatedFields ?? [])
          .map((f: any) => f.fieldName ?? f.name)
          .filter(Boolean);
        const folders = (meta.folderPath ?? [])
          .map((arn: string) => folderNames.get(arn))
          .filter(Boolean) as string[];
        const facts: string[] = [];
        if (type === 'dashboard' || type === 'analysis') {
          if (meta.sheetCount) facts.push(plural(meta.sheetCount, 'sheet'));
          if (meta.visualCount) facts.push(plural(meta.visualCount, 'visual'));
          if (meta.datasetCount) facts.push(plural(meta.datasetCount, 'dataset'));
          if (meta.viewStats?.totalViews) facts.push(`${meta.viewStats.totalViews} views`);
        } else if (type === 'dataset') {
          if (meta.importMode) facts.push(meta.importMode === 'SPICE' ? 'SPICE' : 'direct query');
          if (columns.length) facts.push(plural(columns.length, 'column'));
          if (calculated.length) facts.push(plural(calculated.length, 'calculated field'));
          if (meta.sourceType) facts.push(String(meta.sourceType).toLowerCase());
        } else if (type === 'datasource') {
          if (meta.datasourceType ?? meta.sourceType)
            facts.push(String(meta.datasourceType ?? meta.sourceType));
        }
        if (folders.length) facts.push(`in ${folders.join(' / ')}`);
        docs.push({
          type,
          id: entry.assetId,
          name: assetName,
          description: meta.description,
          columns,
          calculatedFields: calculated,
          tags: (entry.tags ?? []).map((t: any) => `${t.key} ${t.value}`),
          context: folders,
          views: meta.viewStats?.totalViews,
          updatedAt: entry.lastUpdatedTime
            ? new Date(entry.lastUpdatedTime).toISOString()
            : undefined,
          summary: `${type}: ${assetName}${facts.length ? ` (${facts.join(', ')})` : ''}`,
          path:
            type === 'dashboard' || type === 'analysis'
              ? `/author?type=${type}&id=${encodeURIComponent(entry.assetId)}&name=${encodeURIComponent(assetName)}`
              : `/${type}s?search=${encodeURIComponent(assetName)}`,
        });
      }
    }

    // 2. Calculated fields, one document per distinct expression, listing every asset that defines it.
    const byExpression = new Map<
      string,
      {
        name: string;
        expression: string;
        definedIn: SearchDocument['definedIn'] & object;
        dataType?: string;
      }
    >();
    for (const field of fields) {
      if (!field.isCalculated || !field.expression || !field.fieldName) {
        continue;
      }
      const parentType = field.sourceAssetType as ParentType;
      if (parentType !== 'dashboard' && parentType !== 'analysis' && parentType !== 'dataset') {
        continue;
      }
      // The catalog's own key, so a hit opens exactly this field there.
      const key = calculatedFieldKey(field.fieldName, field.expression);
      const existing = byExpression.get(key);
      const definer = { type: parentType, id: field.sourceAssetId, name: field.sourceAssetName };
      if (existing) {
        if (
          existing.definedIn.length < DEFINED_IN_LIMIT &&
          !existing.definedIn.some((d) => d.id === definer.id)
        ) {
          existing.definedIn.push(definer);
        }
      } else {
        byExpression.set(key, {
          name: field.fieldName,
          expression: field.expression,
          definedIn: [definer],
          dataType: field.dataType,
        });
      }
    }
    for (const [key, calc] of byExpression) {
      const first = calc.definedIn[0]!;
      docs.push({
        type: 'calculated-field',
        id: key,
        name: calc.name,
        columns: [],
        calculatedFields: [calc.name],
        tags: [],
        context: calc.definedIn.map((d) => d.name),
        expression: calc.expression,
        parent: first,
        definedIn: calc.definedIn,
        summary: `calculated field ${calc.name} = ${trimExpression(calc.expression)} (in ${plural(calc.definedIn.length, 'asset')}: ${calc.definedIn
          .slice(0, SUMMARY_NAMES)
          .map((d) => d.name)
          .join(', ')}${calc.definedIn.length > SUMMARY_NAMES ? ', …' : ''})`,
        path: `/data-catalog?tab=calculated-fields&field=${encodeURIComponent(key)}`,
      });
    }

    // 3. Visuals: title, chart type, sheet and the fields in their wells, from the per-visual usage the export records.
    const visualFields = new Map<
      string,
      {
        asset: { type: ParentType; id: string; name: string };
        visual: {
          visualId: string;
          title?: string;
          visualType: string;
          sheetId: string;
          sheetName?: string;
        };
        fields: Set<string>;
      }
    >();
    for (const field of fields) {
      const parentType = field.sourceAssetType as ParentType;
      if (
        (parentType !== 'dashboard' && parentType !== 'analysis') ||
        !field.fieldName ||
        !field.visuals?.length
      ) {
        continue;
      }
      for (const visual of field.visuals) {
        const id = `${parentType}:${field.sourceAssetId}:${visual.visualId}`;
        const existing = visualFields.get(id) ?? {
          asset: { type: parentType, id: field.sourceAssetId, name: field.sourceAssetName },
          visual,
          fields: new Set<string>(),
        };
        existing.fields.add(field.fieldName);
        visualFields.set(id, existing);
      }
    }
    for (const [id, v] of visualFields) {
      const visualType = v.visual.visualType || 'Visual';
      const title = v.visual.title || `Untitled ${visualType}`;
      const chart = visualType
        .replace(/Visual$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase();
      docs.push({
        type: 'visual',
        id,
        name: title,
        columns: [...v.fields],
        calculatedFields: [],
        tags: [],
        context: [chart, v.visual.sheetName ?? '', v.asset.name].filter(Boolean),
        parent: v.asset,
        summary: `visual: ${title}, a ${chart} on ${v.visual.sheetName ?? 'a sheet'} of ${v.asset.type} ${v.asset.name}, using ${[...v.fields].slice(0, SUMMARY_FIELDS).join(', ')}${v.fields.size > SUMMARY_FIELDS ? ', …' : ''}`,
        path: `/author?type=${v.asset.type}&id=${encodeURIComponent(v.asset.id)}&name=${encodeURIComponent(v.asset.name)}`,
      });
    }

    // 4. SMUS projects, listings and their columns (the scoped list the Data Catalog shows).
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const datasetProject = new Map<string, string>();
    for (const listing of listings) {
      for (const d of listing.datasets ?? []) {
        if (listing.projectId && !datasetProject.has(d.id)) {
          datasetProject.set(d.id, listing.projectId);
        }
      }
    }
    for (const project of projects) {
      const count = listings.filter((l) => l.projectId === project.id).length;
      docs.push({
        type: 'project',
        id: project.id,
        name: project.name,
        description: project.description,
        columns: [],
        calculatedFields: [],
        tags: [],
        context: [],
        projectId: project.id,
        summary: `SMUS project: ${project.name} (${plural(count, 'published listing')})`,
        path: `/data-catalog?project=${encodeURIComponent(project.id)}`,
      });
    }
    for (const listing of listings) {
      if (!listing.listingId || !listing.name) {
        continue;
      }
      const table = listing.table ? `${listing.table.database}.${listing.table.name}` : undefined;
      const columns: Array<{ name: string; type?: string; description?: string }> = (
        listing.columns ?? []
      ).filter((c: any) => c?.name);
      const terms: Array<{ name: string; shortDescription?: string }> = listing.glossaryTerms ?? [];
      const projectName = listing.projectName ?? projectNames.get(listing.projectId);
      const linked: Array<{ name: string }> = listing.datasets ?? [];
      docs.push({
        type: 'smus-listing',
        id: listing.listingId,
        name: listing.name,
        description: listing.description,
        columns: columns.map((c) => c.name),
        calculatedFields: [],
        tags: terms.map((t) => t.name),
        context: [
          table ?? '',
          projectName ?? '',
          ...terms.map((t) => t.shortDescription ?? ''),
        ].filter(Boolean),
        ...(listing.projectId ? { projectId: listing.projectId } : {}),
        summary: `SMUS listing: ${listing.name}${table ? ` (${table}` : ' ('}${columns.length ? `${table ? ', ' : ''}${plural(columns.length, 'column')}` : ''}${projectName ? `, project ${projectName}` : ''}${
          linked.length
            ? `, read by ${linked
                .map((d) => d.name)
                .slice(0, SUMMARY_NAMES)
                .join(', ')}`
            : ', no linked dataset'
        })`,
        path: `/data-catalog?asset=${encodeURIComponent(listing.listingId)}`,
      });
      for (const column of columns) {
        docs.push({
          type: 'smus-column',
          id: `${listing.listingId}/${column.name}`,
          name: column.name,
          description: column.description,
          columns: [column.name],
          calculatedFields: [],
          tags: terms.map((t) => t.name),
          context: [listing.name, table ?? '', projectName ?? '', column.type ?? ''].filter(
            Boolean
          ),
          ...(listing.projectId ? { projectId: listing.projectId } : {}),
          summary: `SMUS column: ${listing.name}.${column.name}${column.type ? ` (${column.type})` : ''}${column.description ? ` - ${column.description}` : ''}`,
          path: `/data-catalog?asset=${encodeURIComponent(listing.listingId)}`,
        });
      }
    }

    // 5. Template library.
    for (const template of templates) {
      docs.push({
        type: 'template',
        id: template.id,
        name: template.name,
        description: template.description,
        columns: [],
        calculatedFields: [template.name],
        tags: template.tags ?? [],
        context: [template.source?.datasetName ?? ''].filter(Boolean),
        expression: template.expression,
        summary: `template: ${template.name} = ${trimExpression(template.expression)}`,
        path: '/data-catalog?templates=1',
      });
    }

    for (const doc of docs) {
      const kind = ENTITY_TYPE[doc.type];
      doc.entityId = entityId(kind, doc.id);
      if (doc.type === 'dataset' && !doc.projectId && datasetProject.has(doc.id)) {
        doc.projectId = datasetProject.get(doc.id);
      }
    }
    const graph = buildContextGraph({
      docs,
      entries,
      listings,
      calculatedFields: byExpression,
      visuals: visualFields,
    });
    const index = new SearchIndex(docs);
    logger.info('Search index and context graph built', {
      documents: docs.length,
      counts: index.counts,
      graph: graph.counts(),
      ms: Date.now() - started,
    });
    return { index, graph };
  }
}
