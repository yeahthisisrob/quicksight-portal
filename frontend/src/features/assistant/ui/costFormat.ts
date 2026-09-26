const CENTS_THRESHOLD = 0.01;

/** "$0.004", "$0.04", "$1.20": enough precision to compare, not to invoice. */
export function formatCost(dollars: number): string {
  if (dollars <= 0) {
    return '$0';
  }
  if (dollars < CENTS_THRESHOLD) {
    return `$${dollars.toFixed(3)}`;
  }
  return `$${dollars.toFixed(2)}`;
}
