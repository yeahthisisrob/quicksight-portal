/**
 * What the assistant may do with the portal's API, and what it reads to
 * know the API. Pure: a method and a path in, a verdict out.
 *
 * - read: GETs, and POSTs that only compute (previews, plans, validations,
 *   lookups). The assistant runs these itself.
 * - action: everything that writes. The assistant prepares it; the person
 *   runs it, under their own session, from the chat.
 * - blocked: settings, keys, scripts and the assistant itself. Never.
 */

export type CallVerdict = 'read' | 'action' | 'blocked';

const BLOCKED = [/^\/api\/settings(\/|$)/, /^\/api\/scripts(\/|$)/, /^\/api\/assistant(\/|$)/];

/**
 * POSTs that compute and write nothing. The planner's propose calls are
 * among them: they queue a job, but the job only answers; applying its
 * proposal is a separate write.
 */
const READ_ONLY_POSTS = [
  /\/propose$/,
  /\/preview$/,
  /\/plan$/,
  /\/validate$/,
  /^\/api\/tags\/batch$/,
  /^\/api\/data-catalog\/fields\/search-by-tags$/,
  /^\/api\/smus\/dataset-links$/,
  /^\/api\/activity\/(recipients|user-inactive-analyses|user-unused-datasets)$/,
];

export function classifyCall(method: string, path: string): CallVerdict {
  const pathname = path.split('?')[0] ?? '';
  if (!pathname.startsWith('/api/') || BLOCKED.some((re) => re.test(pathname))) {
    return 'blocked';
  }
  const m = method.toUpperCase();
  if (m === 'GET') {
    return 'read';
  }
  if (m === 'POST' && READ_ONLY_POSTS.some((re) => re.test(pathname))) {
    return 'read';
  }
  return m === 'POST' || m === 'PUT' || m === 'DELETE' ? 'action' : 'blocked';
}

interface SpecLike {
  paths?: Record<string, Record<string, any>>;
  components?: Record<string, Record<string, any>>;
}

const METHODS = ['get', 'post', 'put', 'delete'];

/** One line per operation: the map the assistant navigates by. */
export function apiIndex(spec: SpecLike): string {
  const lines: string[] = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op || classifyCall(method, path) === 'blocked') {
        continue;
      }
      lines.push(`${method.toUpperCase()} ${path} - ${op.summary ?? ''}`.trim());
    }
  }
  return lines.join('\n');
}

function resolveRef(spec: SpecLike, node: any, depth: number): any {
  if (depth > 2 || !node || typeof node !== 'object') {
    return node;
  }
  if (typeof node.$ref === 'string') {
    const [, , kind, name] = node.$ref.split('/');
    return resolveRef(spec, spec.components?.[kind]?.[name] ?? node, depth + 1);
  }
  if (Array.isArray(node)) {
    return node.map((n) => resolveRef(spec, n, depth));
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveRef(spec, v, depth)]));
}

const MAX_DESCRIBE_CHARS = 8_000;

/** The operation's parameters, body and response, two references deep. */
export function describeOperation(spec: SpecLike, method: string, path: string): string {
  const item = spec.paths?.[path];
  const op = item?.[method.toLowerCase()];
  if (!op) {
    return `No operation ${method.toUpperCase()} ${path}. Paths are templates exactly as the index lists them, e.g. /api/assets/{assetType}/{assetId}/cached.`;
  }
  const text = JSON.stringify(
    {
      summary: op.summary,
      description: op.description,
      parameters: resolveRef(spec, [...(item.parameters ?? []), ...(op.parameters ?? [])], 0),
      requestBody: resolveRef(spec, op.requestBody?.content?.['application/json']?.schema, 0),
      response: resolveRef(
        spec,
        (op.responses?.['200'] ?? op.responses?.['202'])?.content?.['application/json']?.schema,
        0
      ),
    },
    null,
    1
  );
  return text.length > MAX_DESCRIBE_CHARS
    ? `${text.slice(0, MAX_DESCRIBE_CHARS)}\n[truncated]`
    : text;
}
