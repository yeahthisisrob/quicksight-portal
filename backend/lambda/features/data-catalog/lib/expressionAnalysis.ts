/**
 * Pure utilities for analysing QuickSight calculated-field expressions.
 *
 * These functions are deliberately side-effect free so the catalog index can
 * bake their results in once at build time (see CatalogIndexBuilder) and the
 * frontend can rely on server-computed values instead of re-deriving them.
 */

/**
 * QuickSight expressions reference other fields with brace syntax: {Field Name}.
 * Mirror of the frontend regex in UnifiedFieldDetailsDialog so client and
 * server agree on what a "dependency" is.
 */
const FIELD_REFERENCE_PATTERN = /\{([^}]+)\}/g;

/**
 * Extract the distinct field names referenced inside an expression.
 *
 * @param expression the raw calculated-field expression
 * @param selfFieldName optional name of the field that owns the expression; it
 *   is excluded from the result so a field is never listed as its own dependency
 */
export function extractFieldReferences(
  expression: string | null | undefined,
  selfFieldName?: string
): string[] {
  if (!expression) {
    return [];
  }

  const references: string[] = [];
  // Reset lastIndex defensively since the regex is module-scoped and stateful.
  FIELD_REFERENCE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FIELD_REFERENCE_PATTERN.exec(expression)) !== null) {
    const fieldName = match[1]?.trim();
    if (!fieldName) {
      continue;
    }
    if (selfFieldName && fieldName === selfFieldName) {
      continue;
    }
    if (!references.includes(fieldName)) {
      references.push(fieldName);
    }
  }

  return references;
}

/**
 * Detect whether an expression contains author comments.
 * QuickSight allows both block (slash-star ... star-slash) and line (//) comments.
 */
export function hasComments(expression: string | null | undefined): boolean {
  if (!expression) {
    return false;
  }
  return /\/\*[\s\S]*?\*\//.test(expression) || /(^|[^:])\/\/.*$/m.test(expression);
}

/**
 * Length of the expression with surrounding whitespace trimmed.
 * Drives the colour-coded "Expression Length" chip on the frontend.
 */
export function expressionLength(expression: string | null | undefined): number {
  if (!expression) {
    return 0;
  }
  return expression.trim().length;
}

/**
 * Normalise an expression for conflict comparison: collapse whitespace and trim,
 * so two expressions that differ only in formatting are not treated as a conflict.
 */
export function normalizeExpression(expression: string | null | undefined): string {
  if (!expression) {
    return '';
  }
  return expression.replace(/\s+/g, ' ').trim();
}

export interface ConflictResult {
  /** True when the same field name resolves to more than one distinct expression. */
  hasExpressionConflict: boolean;
  /** Number of distinct (normalised) expressions found for the field. */
  conflictCount: number;
}

/**
 * Determine whether a set of expressions for a single field name conflict.
 * Empty/blank expressions are ignored.
 */
export function detectConflict(expressions: Array<string | null | undefined>): ConflictResult {
  const distinct = new Set<string>();
  for (const expr of expressions) {
    const normalized = normalizeExpression(expr);
    if (normalized) {
      distinct.add(normalized);
    }
  }
  return {
    hasExpressionConflict: distinct.size > 1,
    conflictCount: distinct.size,
  };
}
