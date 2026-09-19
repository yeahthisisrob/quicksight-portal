/**
 * SearchService - one index over everything the portal knows, built from
 * the caches already in memory (the master cache, the field cache, the SMUS
 * snapshot, the template library) and kept per container until any of
 * them changes. Asked in natural words, it answers with ranked hits that
 * say why they matched, in one line each, for people and for agents.
 */

import { CACHE_TTL } from '../../../shared/constants/timeConstants';
import { CacheService } from '../../../shared/services/cache/CacheService';
import type { FieldInfo } from '../../../shared/services/cache/types';
import { SmusService } from '../../../shared/services/smus/SmusService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { logger } from '../../../shared/utils/logger';
import { canonicalExpression } from '../../data-catalog/lib/expressionAnalysis';
import { CalculatedFieldTemplateStore } from '../../data-catalog/services/CalculatedFieldTemplateStore';
import { SearchIndex } from '../lib/searchIndex';
import type { SearchDocument, SearchHit, SearchRequest, SearchResponse } from '../types';

const INDEX_TTL_MS = CACHE_TTL.SHORT;
/** How many names a summary lists before "…". */
const SUMMARY_NAMES = 3;
const SUMMARY_FIELDS = 6;
const EXPRESSION_SUMMARY_LENGTH = 120;
const DEFINED_IN_LIMIT = 50;

interface IndexEntry {
  key: string;
  expiresAt: number;
  promise: Promise<SearchIndex>;
}

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
    const index = await this.getIndex();
    const hits: SearchHit[] = index.search(request.q, {
      types: request.types,
      limit: request.limit,
    });
    return { q: request.q, hits, indexed: index.counts, indexedAt: index.indexedAt };
  }

  /** One index per container, rebuilt when the caches it reads have changed. */
  private async getIndex(): Promise<SearchIndex> {
    const { cache, version } = await this.cacheService.getMasterCacheWithVersion({
      statusFilter: AssetStatusFilter.ACTIVE,
    });
    const snapshot = await this.smusService.getSnapshot();
    const key = `${version}|${snapshot?.exportedAt ?? ''}`;
    const cached = SearchService.index;
    if (cached && cached.key === key && cached.expiresAt > Date.now()) {
      return cached.promise;
    }
    const promise = this.build(cache.entries, snapshot?.listings ?? []).catch((error) => {
      SearchService.index = null;
      throw error;
    });
    SearchService.index = { key, expiresAt: Date.now() + INDEX_TTL_MS, promise };
    return promise;
  }

  private async build(
    entries: Record<string, any[]>,
    listings: Array<Record<string, any>>
  ): Promise<SearchIndex> {
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
      const key = `${field.fieldName.toLowerCase()}::${canonicalExpression(field.expression)}`;
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
        path: `/data-catalog?q=${encodeURIComponent(calc.name)}`,
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

    // 4. SMUS listings.
    for (const listing of listings) {
      if (!listing.listingId || !listing.name) {
        continue;
      }
      const table = listing.table ? `${listing.table.database}.${listing.table.name}` : undefined;
      const columns = (listing.columns ?? []).map((c: any) => c.name).filter(Boolean);
      docs.push({
        type: 'smus-listing',
        id: listing.listingId,
        name: listing.name,
        description: listing.description,
        columns,
        calculatedFields: [],
        tags: (listing.glossaryTerms ?? []).map((t: any) => t.name),
        context: [table ?? '', listing.owningProjectId ?? ''].filter(Boolean),
        summary: `SMUS listing: ${listing.name}${table ? ` (${table}` : ' ('}${columns.length ? `${table ? ', ' : ''}${plural(columns.length, 'column')}` : ''})`,
        path: `/data-catalog?asset=${encodeURIComponent(listing.listingId)}`,
      });
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

    const index = new SearchIndex(docs);
    logger.info('Search index built', {
      documents: docs.length,
      counts: index.counts,
      ms: Date.now() - started,
    });
    return index;
  }
}
