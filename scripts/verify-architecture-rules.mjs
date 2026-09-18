#!/usr/bin/env node
/**
 * Proves the architecture rules actually fire.
 *
 * Lint config is the kind of thing that silently stops working - a glob stops
 * matching, an override is shadowed by a later one, a rule gets renamed - and
 * nothing tells you, because a linter that checks nothing reports success. The
 * old ESLint config carried a `naming-convention` block that was declared twice
 * and had been dead for who knows how long.
 *
 * So: for each rule that encodes an architectural decision, write a file that
 * violates it at the real path the override targets, run Biome on it, and
 * assert the expected rule fires. Then delete it. Run in CI.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const biome = join(repoRoot, 'node_modules', '.bin', 'biome');

/** @type {{name: string, file: string, source: string, expect: string}[]} */
const CASES = [
  // ---- Backend: Vertical Slice Architecture ----
  {
    name: 'backend may not import the QuickSight SDK directly',
    file: 'backend/lambda/features/__archcheck__/sdk.ts',
    source: `import { QuickSightClient } from '@aws-sdk/client-quicksight';\nexport const c = QuickSightClient;\n`,
    expect: 'noRestrictedImports',
  },
  {
    name: 'backend may not import QuickSightAdapter directly',
    file: 'backend/lambda/features/__archcheck__/adapter.ts',
    source: `import { QuickSightAdapter } from '../../adapters/aws/QuickSightAdapter';\nexport const a = QuickSightAdapter;\n`,
    expect: 'noRestrictedImports',
  },
  {
    name: 'the adapter layer MAY import the SDK (negative case)',
    file: 'backend/lambda/adapters/aws/__archcheck__.ts',
    source: `import { QuickSightClient } from '@aws-sdk/client-quicksight';\nexport const c = QuickSightClient;\n`,
    expect: null,
  },
  {
    name: 'unref() is banned in Lambda code',
    file: 'backend/lambda/features/__archcheck__/unref.ts',
    source: `export function go(timer: { unref(): void }): void {\n  timer.unref();\n}\n`,
    // GritQL plugin diagnostics are labelled `plugin`, not by rule name, so
    // match the message the plugin registers.
    expect: 'unref() causes Lambda to terminate early',
  },

  // ---- Frontend: Feature-Sliced Design ----
  {
    name: 'entities may not import from features (upward)',
    file: 'frontend/src/entities/__archcheck__/up.ts',
    source: `import { thing } from '@/features/organization';\nexport const x = thing;\n`,
    expect: 'noRestrictedImports',
  },
  {
    name: 'features may not cross-import another feature slice',
    file: 'frontend/src/features/__archcheck__/cross.ts',
    source: `import { thing } from '@/features/organization';\nexport const x = thing;\n`,
    expect: 'noRestrictedImports',
  },
  {
    name: 'widgets may not reach into a feature internal module',
    file: 'frontend/src/widgets/__archcheck__/internal.ts',
    source: `import { thing } from '@/features/organization/lib/useGroupMembershipJob';\nexport const x = thing;\n`,
    expect: 'noRestrictedImports',
  },
  {
    name: 'shared may not import from any layer above it',
    file: 'frontend/src/shared/__archcheck__/up.ts',
    source: `import { thing } from '@/entities/user';\nexport const x = thing;\n`,
    expect: 'noRestrictedImports',
  },
  {
    name: 'pages may not cross-import another page',
    file: 'frontend/src/pages/__archcheck__/cross.ts',
    source: `import { thing } from '@/pages/AssetsPage';\nexport const x = thing;\n`,
    expect: 'noRestrictedImports',
  },
];

let failures = 0;

for (const testCase of CASES) {
  const absolute = join(repoRoot, testCase.file);
  const parent = dirname(absolute);
  // Only ever remove a directory this script created. Fixtures deliberately sit
  // in real source directories (the adapter case must live in adapters/aws for
  // its override to apply), so removing the parent unconditionally would delete
  // shipped code.
  const parentExisted = existsSync(parent);
  mkdirSync(parent, { recursive: true });
  writeFileSync(absolute, testCase.source);

  let output = '';
  try {
    output = execFileSync(biome, ['lint', testCase.file], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  } finally {
    rmSync(absolute, { force: true });
    if (!parentExisted) {
      rmSync(parent, { recursive: true, force: true });
    }
  }

  const fired =
    testCase.expect === null ? !/lint\//.test(output) : output.includes(testCase.expect);

  if (fired) {
    console.log(`  ok    ${testCase.name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${testCase.name}`);
    console.error(
      testCase.expect === null
        ? '        expected no diagnostic, got one'
        : `        expected rule "${testCase.expect}" to fire, it did not`
    );
    console.error(
      output
        .split('\n')
        .filter((l) => l.trim())
        .slice(0, 6)
        .map((l) => `        ${l}`)
        .join('\n')
    );
  }
}

console.log(
  failures === 0
    ? `\nAll ${CASES.length} architecture rules verified.`
    : `\n${failures} of ${CASES.length} architecture rules are NOT being enforced.`
);
process.exit(failures === 0 ? 0 : 1);
