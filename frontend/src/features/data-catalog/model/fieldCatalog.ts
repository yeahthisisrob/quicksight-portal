/**
 * Pure helpers for the field-first catalog: how an expression is shown, how
 * rows sort, how "defined in" reads. No React, no network; unit-tested.
 */
import type {
  CalculatedFieldRef,
  CalculatedFieldSummary,
  CatalogDatasetRef,
} from '@/shared/api/modules/data-catalog';

export type CalculatedFieldSort = 'name' | 'usage' | 'conflicts' | 'definedIn';

export const CALCULATED_FIELD_SORTS: Array<{ value: CalculatedFieldSort; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'usage', label: 'Most used' },
  { value: 'conflicts', label: 'Conflicts first' },
  { value: 'definedIn', label: 'Defined in most places' },
];

const INDENT = '  ';
/** Expressions shorter than this stay on one line. */
const ONE_LINE_LENGTH = 48;

export function totalUsage(item: Pick<CalculatedFieldSummary, 'usedBy'>): number {
  return item.usedBy.dashboards + item.usedBy.analyses + item.usedBy.visuals;
}

export function isUnused(item: Pick<CalculatedFieldSummary, 'usedBy'>): boolean {
  return totalUsage(item) === 0;
}

export function sortCalculatedFields(
  items: CalculatedFieldSummary[],
  sort: CalculatedFieldSort
): CalculatedFieldSummary[] {
  const byName = (a: CalculatedFieldSummary, b: CalculatedFieldSummary) =>
    a.name.localeCompare(b.name) || a.expression.localeCompare(b.expression);
  const sorted = [...items];
  switch (sort) {
    case 'usage':
      return sorted.sort((a, b) => totalUsage(b) - totalUsage(a) || byName(a, b));
    case 'conflicts':
      return sorted.sort(
        (a, b) => (b.conflict?.variants ?? 0) - (a.conflict?.variants ?? 0) || byName(a, b)
      );
    case 'definedIn':
      return sorted.sort((a, b) => b.definedIn.length - a.definedIn.length || byName(a, b));
    default:
      return sorted.sort(byName);
  }
}

/**
 * Why a dataset is (or is not) tied to a SMUS listing. The tie is what the
 * SMUS scope filters on, so when a field is missing from the tab this is the
 * sentence that says where to look.
 */
export function describeSmusTie(dataset: CatalogDatasetRef): string {
  const listing = dataset.listing;
  if (!listing) {
    return 'Not tied to a SMUS listing: no listing matched this dataset by source table, custom SQL, name, or a parent dataset.';
  }
  const where = listing.projectName ? ` in ${listing.projectName}` : '';
  switch (listing.matchType) {
    case 'lineage':
      return `SMUS listing ${listing.name}${where}, inherited from ${listing.via?.name ?? 'a parent dataset'}, which this dataset is built on.`;
    case 'custom-sql':
      return `SMUS listing ${listing.name}${where}, matched on a table named in the dataset's custom SQL.`;
    case 'name':
      return `SMUS listing ${listing.name}${where}, matched on the dataset's name alone.`;
    default:
      return `SMUS listing ${listing.name}${where}, matched on the source table the dataset reads.`;
  }
}

/** "2 dashboards · 1 dataset", in the order dataset, dashboard, analysis. */
export function describeDefinedIn(refs: CalculatedFieldRef[]): string {
  const counts = { dataset: 0, dashboard: 0, analysis: 0 };
  for (const ref of refs) {
    counts[ref.type] += 1;
  }
  const word = (n: number, singular: string, plural: string) =>
    `${n} ${n === 1 ? singular : plural}`;
  const parts: string[] = [];
  if (counts.dataset) parts.push(word(counts.dataset, 'dataset', 'datasets'));
  if (counts.dashboard) parts.push(word(counts.dashboard, 'dashboard', 'dashboards'));
  if (counts.analysis) parts.push(word(counts.analysis, 'analysis', 'analyses'));
  return parts.join(' · ') || 'nowhere';
}

/**
 * Break an expression across lines at top-level commas and around the
 * parentheses of a call, indenting by depth, so `ifelse(a, b, c)` reads as
 * one branch per line. String literals are never split. Short expressions
 * stay as they are.
 */
export function prettyExpression(expression: string): string {
  const text = expression.replace(/\s+/g, ' ').trim();
  if (text.length <= ONE_LINE_LENGTH) {
    return text;
  }
  const lines: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  const flush = () => {
    if (current.trim() !== '') {
      lines.push(current.replace(/\s+$/, ''));
    }
    current = INDENT.repeat(depth);
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') {
      current += ch;
      depth += 1;
      flush();
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      flush();
      current += ch;
      continue;
    }
    if (ch === ',') {
      current += ch;
      flush();
      if (text[i + 1] === ' ') i += 1;
      continue;
    }
    current += ch;
  }
  if (current.trim() !== '') {
    lines.push(current.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}
