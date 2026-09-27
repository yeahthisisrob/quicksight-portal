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
import { classifyExpression } from './expressionKinds';

export type FieldPlacement = 'row-level' | 'query-time';

export interface PlacementVerdict {
  placement: FieldPlacement;
  /** The functions that forced query-time, and 'a parameter' when one is read. */
  reasons: string[];
}

/** Row-level or query-time; ./expressionKinds has the full verdict (kind, stage, calc level). */
export function placementOf(expression: string): PlacementVerdict {
  const verdict = classifyExpression(expression);
  const reasons = [
    ...verdict.functions.filter((f) => f.kind !== 'scalar').map((f) => f.name),
    ...(verdict.parameters.length ? ['a parameter'] : []),
  ];
  return { placement: verdict.materialisable ? 'row-level' : 'query-time', reasons };
}

/**
 * A column or field name as people mean it: case, spaces, separators and
 * camel-case humps carry no meaning, so `Customer ID`, `customer-id`,
 * `CustomerId` and `customer_id` are one name.
 */
export function normalFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sameFieldName(a: string, b: string): boolean {
  return normalFieldName(a) === normalFieldName(b);
}
