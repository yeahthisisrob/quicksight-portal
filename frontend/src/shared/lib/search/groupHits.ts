/**
 * How search hits are presented: type labels, the order groups appear in,
 * and the filters a person can narrow by. Pure, so the palette, the Author
 * pickers and the catalog all agree.
 */
import type { SearchableType, SearchHit } from '@/shared/api/modules/search';

export const SEARCH_TYPE_LABELS: Record<SearchableType, string> = {
  dashboard: 'Dashboards',
  analysis: 'Analyses',
  dataset: 'Datasets',
  datasource: 'Data sources',
  folder: 'Folders',
  'smus-listing': 'SMUS listings',
  'calculated-field': 'Calculated fields',
  visual: 'Visuals',
  template: 'Templates',
};

export const SEARCH_TYPE_SINGULAR: Record<SearchableType, string> = {
  dashboard: 'dashboard',
  analysis: 'analysis',
  dataset: 'dataset',
  datasource: 'data source',
  folder: 'folder',
  'smus-listing': 'SMUS listing',
  'calculated-field': 'calculated field',
  visual: 'visual',
  template: 'template',
};

/** Groups appear in this order, whatever the scores; within a group, by score. */
export const SEARCH_TYPE_ORDER: readonly SearchableType[] = [
  'dashboard',
  'analysis',
  'dataset',
  'smus-listing',
  'calculated-field',
  'visual',
  'template',
  'datasource',
  'folder',
];

export interface SearchFilter {
  id: string;
  label: string;
  /** Empty means every type. */
  types: SearchableType[];
}

export const SEARCH_FILTERS: readonly SearchFilter[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'dashboards', label: 'Dashboards', types: ['dashboard'] },
  { id: 'analyses', label: 'Analyses', types: ['analysis'] },
  { id: 'datasets', label: 'Datasets', types: ['dataset'] },
  { id: 'smus', label: 'SMUS', types: ['smus-listing'] },
  { id: 'calculated', label: 'Calculated fields', types: ['calculated-field'] },
  { id: 'visuals', label: 'Visuals', types: ['visual'] },
  { id: 'templates', label: 'Templates', types: ['template'] },
];

export interface SearchHitGroup {
  type: SearchableType;
  label: string;
  hits: SearchHit[];
}

/** Hits by type, in presentation order; the server's score order is kept inside a group. */
export function groupHits(hits: SearchHit[]): SearchHitGroup[] {
  const byType = new Map<SearchableType, SearchHit[]>();
  for (const hit of hits) {
    byType.set(hit.type, [...(byType.get(hit.type) ?? []), hit]);
  }
  const ordered: SearchHitGroup[] = [];
  for (const type of SEARCH_TYPE_ORDER) {
    const group = byType.get(type);
    if (group && group.length > 0) {
      ordered.push({ type, label: SEARCH_TYPE_LABELS[type], hits: group });
    }
  }
  return ordered;
}

/** The hits in the order they are drawn, so a keyboard index maps onto one. */
export function flattenGroups(groups: SearchHitGroup[]): SearchHit[] {
  return groups.flatMap((g) => g.hits);
}

/** "3 dashboards, 12 calculated fields" from the server's indexed counts. */
export function describeIndexed(indexed: Partial<Record<string, number>>): string {
  const parts: string[] = [];
  for (const type of SEARCH_TYPE_ORDER) {
    const n = indexed[type];
    if (n) {
      parts.push(
        `${n} ${n === 1 ? SEARCH_TYPE_SINGULAR[type] : SEARCH_TYPE_LABELS[type].toLowerCase()}`
      );
    }
  }
  return parts.join(', ');
}
