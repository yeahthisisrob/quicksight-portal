/**
 * Pure helpers for the SMUS-first catalog: URL state, filtering, counts.
 * Nothing here touches the network or React, so it is unit-tested directly.
 */
import type {
  GlossaryTerm,
  SmusCatalog,
  SmusCatalogAssetSummary,
} from '@/shared/api/modules/data-catalog';

export interface CatalogUrlState {
  /** Owning project the page is scoped to. */
  project?: string;
  /** Selected listing id. */
  asset?: string;
  /** Glossary term filter. */
  term?: string;
  /** Search text. */
  q?: string;
}

export function readCatalogState(params: URLSearchParams): CatalogUrlState {
  const read = (key: string) => {
    const value = params.get(key)?.trim();
    return value ? value : undefined;
  };
  return {
    project: read('project'),
    asset: read('asset'),
    term: read('term'),
    q: read('q'),
  };
}

/** Apply a patch; `undefined` or '' removes the key. Returns new params. */
export function writeCatalogState(
  params: URLSearchParams,
  patch: Partial<CatalogUrlState>
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
}

export type CatalogProjectOption = SmusCatalog['projects'][number];

/**
 * The project to show: the requested one when it exists, else the first.
 * Undefined when there are no projects at all.
 */
export function pickProject(
  projects: CatalogProjectOption[],
  requested?: string
): CatalogProjectOption | undefined {
  if (projects.length === 0) return undefined;
  return projects.find((p) => p.id === requested) ?? projects[0];
}

export interface AssetFilters {
  term?: string;
  /** Dataset ids carrying the chosen tags; null means no tag filter. */
  taggedDatasetIds?: Set<string> | null;
}

export function filterAssets(
  assets: SmusCatalogAssetSummary[],
  filters: AssetFilters
): SmusCatalogAssetSummary[] {
  return assets.filter((asset) => {
    if (filters.term && !asset.glossaryTerms.some((t) => t.name === filters.term)) {
      return false;
    }
    if (filters.taggedDatasetIds) {
      const ids = filters.taggedDatasetIds;
      if (!asset.datasets.some((d) => ids.has(d.id))) {
        return false;
      }
    }
    return true;
  });
}

export interface CatalogCounts {
  assets: number;
  withDataset: number;
  withoutDataset: number;
  calculatedFields: number;
  terms: number;
}

export function countCatalog(assets: SmusCatalogAssetSummary[]): CatalogCounts {
  const terms = new Set<string>();
  let withDataset = 0;
  let calculatedFields = 0;
  for (const asset of assets) {
    if (asset.datasets.length > 0) withDataset += 1;
    calculatedFields += asset.calculatedFieldCount;
    for (const term of asset.glossaryTerms) terms.add(term.name);
  }
  return {
    assets: assets.length,
    withDataset,
    withoutDataset: assets.length - withDataset,
    calculatedFields,
    terms: terms.size,
  };
}

/** Terms present in these assets with how many carry each, most common first. */
export function termsOf(
  assets: SmusCatalogAssetSummary[]
): Array<GlossaryTerm & { count: number }> {
  const byName = new Map<string, GlossaryTerm & { count: number }>();
  for (const asset of assets) {
    for (const term of asset.glossaryTerms) {
      const existing = byName.get(term.name);
      if (existing) {
        existing.count += 1;
      } else {
        byName.set(term.name, { ...term, count: 1 });
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
