const { getJestConfig } = require('@storybook/test-runner');

/**
 * @type {import('jest').Config}
 */
module.exports = {
  // The default configuration comes from @storybook/test-runner
  ...getJestConfig(),
  /** Add your own overrides below
   * @see https://jestjs.io/docs/configuration
   */
  testTimeout: 20000,
  maxWorkers: 2,
};