/**
 * The contract as JSON, for the API to serve and the frontend to render.
 * Same source as the generated types, produced by the same `contract` run,
 * so the three never drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../shared/schemas/api.openapi.yaml');
const target = resolve(here, '../../shared/generated/openapi.json');

const spec = yaml.load(readFileSync(source, 'utf8'));
writeFileSync(target, `${JSON.stringify(spec)}\n`);
process.stdout.write(`${source} → ${target}\n`);
