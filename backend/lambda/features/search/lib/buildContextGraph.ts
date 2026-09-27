/**
 * The context graph from what the search pass already has: its documents
 * (one per entity), the cached export's metadata (which datasets an
 * analysis reads, which data sources a dataset reads through, folders),
 * the scoped SMUS listings with their links, and the calculated fields
 * with the assets that define them. Pure.
 */
import { classifyFields, type ExpressionVerdict } from '../../../../../shared/lib/expressionKinds';
import type { SearchDocument } from '../types';
import {
  ContextGraph,
  type EntityType,
  entityId,
  expressionColumnNames,
  normalName,
} from './contextGraph';

const TEMPLATE_TAG_KEY = 'quicksight-portal:template';
const COLUMN_ATTRIBUTE_LIMIT = 60;

const ENTITY_TYPE: Record<SearchDocument['type'], EntityType> = {
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
};

interface GraphInput {
  docs: SearchDocument[];
  /** The master cache entries by asset type. */
  entries: Record<string, any[]>;
  /** Scoped SMUS listings, each with the datasets linked to it. */
  listings: Array<Record<string, any>>;
  /** Calculated fields by catalog key: expression and the assets that define it. */
  calculatedFields: Map<
    string,
    {
      expression: string;
      definedIn: Array<{ type: string; id: string; name: string }>;
      dataType?: string;
    }
  >;
  /** Visuals by `${assetType}:${assetId}:${visualId}`, with their asset and the fields they use. */
  visuals: Map<
    string,
    { asset: { type: string; id: string }; fields?: Map<string, string | undefined> }
  >;
  /** Every dataset column, with its name before the dataset renamed it. */
  columns?: Array<{ datasetId: string; name: string; sourceName?: string; dataType?: string }>;
  /** `${assetType}:${assetId}:${fieldName}` -> the dataset an exploration's calculated field is declared against. */
  calcDatasets?: Map<string, string>;
}

/**
 * Each calculated field's kind, stage and whether SPICE materialises it,
 * classified with the other fields of the asset that defines it, so one
 * reading an aggregate is an aggregate too.
 */
function calculatedFieldKinds(docs: SearchDocument[]): Map<string, ExpressionVerdict> {
  const byAsset = new Map<string, Array<{ id: string; name: string; expression: string }>>();
  for (const doc of docs) {
    if (doc.type !== 'calculated-field' || !doc.expression) continue;
    for (const definer of doc.definedIn ?? []) {
      const key = `${definer.type}:${definer.id}`;
      byAsset.set(key, [
        ...(byAsset.get(key) ?? []),
        { id: doc.id, name: doc.name, expression: doc.expression },
      ]);
    }
  }
  const kinds = new Map<string, ExpressionVerdict>();
  for (const fields of byAsset.values()) {
    const verdicts = classifyFields(fields);
    for (const field of fields) {
      const verdict = verdicts.get(field.name);
      if (verdict && !kinds.has(field.id)) kinds.set(field.id, verdict);
    }
  }
  return kinds;
}

