/**
 * ESLint rules for enforcing Feature-Sliced Design boundaries
 */
module.exports = {
  rules: {
    // Enforce proper import order and boundaries between FSD layers
    'import/order': [
      'error',
      {
        groups: [
          'builtin', // Node.js built-in modules
          'external', // External packages
          'internal', // Internal aliases (like @/)
          'parent', // Parent imports
          'sibling', // Sibling imports
          'index', // Index imports
          'object', // Object imports
          'type', // Type imports
        ],
        pathGroups: [
          // App layer (highest)
          {
            pattern: '@/app/**',
            group: 'internal',
            position: 'after',
          },
          // Pages layer
          {
            pattern: '@/pages/**',
            group: 'internal',
            position: 'after',
          },
          // Widgets layer
          {
            pattern: '@/widgets/**',
            group: 'internal',
            position: 'after',
          },
          // Features layer
          {
            pattern: '@/features/**',
            group: 'internal',
            position: 'after',
          },
          // Entities layer
          {
            pattern: '@/entities/**',
            group: 'internal',
            position: 'after',
          },
          // Shared layer (lowest)
          {
            pattern: '@/shared/**',
            group: 'internal',
            position: 'after',
          },
        ],
        pathGroupsExcludedImportTypes: ['type'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],

    // Prevent cross-imports between slices at the same layer
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // Pages cannot import from other pages
          {
            group: ['@/pages/*/*'],
            message: 'Pages cannot import from other pages. Extract shared logic to widgets, features, or entities.',
          },
          // Widgets cannot import from pages
          {
            group: ['@/pages/**'],
            message: 'Widgets cannot import from pages. This violates FSD hierarchy.',
          },
          // Features cannot import from pages or widgets
          {
            group: ['@/pages/**', '@/widgets/**'],
            message: 'Features cannot import from pages or widgets. This violates FSD hierarchy.',
          },
          // Entities cannot import from higher layers
          {
            group: ['@/pages/**', '@/widgets/**', '@/features/**'],
            message: 'Entities cannot import from higher layers (pages, widgets, features).',
          },
          // Shared cannot import from any other layer
          {
            group: ['@/app/**', '@/pages/**', '@/widgets/**', '@/features/**', '@/entities/**'],
            message: 'Shared layer cannot import from any other layer. It should be completely independent.',
          },
          // Features cannot cross-import from other features
          {
            group: ['@/features/*/lib', '@/features/*/api', '@/features/*/model'],
            message: 'Features should not import internal modules from other features. Use public API exports.',
          },
        ],
      },
    ],
  },
  overrides: [
    // Allow pages to import from any layer (except other pages)
    {
      files: ['src/pages/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/pages/*/*'],
                message: 'Pages cannot import from other pages. Extract shared logic to widgets, features, or entities.',
              },
            ],
          },
        ],
      },
    },
    // Allow widgets to import from features, entities, and shared
    {
      files: ['src/widgets/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/pages/**', '@/app/**'],
                message: 'Widgets cannot import from pages or app layer.',
              },
              {
                group: ['@/widgets/*/*'],
                message: 'Widgets should not import internals from other widgets.',
              },
            ],
          },
        ],
      },
    },
    // Allow features to import from entities and shared
    {
      files: ['src/features/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/pages/**', '@/widgets/**', '@/app/**'],
                message: 'Features cannot import from pages, widgets, or app layer.',
              },
              {
                group: ['@/features/*/lib/**', '@/features/*/api/**', '@/features/*/model/**'],
                message: 'Features should not import internals from other features. Use public API exports.',
              },
            ],
          },
        ],
      },
    },
    // Allow entities to import only from shared
    {
      files: ['src/entities/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/pages/**', '@/widgets/**', '@/features/**', '@/app/**'],
                message: 'Entities can only import from shared layer.',
              },
              {
                group: ['@/entities/*/*'],
                message: 'Entities should not import internals from other entities.',
              },
            ],
          },
        ],
      },
    },
    // Shared layer should not import from any other layer
    {
      files: ['src/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/app/**', '@/pages/**', '@/widgets/**', '@/features/**', '@/entities/**'],
                message: 'Shared layer must be independent and cannot import from other layers.',
              },
            ],
          },
        ],
      },
    },
  ],
};