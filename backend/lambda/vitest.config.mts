import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/testUtils/**',
        '**/shared/utils/testUtils/**',

        // Type-only files (no runtime code)
        '**/*.types.ts',
        '**/*.interface.ts',
        '**/types/**/*.ts',

        // Model files that are primarily types (but keep those with runtime logic)
        '**/models/ingestion.model.ts',
        '**/models/quicksight-domain.model.ts',
        '**/models/export.model.ts',
        '**/models/batch.model.ts',

        // Config files (usually just exports of constants)
        '**/config/*.ts',
        '**/*.config.ts',

        // Constants files (debatable, but usually don't need testing)
        '**/constants.ts',
        '**/constants/*.ts',

        // Entry point files that just wire things up
        '**/index.ts',
        'index.ts',
        'worker.ts',

        // Test setup and fixtures
        'vitest.setup.ts',
        'vitest.config.ts',
        '**/*.test.ts',
        '**/*.spec.ts',

        // Generated files
        '**/generated/**',

        // Migration files
        '**/migrations/**',
      ],
    },
    globals: true,
    clearMocks: true,
    maxConcurrency: 2, // Limit concurrent tests to reduce memory usage
    pool: 'forks', // Use forked processes for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork to reduce memory usage
      },
    },
  },
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
});
