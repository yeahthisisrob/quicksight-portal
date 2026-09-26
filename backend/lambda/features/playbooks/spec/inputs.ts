/** Filling a spec's `{{input}}` placeholders from the values it was previewed with. */
const PLACEHOLDER = /^\{\{\s*([\w-]+)\s*\}\}$/;

export function resolve<T>(
  value: T | string | undefined,
  params: Record<string, unknown>
): unknown {
  if (typeof value !== 'string') return value;
  const match = PLACEHOLDER.exec(value);
  return match ? params[match[1]!] : value;
}

export function resolveText(value: unknown, params: Record<string, unknown>): string {
  const resolved = resolve(value, params);
  return resolved === undefined || resolved === null ? '' : String(resolved);
}

export function resolveBoolean(value: unknown, params: Record<string, unknown>): boolean {
  const resolved = resolve(value, params);
  return resolved === true || resolved === 'true';
}
