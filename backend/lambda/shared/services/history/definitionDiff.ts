/**
 * What changed between two versions of an asset, in words and in detail.
 * The words come from what the definition is made of (sheets, visuals,
 * calculated fields, filters, parameters, datasets; for a dataset its
 * tables, columns and transforms), so a person reads "2 visuals added, 1
 * calculated field changed" rather than JSON paths. The detail is a plain
 * JSON diff for the parts the words do not name, and for the diff view.
 */
import type { VersionedAssetType } from './definitionSnapshot';

export interface DiffEntry {
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
}

export interface DefinitionDiff {
  /** One line: counts by what changed. "No change" when the two are the same. */
  summary: string;
  /** One line per change, in words. */
  changes: string[];
  /** Every differing path, capped. */
  entries: DiffEntry[];
  /** True when more paths differ than `entries` holds. */
  truncated: boolean;
}

const MAX_ENTRIES = 300;
const MAX_VALUE_CHARS = 200;
const MAX_LINES = 60;
/** Enough of an id to tell elements apart in a line. */
const ID_CHARS = 8;

type Rec = Record<string, any>;

function clip(value: unknown): unknown {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  const text = JSON.stringify(value);
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Every path where the two differ, depth first, capped. */
export function jsonDiff(
  before: unknown,
  after: unknown
): { entries: DiffEntry[]; truncated: boolean } {
  const entries: DiffEntry[] = [];
  let truncated = false;
  const push = (entry: DiffEntry) => {
    if (entries.length >= MAX_ENTRIES) {
      truncated = true;
      return;
    }
    entries.push(entry);
  };
  const walk = (a: unknown, b: unknown, path: string) => {
    if (truncated) return;
    if (same(a, b)) return;
    const aObj = a !== null && typeof a === 'object';
    const bObj = b !== null && typeof b === 'object';
    if (aObj && bObj && Array.isArray(a) === Array.isArray(b)) {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
      for (const key of [...keys].sort()) {
        const next = path ? `${path}.${key}` : key;
        const av = (a as Rec)[key];
        const bv = (b as Rec)[key];
        if (av === undefined) push({ path: next, kind: 'added', after: clip(bv) });
        else if (bv === undefined) push({ path: next, kind: 'removed', before: clip(av) });
        else walk(av, bv, next);
      }
      return;
    }
    push({ path: path || '$', kind: 'changed', before: clip(a), after: clip(b) });
  };
  walk(before, after, '');
  return { entries, truncated };
}

/** The visual's kind (BarChartVisual → "bar chart") and its title. */
function describeVisual(visual: Rec): { id: string; kind: string; title: string } {
  const kindKey = Object.keys(visual).find((k) => k.endsWith('Visual')) ?? 'Visual';
  const inner = visual[kindKey] ?? {};
  const id = String(inner.VisualId ?? '');
  const kind = kindKey
    .replace(/Visual$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  const title = inner.Title?.FormatText?.PlainText ?? inner.Title?.FormatText?.RichText ?? '';
  return { id, kind, title: String(title).replace(/<[^>]+>/g, '') };
}

function label(v: { kind: string; title: string; id: string }): string {
  return v.title ? `"${v.title}" (${v.kind})` : `${v.kind} ${v.id.slice(0, ID_CHARS)}`;
}

function plural(n: number, noun: string, nouns = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : nouns}`;
}

interface Counts {
  [category: string]: number;
}

function count(counts: Counts, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function byKey<T>(items: T[] | undefined, key: (item: T) => string): Map<string, T> {
  return new Map((items ?? []).map((item) => [key(item), item]));
}

/** Added, removed and kept members of two keyed sets. */
function compare<T>(
  before: Map<string, T>,
  after: Map<string, T>
): { added: Array<[string, T]>; removed: Array<[string, T]>; kept: Array<[string, T, T]> } {
  const added: Array<[string, T]> = [];
  const removed: Array<[string, T]> = [];
  const kept: Array<[string, T, T]> = [];
  for (const [key, item] of after) {
    const old = before.get(key);
    if (old === undefined) added.push([key, item]);
    else kept.push([key, old, item]);
  }
  for (const [key, item] of before) {
    if (!after.has(key)) removed.push([key, item]);
  }
  return { added, removed, kept };
}

function layoutElements(sheet: Rec): Map<string, Rec> {
  const out = new Map<string, Rec>();
  for (const layout of sheet.Layouts ?? []) {
    const grid = layout?.Configuration?.GridLayout ?? layout?.Configuration?.FreeFormLayout;
    for (const element of grid?.Elements ?? []) {
      if (element?.ElementId) out.set(String(element.ElementId), element);
    }
  }
  return out;
}

function placement(element: Rec): string {
  return [element.ColumnIndex, element.RowIndex, element.ColumnSpan, element.RowSpan]
    .map((n) => n ?? '')
    .join(',');
}

function describeExploration(before: Rec, after: Rec, lines: string[], counts: Counts): void {
  const b: Rec = before.Definition ?? {};
  const a: Rec = after.Definition ?? {};
  if (before.Name !== after.Name && (before.Name || after.Name)) {
    lines.push(`Renamed from "${before.Name}" to "${after.Name}"`);
    count(counts, 'renamed');
  }
  if ((before.ThemeArn ?? '') !== (after.ThemeArn ?? '')) {
    lines.push(after.ThemeArn ? 'Theme changed' : 'Theme removed');
    count(counts, 'theme changed');
  }

  const datasets = compare(
    byKey<Rec>(b.DataSetIdentifierDeclarations, (d) => String(d.Identifier)),
    byKey<Rec>(a.DataSetIdentifierDeclarations, (d) => String(d.Identifier))
  );
  for (const [id] of datasets.added) {
    lines.push(`Dataset "${id}" added`);
    count(counts, 'dataset added');
  }
  for (const [id] of datasets.removed) {
    lines.push(`Dataset "${id}" removed`);
    count(counts, 'dataset removed');
  }
  for (const [id, old, now] of datasets.kept) {
    if (old.DataSetArn !== now.DataSetArn) {
      lines.push(`Dataset "${id}" now reads ${String(now.DataSetArn).split('/').pop()}`);
      count(counts, 'dataset rebound');
    }
  }

  const fields = compare(
    byKey<Rec>(b.CalculatedFields, (f) => `${f.DataSetIdentifier}:${f.Name}`),
    byKey<Rec>(a.CalculatedFields, (f) => `${f.DataSetIdentifier}:${f.Name}`)
  );
  for (const [, f] of fields.added) {
    lines.push(`Calculated field "${f.Name}" added`);
    count(counts, 'calculated field added');
  }
  for (const [, f] of fields.removed) {
    lines.push(`Calculated field "${f.Name}" removed`);
    count(counts, 'calculated field removed');
  }
  for (const [, old, now] of fields.kept) {
    if (old.Expression !== now.Expression) {
      lines.push(`Calculated field "${now.Name}" expression changed`);
      count(counts, 'calculated field changed');
    }
  }

  const params = compare(
    byKey<Rec>(
      (b.ParameterDeclarations ?? []).map((p: Rec) => Object.values(p)[0] as Rec),
      (p) => String(p?.Name)
    ),
    byKey<Rec>(
      (a.ParameterDeclarations ?? []).map((p: Rec) => Object.values(p)[0] as Rec),
      (p) => String(p?.Name)
    )
  );
  for (const [name] of params.added) {
    lines.push(`Parameter "${name}" added`);
    count(counts, 'parameter added');
  }
  for (const [name] of params.removed) {
    lines.push(`Parameter "${name}" removed`);
    count(counts, 'parameter removed');
  }

  const filters = compare(
    byKey<Rec>(b.FilterGroups, (g) => String(g.FilterGroupId)),
    byKey<Rec>(a.FilterGroups, (g) => String(g.FilterGroupId))
  );
  if (filters.added.length) {
    lines.push(`${plural(filters.added.length, 'filter group')} added`);
    counts['filter group added'] = filters.added.length;
  }
  if (filters.removed.length) {
    lines.push(`${plural(filters.removed.length, 'filter group')} removed`);
    counts['filter group removed'] = filters.removed.length;
  }
  const filtersChanged = filters.kept.filter(([, old, now]) => !same(old, now)).length;
  if (filtersChanged) {
    lines.push(`${plural(filtersChanged, 'filter group')} changed`);
    counts['filter group changed'] = filtersChanged;
  }

  const sheets = compare(
    byKey<Rec>(b.Sheets, (s) => String(s.SheetId)),
    byKey<Rec>(a.Sheets, (s) => String(s.SheetId))
  );
  for (const [, s] of sheets.added) {
    lines.push(
      `Sheet "${s.Name ?? s.SheetId}" added with ${plural((s.Visuals ?? []).length, 'visual')}`
    );
    count(counts, 'sheet added');
  }
  for (const [, s] of sheets.removed) {
    lines.push(`Sheet "${s.Name ?? s.SheetId}" removed`);
    count(counts, 'sheet removed');
  }
  for (const [, old, now] of sheets.kept) {
    if ((old.Name ?? '') !== (now.Name ?? '')) {
      lines.push(`Sheet "${old.Name}" renamed to "${now.Name}"`);
      count(counts, 'sheet renamed');
    }
    const visuals = compare(
      byKey<Rec>((old.Visuals ?? []).map(describeVisual), (v) => v.id),
      byKey<Rec>((now.Visuals ?? []).map(describeVisual), (v) => v.id)
    );
    for (const [, v] of visuals.added) {
      lines.push(`Visual ${label(v as any)} added on "${now.Name ?? now.SheetId}"`);
      count(counts, 'visual added');
    }
    for (const [, v] of visuals.removed) {
      lines.push(`Visual ${label(v as any)} removed from "${now.Name ?? now.SheetId}"`);
      count(counts, 'visual removed');
    }
    const oldVisuals = byKey<Rec>(old.Visuals, (v) => describeVisual(v).id);
    const newVisuals = byKey<Rec>(now.Visuals, (v) => describeVisual(v).id);
    for (const [id, was, is] of visuals.kept) {
      const w = was as any;
      const i = is as any;
      if (w.kind !== i.kind) {
        lines.push(`Visual ${label(i)} changed from ${w.kind} to ${i.kind}`);
        count(counts, 'visual retyped');
      } else if (w.title !== i.title) {
        lines.push(`Visual "${w.title || w.id.slice(0, ID_CHARS)}" retitled "${i.title}"`);
        count(counts, 'visual retitled');
      } else if (!same(oldVisuals.get(id), newVisuals.get(id))) {
        lines.push(`Visual ${label(i)} changed`);
        count(counts, 'visual changed');
      }
    }
    const elements = compare(layoutElements(old), layoutElements(now));
    for (const [id, was, is] of elements.kept) {
      if (placement(was) !== placement(is)) {
        const v = newVisuals.get(id);
        const resized = was.ColumnSpan !== is.ColumnSpan || was.RowSpan !== is.RowSpan;
        const moved = was.ColumnIndex !== is.ColumnIndex || was.RowIndex !== is.RowIndex;
        const what = v ? `Visual ${label(describeVisual(v))}` : `Element ${id.slice(0, ID_CHARS)}`;
        lines.push(
          `${what} ${moved && resized ? 'moved and resized' : moved ? 'moved' : 'resized'}`
        );
        count(
          counts,
          moved && resized ? 'visual moved and resized' : moved ? 'visual moved' : 'visual resized'
        );
      }
    }
  }
}

function tableLabel(key: string, table: Rec): string {
  if (table.RelationalTable) {
    const t = table.RelationalTable;
    return `table ${t.Schema ? `${t.Schema}.` : ''}${t.Name}`;
  }
  if (table.CustomSql) return `query "${table.CustomSql.Name ?? key}"`;
  if (table.S3Source) return 'S3 source';
  return `table ${key}`;
}

function describeDataset(before: Rec, after: Rec, lines: string[], counts: Counts): void {
  if (before.Name !== after.Name && (before.Name || after.Name)) {
    lines.push(`Renamed from "${before.Name}" to "${after.Name}"`);
    count(counts, 'renamed');
  }
  if ((before.ImportMode ?? '') !== (after.ImportMode ?? '')) {
    lines.push(`Import mode changed from ${before.ImportMode ?? 'unset'} to ${after.ImportMode}`);
    count(counts, 'import mode changed');
  }
  const tables = compare(
    byKey<[string, Rec]>(Object.entries(before.PhysicalTableMap ?? {}), ([k]) => k),
    byKey<[string, Rec]>(Object.entries(after.PhysicalTableMap ?? {}), ([k]) => k)
  );
  for (const [key, [, t]] of tables.added) {
    lines.push(`Reads ${tableLabel(key, t)} (added)`);
    count(counts, 'source added');
  }
  for (const [key, [, t]] of tables.removed) {
    lines.push(`No longer reads ${tableLabel(key, t)}`);
    count(counts, 'source removed');
  }
  for (const [key, [, was], [, is]] of tables.kept) {
    if (was.CustomSql && is.CustomSql && was.CustomSql.SqlQuery !== is.CustomSql.SqlQuery) {
      lines.push(`Query "${is.CustomSql.Name ?? key}" changed`);
      count(counts, 'query changed');
    } else if (!same(was, is)) {
      lines.push(`${tableLabel(key, is)} changed`);
      count(counts, 'source changed');
    }
  }

  const columns = compare(
    byKey<Rec>(before.OutputColumns, (c) => String(c.Name)),
    byKey<Rec>(after.OutputColumns, (c) => String(c.Name))
  );
  for (const [name] of columns.added) {
    lines.push(`Column "${name}" added`);
    count(counts, 'column added');
  }
  for (const [name] of columns.removed) {
    lines.push(`Column "${name}" removed`);
    count(counts, 'column removed');
  }
  for (const [name, was, is] of columns.kept) {
    if (was.Type !== is.Type) {
      lines.push(`Column "${name}" is now ${is.Type} (was ${was.Type})`);
      count(counts, 'column retyped');
    }
  }

  const calc = (described: Rec): Map<string, Rec> => {
    const out = new Map<string, Rec>();
    for (const table of Object.values(described.LogicalTableMap ?? {}) as Rec[]) {
      for (const transform of table.DataTransforms ?? []) {
        for (const column of transform?.CreateColumnsOperation?.Columns ?? []) {
          out.set(String(column.ColumnName), column);
        }
      }
    }
    return out;
  };
  const calcs = compare(calc(before), calc(after));
  for (const [name] of calcs.added) {
    lines.push(`Calculated column "${name}" added`);
    count(counts, 'calculated column added');
  }
  for (const [name] of calcs.removed) {
    lines.push(`Calculated column "${name}" removed`);
    count(counts, 'calculated column removed');
  }
  for (const [name, was, is] of calcs.kept) {
    if (was.Expression !== is.Expression) {
      lines.push(`Calculated column "${name}" expression changed`);
      count(counts, 'calculated column changed');
    }
  }
  if (!same(before.RowLevelPermissionDataSet, after.RowLevelPermissionDataSet)) {
    lines.push(
      after.RowLevelPermissionDataSet
        ? 'Row-level permissions changed'
        : 'Row-level permissions removed'
    );
    count(counts, 'row-level permissions changed');
  }
  if (!same(before.ColumnLevelPermissionRules, after.ColumnLevelPermissionRules)) {
    lines.push('Column-level permissions changed');
    count(counts, 'column-level permissions changed');
  }
}

function summarise(counts: Counts, entries: number): string {
  const parts = Object.entries(counts).map(([what, n]) => {
    // "visual added" → "2 visuals added"; the verb stays last.
    const words = what.split(' ');
    const verbs = words.length > 1 ? words.slice(-1) : [];
    const noun = words.slice(0, words.length - verbs.length).join(' ') || what;
    const name =
      n === 1
        ? noun
        : noun.endsWith('y')
          ? `${noun.slice(0, -1)}ies`
          : noun.endsWith('s') || noun.endsWith('ed')
            ? noun
            : `${noun}s`;
    return `${n} ${name}${verbs.length ? ` ${verbs.join(' ')}` : ''}`;
  });
  if (parts.length > 0) return parts.join(', ');
  if (entries > 0) return `${plural(entries, 'field')} changed`;
  return 'No change';
}

/** What changed from `before` to `after`, in words and as paths. */
export function diffDefinitions(
  assetType: VersionedAssetType,
  before: Rec | null,
  after: Rec
): DefinitionDiff {
  const detail = jsonDiff(before ?? {}, after);
  if (!before) {
    return {
      summary: 'First version seen',
      changes: ['First version the portal kept'],
      entries: detail.entries,
      truncated: detail.truncated,
    };
  }
  const lines: string[] = [];
  const counts: Counts = {};
  if (assetType === 'dataset') describeDataset(before, after, lines, counts);
  else describeExploration(before, after, lines, counts);
  const other = detail.entries.length;
  if (lines.length === 0 && other > 0) {
    lines.push(`${plural(other, 'field')} changed${detail.truncated ? ' (or more)' : ''}`);
  }
  return {
    summary: summarise(counts, other),
    changes:
      lines.length > MAX_LINES
        ? [...lines.slice(0, MAX_LINES), `… and ${lines.length - MAX_LINES} more`]
        : lines,
    entries: detail.entries,
    truncated: detail.truncated,
  };
}
