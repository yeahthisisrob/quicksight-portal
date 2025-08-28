/**
 * Utility functions for handling and processing expressions
 */

interface Expression {
  expression: string;
  sources: Array<{
    assetType: string;
    assetId: string;
    assetName: string;
    [key: string]: any;
  }>;
}

/**
 * Deduplicates expressions by merging sources for identical expressions
 * @param expressions - Array of expressions to deduplicate
 * @returns Array of unique expressions with merged sources
 */
export function deduplicateExpressions(expressions: Expression[]): Expression[] {
  if (!expressions || expressions.length === 0) {
    return [];
  }

  return expressions.reduce((acc, expr) => {
    const existing = acc.find(e => e.expression === expr.expression);
    
    if (existing) {
      // Merge sources, avoiding duplicates
      expr.sources.forEach(source => {
        if (!existing.sources.some(s => s.assetId === source.assetId)) {
          existing.sources.push(source);
        }
      });
    } else {
      // Create a new entry with a copy of sources
      acc.push({
        expression: expr.expression,
        sources: [...expr.sources]
      });
    }
    
    return acc;
  }, [] as Expression[]);
}

/**
 * Counts unique expressions in an array
 * @param expressions - Array of expressions
 * @returns Number of unique expressions
 */
export function countUniqueExpressions(expressions: Expression[]): number {
  if (!expressions || expressions.length === 0) {
    return 0;
  }
  
  const uniqueExpressions = new Set(expressions.map(e => e.expression));
  return uniqueExpressions.size;
}

/**
 * Checks if expressions array has multiple unique variations
 * @param expressions - Array of expressions
 * @returns True if there are multiple unique expressions
 */
export function hasMultipleVariations(expressions: Expression[]): boolean {
  return countUniqueExpressions(expressions) > 1;
}