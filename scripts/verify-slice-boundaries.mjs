#!/usr/bin/env node
/**
 * Backend vertical slices do not import each other. Biome's import globs
 * cannot say "a different slice" for relative paths, so this resolves each
 * relative import (static, dynamic, vi.mock) of every file under
 * backend/lambda/features/<slice>/ and fails on one that lands in another
 * slice. What slices share lives in shared/; composition (wiring one slice's
 * service into a port another reads) lives at the roots: api/, jobs/,
 * worker.ts, index.ts.
 *
 * It proves itself first on a made-up violation, so a regex that stops
 * matching fails loudly instead of passing everything.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const lambda = join(repoRoot, 'backend', 'lambda');
const features = join(lambda, 'features');
const IMPORT = /(?:from|import\(|vi\.(?:mock|doMock)\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;

/** The slice a path is in, or null outside features/. */
function sliceOf(path) {
  const rel = relative(features, path);
  if (rel.startsWith('..')) return null;
  return rel.split(sep)[0];
}

function violations(file, source) {
  const mine = sliceOf(file);
  if (!mine) return [];
  const found = [];
  for (const match of source.matchAll(IMPORT)) {
    const target = normalize(join(dirname(file), match[1]));
    const theirs = sliceOf(target);
    if (theirs && theirs !== mine)
      found.push(`${relative(repoRoot, file)} imports ${match[1]} (slice ${theirs})`);
  }
  return found;
}

function* tsFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* tsFiles(path);
    else if (name.endsWith('.ts')) yield path;
  }
}

// Prove the check before trusting it.
const proof = violations(
  join(features, 'authoring', 'services', 'x.ts'),
  "import { A } from '../../organization/services/A';\nimport { B } from '../../../shared/services/B';\n"
);
if (proof.length !== 1) {
  console.error('verify-slice-boundaries: the check no longer detects a cross-slice import');
  process.exit(1);
}

const all = [...tsFiles(features)].flatMap((file) => violations(file, readFileSync(file, 'utf8')));
if (all.length > 0) {
  console.error(
    `Slices import each other (move shared code to shared/, or wire a port at a root):\n${all.map((v) => `  ${v}`).join('\n')}`
  );
  process.exit(1);
}
console.log('No backend slice imports another.');
