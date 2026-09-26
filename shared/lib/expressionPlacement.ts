/**
 * Where a calculated field belongs, and so how it is evaluated.
 *
 * - Row-level (scalar) fields can be materialised: in SPICE they are
 *   computed once at ingestion, on direct query they are pushed into the
 *   SQL, and at the source (gold) they are a column every dataset shares.
 *   The strategy is to push these down to gold.
 * - Anything that aggregates, any table calculation or level-aware
 *   calculation, and anything that reads a parameter depends on how a
 *   visual groups the data, so it can only be computed at query time, in
 *   the analysis or dashboard.
 *
 * Pure, and shared by the backend (the assistant and the planner) and the
 * frontend (the catalog), so both classify a field the same way.
 */
import { functionCategories, isLACFunction } from './functionCategories';

export type FieldPlacement = 'row-level' | 'query-time';

export interface PlacementVerdict {
  placement: FieldPlacement;
  /** The functions that forced query-time, if any. */
  reasons: string[];
}

const QUERY_TIME_CATEGORIES = new Set(['Aggregate Functions', 'Table Calculation Functions']);

/** Every function name as it appears in an expression, lower-cased, mapped to its category. */
const CATEGORY_BY_NAME = new Map<string, string>(
  Object.entries(functionCategories).flatMap(([key, value]) => [
    [key.toLowerCase(), value.category],
    [value.standardFunction.toLowerCase(), value.category],
  ])
);

/** `name(` calls in an expression, ignoring string literals and `{column}` tokens. */
function calledFunctions(expression: string): string[] {
  const stripped = expression.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\{[^{}]*\}/g, ' ');
  return [...stripped.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]!);
}

export function placementOf(expression: string): PlacementVerdict {
  const reasons: string[] = [];
  for (const fn of calledFunctions(expression)) {
    const category = CATEGORY_BY_NAME.get(fn.toLowerCase());
    if (category && QUERY_TIME_CATEGORIES.has(category)) {
      reasons.push(fn);
    } else if (/_?lac$/i.test(fn) || (isLACFunction(fn) && /\[/.test(expression))) {
      reasons.push(fn);
    }
  }
  if (/\$\{[^}]+\}/.test(expression)) {
    reasons.push('a parameter');
  }
  return {
    placement: reasons.length > 0 ? 'query-time' : 'row-level',
    reasons: [...new Set(reasons)],
  };
}

/** Column and field names compared the way people write them: case, spaces and underscores ignored. */
export function sameFieldName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  return norm(a) === norm(b);
}