export function buildContextGraph(input: GraphInput): ContextGraph {
  const graph = new ContextGraph();
  const byId = new Map<string, any>();
  for (const type of ['dashboard', 'analysis', 'dataset', 'datasource', 'folder']) {
    for (const entry of input.entries[type] ?? []) {
      byId.set(entityId(type as EntityType, entry.assetId), entry);
    }
  }

  const kinds = calculatedFieldKinds(input.docs);

  // 1. Every searchable thing is an entity, with the facts worth reasoning on.
  for (const doc of input.docs) {
    const type = ENTITY_TYPE[doc.type];
    const id = entityId(type, doc.id);
    const meta = byId.get(id)?.metadata ?? {};
    const attributes: Record<string, string | number | boolean> = {};
    if (doc.projectId) attributes.projectId = doc.projectId;
    if (doc.expression) attributes.expression = doc.expression;
    if (doc.views) attributes.views = doc.views;
    const kind = type === 'calculated-field' ? kinds.get(doc.id) : undefined;
    if (kind) {
      attributes.kind = kind.kind;
      attributes.stage = kind.stage;
      attributes.materialisable = kind.materialisable;
      if (kind.calcLevel) attributes.calcLevel = kind.calcLevel;
    }
    if (type === 'dataset') {
      if (meta.importMode) attributes.importMode = meta.importMode;
      if (doc.columns.length)
        attributes.columns = doc.columns.slice(0, COLUMN_ATTRIBUTE_LIMIT).join(', ');
      if (doc.calculatedFields.length)
        attributes.calculatedFields = doc.calculatedFields.join(', ');
    }
    if (type === 'datasource' && (meta.sourceType ?? meta.datasourceType)) {
      attributes.sourceType = String(meta.sourceType ?? meta.datasourceType);
    }
    if (
      (type === 'dashboard' || type === 'analysis') &&
      doc.tags.some((t) => t.startsWith(`${TEMPLATE_TAG_KEY} `))
    ) {
      attributes.layoutStandard = true;
    }
    graph.add({
      id,
      type,
      name: doc.name,
      ...(doc.description ? { description: doc.description } : {}),
      summary: doc.summary,
      attributes,
      path: doc.path,
    });
  }

  // 2. SMUS: projects, listings, columns, glossary terms, and the dataset links.
  for (const listing of input.listings) {
    const listingId = entityId('listing', listing.listingId);
    if (!graph.has(listingId)) {
      continue;
    }
    if (listing.projectId) {
      graph.link(listingId, 'in-project', entityId('project', listing.projectId));
    }
    const columnsByName = new Map<string, string>();
    for (const column of listing.columns ?? []) {
      const columnId = entityId('listing-column', `${listing.listingId}/${column.name}`);
      const entity = graph.get(columnId);
      if (entity) {
        graph.add({
          ...entity,
          attributes: {
            ...entity.attributes,
            ...(column.type ? { type: column.type } : {}),
            listing: listing.name,
          },
        });
        graph.link(listingId, 'has-column', columnId);
        columnsByName.set(normalName(column.name), columnId);
      }
    }
    for (const term of listing.glossaryTerms ?? []) {
      if (!term?.name) continue;
      const termId = entityId('glossary-term', normalName(term.name));
      graph.add({
        id: termId,
        type: 'glossary-term',
        name: term.name,
        ...(term.shortDescription ? { description: term.shortDescription } : {}),
        summary: `glossary term: ${term.name}${term.shortDescription ? ` - ${term.shortDescription}` : ''}`,
        attributes: {},
      });
      graph.link(listingId, 'tagged', termId);
    }
    for (const dataset of listing.datasets ?? []) {
      const datasetId = entityId('dataset', dataset.id);
      const note = `by ${dataset.matchType ?? 'match'}${dataset.via?.name ? ` via ${dataset.via.name}` : ''}`;
      graph.link(datasetId, 'reads-listing', listingId, note);
      // The dataset columns that carry the listing's columns.
      for (const name of (byId.get(datasetId)?.metadata?.fields ?? []).map(
        (f: any) => f.fieldName ?? f.name
      )) {
        const columnId = name ? columnsByName.get(normalName(name)) : undefined;
        if (columnId) {
          graph.link(datasetId, 'exposes', columnId);
        }
      }
    }
  }

  // 3. The export's own lineage: data sources, datasets used, folders.
  const folderByArn = new Map<string, string>();
  for (const folder of input.entries.folder ?? []) {
    if (folder.arn) folderByArn.set(folder.arn, entityId('folder', folder.assetId));
  }
  for (const [id, entry] of byId) {
    const lineage = entry.metadata?.lineageData ?? {};
    if (id.startsWith('dataset:')) {
      for (const source of lineage.datasourceIds ?? []) {
        graph.link(id, 'through-datasource', entityId('datasource', source));
      }
    }
    if (id.startsWith('dashboard:') || id.startsWith('analysis:')) {
      for (const dataset of lineage.datasetIds ?? []) {
        graph.link(id, 'uses-dataset', entityId('dataset', dataset));
      }
    }
    for (const arn of entry.metadata?.folderPath ?? []) {
      const folder = folderByArn.get(arn);
      if (folder) graph.link(id, 'in-folder', folder);
    }
  }

  // 4. Calculated fields: where they are defined, and the governed columns they read.
  for (const [key, field] of input.calculatedFields) {
    const fieldId = entityId('calculated-field', key);
    const reads = expressionColumnNames(field.expression).map(normalName);
    for (const definer of field.definedIn) {
      const assetId = entityId(definer.type as EntityType, definer.id);
      graph.link(fieldId, 'defined-in', assetId);
      // The datasets behind the definer: itself, or what an analysis uses.
      const datasets =
        definer.type === 'dataset'
          ? [assetId]
          : graph
              .related(assetId, { relations: ['uses-dataset'], direction: 'out' })
              .map((h) => h.entity.id);
      for (const dataset of datasets) {
        for (const hit of graph.related(dataset, {
          relations: ['exposes'],
          direction: 'out',
          limit: 500,
        })) {
          if (reads.includes(normalName(hit.entity.name))) {
            graph.link(fieldId, 'reads-column', hit.entity.id);
          }
        }
      }
    }
  }

  // 5. Visuals sit in their analysis or dashboard.
  for (const [key, visual] of input.visuals) {
    graph.link(
      entityId('visual', key),
      'in-asset',
      entityId(visual.asset.type as EntityType, visual.asset.id)
    );
  }

  linkFieldLineage(graph, input, byId);
  return graph;
}

const columnKey = (datasetId: string, name: string) => `${datasetId}/${name}`;

