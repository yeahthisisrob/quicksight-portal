/** Arrow-key movement over a list: wraps at both ends, stays put on an empty list. */
export function moveSelection(index: number, delta: number, count: number): number {
  if (count <= 0) {
    return -1;
  }
  const from = index < 0 ? (delta > 0 ? -1 : 0) : index;
  return (((from + delta) % count) + count) % count;
}
