/**
 * Requests checked against the served contract (shared/generated/openapi.json):
 * the path must be a real operation, and the body must have the fields,
 * types and enums its schema requires. Used at the API boundary for every
 * request (apiHandler), so a handler receives a body that fits its schema
 * and never has to re-pick fields from it, and by the assistant before it
 * prepares a write. Deliberately small (no ajv): required, type, enum,
 * minItems, items, properties, $ref, allOf, oneOf/anyOf. Extra fields pass.
 */
import served from '../../../../shared/generated/openapi.json';
export interface SpecLike {
  paths?: Record<string, Record<string, any>>;
  components?: Record<string, Record<string, any>>;
}

const MAX_ERRORS = 8;
const MAX_DEPTH = 12;

/** The template path (/api/authoring/{assetType}/{assetId}/rebind) a concrete path belongs to. */
export function matchOperation(spec: SpecLike, method: string, path: string): string | undefined {
  const pathname = path.split('?')[0] ?? '';
  const m = method.toLowerCase();
  const candidates = Object.keys(spec.paths ?? {}).filter((t) => spec.paths?.[t]?.[m]);
  // Literal segments beat templates: /api/authoring/new before /api/authoring/{assetType}.
  const literal = candidates.find((t) => t === pathname);
  if (literal) {
    return literal;
  }
  return candidates.find((t) =>
    new RegExp(`^${t.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`).test(
      pathname
    )
  );
}

function requestSchema(spec: SpecLike, method: string, template: string): unknown {
  return spec.paths?.[template]?.[method.toLowerCase()]?.requestBody?.content?.['application/json']
    ?.schema;
}

function deref(spec: SpecLike, node: any): any {
  let current = node;
  for (let i = 0; i < MAX_DEPTH && current && typeof current.$ref === 'string'; i++) {
    const [, , kind, name] = current.$ref.split('/');
    current = spec.components?.[kind]?.[name];
  }
  return current;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  // A Date in a body goes out as its ISO string.
  if (value instanceof Date) return 'string';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

interface CheckOptions {
  /** Check only the first N items of an array (responses can be thousands of rows). */
  sample?: number;
  /** Report fields the schema does not declare (responses: the contract must say all of it). */
  strict?: boolean;
}

/** Every property an object schema declares, across its allOf parts. */
function declaredProperties(spec: SpecLike, schema: any, depth = 0): Set<string> | null {
  if (!schema || depth > MAX_DEPTH) return new Set();
  if (schema.additionalProperties === true || typeof schema.additionalProperties === 'object') {
    return null; // an open map: anything goes
  }
  const names = new Set<string>(Object.keys(schema.properties ?? {}));
  for (const part of schema.allOf ?? []) {
    const inner = declaredProperties(spec, deref(spec, part), depth + 1);
    if (inner === null) return null;
    for (const n of inner) names.add(n);
  }
  return names;
}

function check(
  spec: SpecLike,
  schemaNode: any,
  value: unknown,
  at: string,
  errors: string[],
  depth: number,
  options: CheckOptions = {}
): void {
  const schema = deref(spec, schemaNode);
  if (!schema || typeof schema !== 'object' || depth > MAX_DEPTH || errors.length >= MAX_ERRORS) {
    return;
  }
  const where = at || 'body';
  if (Array.isArray(schema.allOf)) {
    // Each part checks its own fields; undeclared ones are judged once, over all parts, below.
    for (const part of schema.allOf) {
      check(spec, part, value, at, errors, depth + 1, { ...options, strict: false });
    }
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(alternatives) && alternatives.length > 0) {
    const fits = alternatives.some((alt: any) => {
      const trial: string[] = [];
      check(spec, alt, value, at, trial, depth + 1, options);
      return trial.length === 0;
    });
    if (!fits) errors.push(`${where}: matches none of the allowed shapes`);
  }
  const actual = typeOf(value);
  if (schema.type) {
    const ok =
      schema.type === actual ||
      (schema.type === 'number' && actual === 'integer') ||
      (schema.nullable === true && actual === 'null');
    if (!ok) {
      errors.push(`${where}: expected ${schema.type}, got ${actual}`);
      return;
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${where}: must be one of ${schema.enum.join(', ')}`);
  }
  if (actual === 'array') {
    const items = value as unknown[];
    if (typeof schema.minItems === 'number' && items.length < schema.minItems) {
      errors.push(
        `${where}: needs at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`
      );
    }
    if (schema.items) {
      const checked = options.sample === undefined ? items : items.slice(0, options.sample);
      checked.forEach((item, i) =>
        check(spec, schema.items, item, `${where}[${i}]`, errors, depth + 1, options)
      );
    }
  }
  if (actual === 'object' && (schema.properties || schema.required)) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) errors.push(`${at ? `${at}.` : ''}${key}: required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (record[key] !== undefined) {
        check(spec, sub, record[key], at ? `${at}.${key}` : key, errors, depth + 1, options);
      }
    }
  }
  if (options.strict && actual === 'object' && !(schema.oneOf ?? schema.anyOf)) {
    const declared = declaredProperties(spec, schema);
    if (declared && declared.size > 0) {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if (!declared.has(key)) {
          errors.push(`${at ? `${at}.` : ''}${key}: not in the contract`);
        }
      }
    }
  }
}