/**
 * Field-level lineage: every dataset column as an entity, traced to the
 * parent dataset's column or the SMUS listing column it carries (through
 * renames), each calculated field to the columns and fields it reads, and
 * each visual to the fields it shows. Resolution is by name within the
 * asset (and the dataset a field is declared against), the way QuickSight
 * itself resolves them.
 */
function linkFieldLineage(graph: ContextGraph, input: GraphInput, byId: Map<string, any>): void {
  const columnsOf = new Map<string, Map<string, string>>();
  for (const column of input.columns ?? []) {
    const id = entityId('dataset-column', columnKey(column.datasetId, column.name));
    const dataset = entityId('dataset', column.datasetId);
    graph.add({
      id,
      type: 'dataset-column',
      name: column.name,
      summary: `column ${column.name}${column.dataType ? ` (${column.dataType})` : ''} of dataset ${graph.get(dataset)?.name ?? column.datasetId}${column.sourceName ? `, renamed from ${column.sourceName}` : ''}`,
      attributes: {
        dataSetId: column.datasetId,
        ...(column.dataType ? { dataType: column.dataType } : {}),
        ...(column.sourceName ? { sourceName: column.sourceName } : {}),
      },
    });
    graph.link(id, 'column-of', dataset);
    const names = columnsOf.get(column.datasetId) ?? new Map<string, string>();
    names.set(column.name, id);
    columnsOf.set(column.datasetId, names);
  }

  // Upstream: the parent dataset's column, else the governed listing column.
  for (const column of input.columns ?? []) {
    const id = entityId('dataset-column', columnKey(column.datasetId, column.name));
    const upstreamName = column.sourceName ?? column.name;
    const parents: string[] =
      byId.get(entityId('dataset', column.datasetId))?.metadata?.lineageData?.datasetIds ?? [];
    const parentColumn = parents
      .map((parent) => columnsOf.get(parent)?.get(upstreamName))
      .find(Boolean);
    if (parentColumn) {
      graph.link(id, 'derived-from', parentColumn, column.sourceName ? 'renamed' : undefined);
      continue;
    }
    for (const hit of graph.related(entityId('dataset', column.datasetId), {
      relations: ['reads-listing'],
      direction: 'out',
    })) {
      const listingColumn = graph
        .related(hit.entity.id, { relations: ['has-column'], direction: 'out', limit: 1000 })
        .find((c) => normalName(c.entity.name) === normalName(upstreamName));
      if (listingColumn) {
        graph.link(
          id,
          'derived-from',
          listingColumn.entity.id,
          column.sourceName ? 'renamed' : undefined
        );
      }
    }
  }

  // The calculated fields each asset defines, by name. Assets are keyed as
  // their entity ids (`type:id`), which is also how byId is keyed.
  const calcsOf = new Map<string, Map<string, string>>();
  for (const [key, field] of input.calculatedFields) {
    const fieldId = entityId('calculated-field', key);
    const name = graph.get(fieldId)?.name;
    if (!name) continue;
    for (const definer of field.definedIn) {
      const asset = entityId(definer.type as EntityType, definer.id);
      const names = calcsOf.get(asset) ?? new Map<string, string>();
      names.set(name, fieldId);
      calcsOf.set(asset, names);
    }
  }
  const datasetsOf = (asset: string): string[] =>
    asset.startsWith('dataset:')
      ? [asset.slice('dataset:'.length)]
      : (byId.get(asset)?.metadata?.lineageData?.datasetIds ?? []);

  /** What a name read in `asset` (declared against `datasetId`, when known) is. */
  const resolve = (asset: string, name: string, datasetId?: string): string | undefined => {
    const own = calcsOf.get(asset)?.get(name);
    if (own) return own;
    for (const dataset of datasetId ? [datasetId] : datasetsOf(asset)) {
      const target =
        calcsOf.get(entityId('dataset', dataset))?.get(name) ?? columnsOf.get(dataset)?.get(name);
      if (target) return target;
    }
    return undefined;
  };

  for (const [key, field] of input.calculatedFields) {
    const fieldId = entityId('calculated-field', key);
    const name = graph.get(fieldId)?.name;
    for (const definer of field.definedIn) {
      const asset = entityId(definer.type as EntityType, definer.id);
      const declaredOn = name ? input.calcDatasets?.get(`${asset}:${name}`) : undefined;
      for (const read of expressionColumnNames(field.expression)) {
        const target = resolve(asset, read, declaredOn);
        if (target && target !== fieldId) graph.link(fieldId, 'reads-field', target);
      }
    }
  }

  for (const [key, visual] of input.visuals) {
    const asset = entityId(visual.asset.type as EntityType, visual.asset.id);
    for (const [name, datasetId] of visual.fields ?? []) {
      const target = resolve(asset, name, datasetId);
      if (target) graph.link(entityId('visual', key), 'shows', target);
    }
  }
}
