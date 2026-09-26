/**
 * Checks a request the assistant prepares against the served contract,
 * before the person ever sees a Run button: the path must be a real
 * operation, and the body must have the fields, types and enums its
 * schema requires. Deliberately small (no ajv): required, type, enum,
 * minItems, items, properties, $ref, allOf, oneOf/anyOf. Extra fields
 * pass, as they do in the handlers.
 */
interface SpecLike {
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
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function check(
  spec: SpecLike,
  schemaNode: any,
  value: unknown,
  at: string,
  errors: string[],
  depth: number
): void {
  const schema = deref(spec, schemaNode);
  if (!schema || typeof schema !== 'object' || depth > MAX_DEPTH || errors.length >= MAX_ERRORS) {
    return;
  }
  const where = at || 'body';
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf) check(spec, part, value, at, errors, depth + 1);
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(alternatives) && alternatives.length > 0) {
    const fits = alternatives.some((alt: any) => {
      const trial: string[] = [];
      check(spec, alt, value, at, trial, depth + 1);
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
      items.forEach((item, i) =>
        check(spec, schema.items, item, `${where}[${i}]`, errors, depth + 1)
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
        check(spec, sub, record[key], at ? `${at}.${key}` : key, errors, depth + 1);
      }
    }
  }
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
