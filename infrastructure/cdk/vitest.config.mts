import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // cdk.out holds synthesized Lambda bundles, which include copies of the
    // backend's own test files. Without this, `vitest` in the CDK package
    // collects and fails on hundreds of tests that belong to another package.
    exclude: ['cdk.out/**', 'node_modules/**', 'lib/**'],
  },
});
