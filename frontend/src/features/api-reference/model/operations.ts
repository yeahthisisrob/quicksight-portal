/**
 * The API reference, read from the contract the API itself serves. Pure:
 * an OpenAPI document in, operations out, plus search, grouping and the
 * curl a person (or an agent) would paste. Nothing here knows about React.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiParameter {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  type: string;
  description?: string;
}

export interface ApiOperation {
  id: string;
  method: HttpMethod;
  path: string;
  /** The first path segment after /api, as a heading: "Data catalog", "Jobs". */
  area: string;
  summary: string;
  description: string;
  parameters: ApiParameter[];
  /** The body schema's name, or "object" for an inline one. */
  requestBody?: string;
  /** A minimal JSON body built from the schema: required fields with placeholder values. */
  requestExample?: string;
  /** The `data` schema's name when the response is the portal's envelope. */
  responseSchema?: string;
  /** Returns 202 with a jobId to follow under /api/jobs. */
  job: boolean;
}

/** As much of an OpenAPI 3 document as the reference reads. */
export interface OpenApiDocument {
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    parameters?: Record<string, any>;
    requestBodies?: Record<string, any>;
  };
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const MAX_EXAMPLE_DEPTH = 3;

const AREA_LABELS: Record<string, string> = {
  'api-docs': 'API docs',
  activity: 'Activity',
  assets: 'Assets',
  authoring: 'Authoring',
  'data-catalog': 'Data catalog',
  deployments: 'Deployments',
  export: 'Export',
  folders: 'Folders',
  groups: 'Groups',
  ingestions: 'Ingestions',
  jobs: 'Jobs',
  scripts: 'Scripts',
  search: 'Search',
  settings: 'Settings',
  smus: 'SMUS',
  tags: 'Tags',
  users: 'Users',
};

/** The order areas are listed in: what an agent reads first, then what it writes with. */
const AREA_ORDER = [
  'API docs',
  'Search',
  'Assets',
  'Data catalog',
  'Authoring',
  'Jobs',
  'SMUS',
  'Activity',
  'Tags',
  'Folders',
  'Groups',
  'Users',
  'Ingestions',
  'Export',
  'Deployments',
  'Settings',
  'Scripts',
];

function refName(ref: unknown): string | undefined {
  return typeof ref === 'string' ? ref.split('/').pop() : undefined;
}

function resolve(doc: OpenApiDocument, node: any): any {
  if (node && typeof node.$ref === 'string') {
    const [, , kind, name] = node.$ref.split('/');
    const bucket = (doc.components as any)?.[kind];
    return bucket?.[name] ?? node;
  }
  return node;
}

function schemaTypeName(schema: any): string {
  if (!schema) {
    return 'string';
  }
  if (schema.$ref) {
    return refName(schema.$ref) ?? 'object';
  }
  if (schema.enum) {
    return schema.enum.join(' | ');
  }
  if (schema.type === 'array') {
    return `${schemaTypeName(schema.items)}[]`;
  }
  return schema.type ?? 'object';
}