/**
 * Required query parameters the path leaves out (a delete needs its
 * reason), empty when it has them all. Parameters may be references to
 * the spec's shared ones.
 */
export function queryErrors(
  spec: SpecLike,
  method: string,
  template: string,
  path: string
): string[] {
  const item = spec.paths?.[template];
  const op = item?.[method.toLowerCase()];
  if (!op) return [];
  const resolve = (p: any) =>
    typeof p?.$ref === 'string'
      ? (spec.components?.parameters?.[p.$ref.split('/').pop() as string] ?? p)
      : p;
  const given = new URLSearchParams(path.split('?')[1] ?? '');
  return [...(item.parameters ?? []), ...(op.parameters ?? [])]
    .map(resolve)
    .filter((p: any) => p?.in === 'query' && p.required && !given.get(p.name))
    .map((p: any) => `query ${p.name}: required${p.description ? ` (${p.description})` : ''}`);
}

/** What is wrong with a body for this operation, empty when it fits. */
export function bodyErrors(
  spec: SpecLike,
  method: string,
  template: string,
  body: unknown
): string[] {
  const schema = requestSchema(spec, method, template);
  if (!schema) {
    return [];
  }
  const required = spec.paths?.[template]?.[method.toLowerCase()]?.requestBody?.required === true;
  if (body === undefined) {
    return required ? ['body: required'] : [];
  }
  const errors: string[] = [];
  check(spec, schema, body, '', errors, 0);
  return errors.slice(0, MAX_ERRORS);
}

/** The top-level fields an operation's body schema names (empty when it names none). */
export function bodyFields(spec: SpecLike, method: string, template: string): string[] {
  const schema = deref(spec, requestSchema(spec, method, template));
  const parts = [schema, ...((schema?.allOf as unknown[]) ?? []).map((p) => deref(spec, p))];
  return [...new Set(parts.flatMap((p: any) => Object.keys(p?.properties ?? {})))];
}

/**
 * What is wrong with a request's body for the served contract: empty when
 * it fits, or when the path is not an operation (routing answers that).
 * `path` is the full path, with /api.
 */
export function requestErrors(method: string, path: string, body: unknown): string[] {
  const contract = served as SpecLike;
  const template = matchOperation(contract, method, path);
  return template ? bodyErrors(contract, method, template, body) : [];
}

const RESPONSE_SAMPLE = 25;

/** The documented response schema for a status: its own, its class (4XX), or default. */
function responseSchema(spec: SpecLike, method: string, template: string, status: number) {
  const responses = spec.paths?.[template]?.[method.toLowerCase()]?.responses ?? {};
  const response =
    responses[String(status)] ?? responses[`${String(status)[0]}XX`] ?? responses.default;
  const resolved =
    typeof response?.$ref === 'string'
      ? spec.components?.responses?.[response.$ref.split('/').pop() as string]
      : response;
  return resolved ? { schema: resolved.content?.['application/json']?.schema } : undefined;
}

/**
 * What is wrong with a response for the served contract: a status it does
 * not document, a field it does not declare, a declared field missing or of
 * the wrong type. Errors are held to the shared Error envelope when the
 * operation does not document that status. `path` may leave out /api.
 */
export function responseErrors(
  method: string,
  path: string,
  status: number,
  body: unknown,
  spec: SpecLike = served as SpecLike
): string[] {
  const full = path.startsWith('/api') ? path : `/api${path}`;
  const template = matchOperation(spec, method, full);
  if (!template) return [];
  const documented = responseSchema(spec, method, template, status);
  const HTTP_ERROR = 400;
  const schema =
    documented?.schema ??
    (status >= HTTP_ERROR ? { $ref: '#/components/schemas/Error' } : undefined);
  if (!schema) {
    return documented ? [] : [`${status}: not a documented response`];
  }
  const errors: string[] = [];
  check(spec, schema, body, '', errors, 0, { sample: RESPONSE_SAMPLE, strict: true });
  return errors.slice(0, MAX_ERRORS);
}
