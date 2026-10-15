/**
 * The name a copy gets when nobody named it: the next version of the
 * original, counted among the names that exist. "Sales review" becomes
 * "Sales review v2"; a copy of "Sales review v2" (or of the original, once
 * v2 exists) becomes "Sales review v3". The old " (copy)" suffix is treated
 * as a version too, so copies made before this never chain. Pure.
 */

const VERSION_SUFFIX = /\s+(?:v(\d+)|\(copy\))$/i;
const FIRST_COPY = 2;

/** The name without its version suffix. */
export function rootName(name: string): string {
  return name.replace(VERSION_SUFFIX, '').trim();
}

function versionOf(name: string, root: string): number | undefined {
  if (rootName(name).toLowerCase() !== root.toLowerCase()) return undefined;
  const match = name.match(VERSION_SUFFIX);
  if (!match) return 1;
  return match[1] ? Number(match[1]) : FIRST_COPY;
}

/** The next free "<root> v<n>" among the names in use. */
export function nextVersionName(current: string, existing: Iterable<string>): string {
  const root = rootName(current);
  let highest = versionOf(current, root) ?? 1;
  for (const name of existing) {
    const version = versionOf(name, root);
    if (version !== undefined && version > highest) highest = version;
  }
  return `${root} v${Math.max(highest + 1, FIRST_COPY)}`;
}
