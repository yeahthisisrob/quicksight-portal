/**
 * Pure helpers for the SMUS-first catalog: URL state, filtering, counts.
 * Nothing here touches the network or React, so it is unit-tested directly.
 */
import type {
  GlossaryTerm,
  SmusCatalog,
  SmusCatalogAssetSummary,
} from '@/shared/api/modules/data-catalog';

export type CatalogTab = 'calculated-fields' | 'columns' | 'smus';

export const CATALOG_TABS: readonly CatalogTab[] = ['calculated-fields', 'columns', 'smus'];
export const DEFAULT_CATALOG_TAB: CatalogTab = 'calculated-fields';

export interface CatalogUrlState {
  /** Which view: calculated fields (default), columns, or the per-project SMUS assets. */
  tab?: CatalogTab;
  /** Owning project the page is scoped to. */
  project?: string;
  /** Selected listing id (SMUS assets tab). */
  asset?: string;
  /** Selected calculated field key (calculated fields tab). */
  field?: string;
  /** Only calculated fields with conflicting variants. */
  conflicts?: string;
  /** Dataset id filter (calculated fields and columns tabs). */
  dataset?: string;
  /** Glossary term filter. */
  term?: string;
  /** Search text. */
  q?: string;
  /** '1' opens the template library. */
  templates?: string;
}

function readTab(value: string | undefined): CatalogTab | undefined {
  return value && (CATALOG_TABS as readonly string[]).includes(value)
    ? (value as CatalogTab)
    : undefined;
}

export function readCatalogState(params: URLSearchParams): CatalogUrlState {
  const read = (key: string) => {
    const value = params.get(key)?.trim();
    return value ? value : undefined;
  };
  return {
    tab: readTab(read('tab')),
    project: read('project'),
    asset: read('asset'),
    field: read('field'),
    conflicts: read('conflicts'),
    dataset: read('dataset'),
    term: read('term'),
    q: read('q'),
    templates: read('templates'),
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
/** The project filter's "every project" value, which is no filter at all. */
export const ALL_PROJECTS = 'all';

/**
 * Which project the catalog is showing. The SMUS tab is per project because
 * everything in SMUS is, but the field-first tabs are QuickSight's own data,
 * which SMUS only annotates, so they can span every project and default to it.
 */
export function pickProject(
  projects: CatalogProjectOption[],
  requested?: string,
  allowAll = false
): CatalogProjectOption | undefined {
  if (projects.length === 0) return undefined;
  if (allowAll) {
    return requested && requested !== ALL_PROJECTS
      ? projects.find((p) => p.id === requested)
      : undefined;
  }
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
