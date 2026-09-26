/**
 * Tokens for search: lowercase, split on anything that is not a letter or
 * digit, and additionally on camelCase and snake_case boundaries so
 * `orderDate`, `order_date` and "Order Date" all become [order, date].
 * A few very common words are dropped so "the sales dashboard" scores on
 * sales and dashboard.
 */
const STOP = new Set([
  'the',
  'a',
  'an',
  'of',
  'for',
  'and',
  'or',
  'to',
  'in',
  'on',
  'by',
  'with',
  'from',
  'that',
  'this',
  'is',
  'are',
  'me',
  'my',
  'our',
  'show',
  'find',
  'get',
  'all',
  'any',
  'one',
  'it',
]);

export function tokenize(text: string): string[] {
  if (!text) {
    return [];
  }
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Query tokens keep single characters out and dedupe. */
export function queryTokens(query: string): string[] {
  return [...new Set(tokenize(query))];
}