function areaOf(path: string): string {
  const segment = path.replace(/^\/api\//, '').split('/')[0] ?? '';
  return AREA_LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function firstSentence(text: string): string {
  return text.trim().split(/\n\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
}

/** A placeholder value of a schema's type, so the example is valid JSON of the right shape. */
function placeholder(doc: OpenApiDocument, schema: any, depth: number): unknown {
  const s = resolve(doc, schema);
  if (!s || depth > MAX_EXAMPLE_DEPTH) {
    return '…';
  }
  if (s.allOf) {
    return Object.assign({}, ...s.allOf.map((part: any) => placeholder(doc, part, depth + 1)));
  }
  if (s.enum) {
    return s.enum[0];
  }
  switch (s.type) {
    case 'array':
      return [placeholder(doc, s.items, depth + 1)];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'string':
      return s.format === 'date-time' ? '2026-01-01T00:00:00Z' : (s.example ?? '…');
    default: {
      const props: Record<string, unknown> = s.properties ?? {};
      const required: string[] = s.required ?? Object.keys(props).slice(0, 4);
      const out: Record<string, unknown> = {};
      for (const key of required) {
        if (props[key] !== undefined) {
          out[key] = placeholder(doc, props[key], depth + 1);
        }
      }
      return out;
    }
  }
}

export function parseOperations(doc: OpenApiDocument): ApiOperation[] {
  const out: ApiOperation[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const shared = (item.parameters ?? []).map((p: any) => resolve(doc, p));
    for (const method of METHODS) {
      const op = item[method.toLowerCase()];
      if (!op) {
        continue;
      }
      const parameters: ApiParameter[] = [...shared, ...(op.parameters ?? [])]
        .map((p: any) => resolve(doc, p))
        .filter((p: any) => p && (p.in === 'path' || p.in === 'query'))
        .map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.in === 'path' ? true : Boolean(p.required),
          type: schemaTypeName(p.schema),
          ...(p.description ? { description: firstSentence(p.description) } : {}),
        }));
      const body = resolve(doc, op.requestBody);
      const bodySchema = body?.content?.['application/json']?.schema;
      const responses = op.responses ?? {};
      const ok = responses['200'] ?? responses['201'] ?? responses['202'];
      const okSchema = resolve(doc, ok)?.content?.['application/json']?.schema;
      const data = okSchema?.properties?.data;
      const responseSchema = data ? (refName(data.$ref) ?? schemaTypeName(data)) : undefined;
      out.push({
        id: `${method} ${path}`,
        method,
        path,
        area: areaOf(path),
        summary: op.summary ?? path,
        description: (op.description ?? '').trim(),
        parameters,
        ...(bodySchema ? { requestBody: schemaTypeName(bodySchema) } : {}),
        ...(bodySchema
          ? { requestExample: JSON.stringify(placeholder(doc, bodySchema, 0), null, 2) }
          : {}),
        ...(responseSchema ? { responseSchema } : {}),
        job:
          Boolean(responses['202']) ||
          /queues? a job|as a job/i.test(`${op.summary ?? ''} ${op.description ?? ''}`),
      });
    }
  }
  return out;
}

/** Every word of the query has to appear somewhere in the operation. */
export function searchOperations(operations: ApiOperation[], query: string): ApiOperation[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return operations;
  }
  return operations.filter((op) => {
    const haystack =
      `${op.method} ${op.path} ${op.area} ${op.summary} ${op.description} ${op.requestBody ?? ''} ${op.responseSchema ?? ''}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export interface ApiArea {
  area: string;
  operations: ApiOperation[];
}

export function groupByArea(operations: ApiOperation[]): ApiArea[] {
  const byArea = new Map<string, ApiOperation[]>();
  for (const op of operations) {
    byArea.set(op.area, [...(byArea.get(op.area) ?? []), op]);
  }
  const rank = (area: string) => {
    const index = AREA_ORDER.indexOf(area);
    return index < 0 ? AREA_ORDER.length : index;
  };
  return [...byArea.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([area, ops]) => ({ area, operations: ops }));
}

/** The request as a shell line, with the key and URL from the environment the guide sets up. */
export function curlFor(op: ApiOperation, options: { compact?: boolean } = {}): string {
  const query = op.parameters
    .filter((p) => p.in === 'query' && p.required)
    .map((p) => `${p.name}=…`)
    .join('&');
  const url = `"$QSP_API_URL${op.path}${query ? `?${query}` : ''}"`;
  const parts = [`curl -sS -X ${op.method} ${url}`, `-H "Authorization: Bearer $QSP_API_KEY"`];
  if (op.requestExample) {
    const body = options.compact
      ? JSON.stringify(JSON.parse(op.requestExample))
      : op.requestExample;
    parts.push(`-H "Content-Type: application/json"`, `--data '${body}'`);
  }
  return parts.join(' \\\n  ');
}
