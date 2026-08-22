// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';
import boundaries from 'eslint-plugin-boundaries';

export default [{
  ignores: [
    'dist/**',
    'node_modules/**',
    'storybook-static/**',
    '*.js',
    '*.d.ts',
    '*.cjs',
    'vite.config.ts',
  ],
}, {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      project: './tsconfig.json',
    },
    globals: {
      console: 'readonly',
      process: 'readonly',
      Buffer: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
      exports: 'writable',
      global: 'readonly',
      module: 'writable',
      require: 'readonly',
      URL: 'readonly',
      URLSearchParams: 'readonly',
    },
  },
  plugins: {
    '@typescript-eslint': typescript,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    'import': importPlugin,
    'boundaries': boundaries,
  },
  rules: {
    ...typescript.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'import/no-duplicates': ['error', { 'prefer-inline': true }],
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'type'
        ],
        pathGroups: [
          // Enforce FSD layer order from highest to lowest
          { pattern: '@/app/**', group: 'internal', position: 'after' },
          { pattern: '@/pages/**', group: 'internal', position: 'after' },
          { pattern: '@/widgets/**', group: 'internal', position: 'after' },
          { pattern: '@/features/**', group: 'internal', position: 'after' },
          { pattern: '@/entities/**', group: 'internal', position: 'after' },
          { pattern: '@/shared/**', group: 'internal', position: 'after' }
        ],
        pathGroupsExcludedImportTypes: ['builtin', 'type'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    // FSD Layer Boundaries - strict hierarchy enforcement
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          {
            from: 'app',
            allow: ['pages', 'widgets', 'features', 'entities', 'shared']
          },
          // 'app' is the top layer: nothing below it may import from it
          {
            from: 'pages',
            allow: ['widgets', 'features', 'entities', 'shared']
          },
          {
            from: 'widgets',
            allow: ['features', 'entities', 'shared']
          },
          {
            from: 'features',
            allow: ['entities', 'shared']
          },
          {
            from: 'entities',
            allow: ['shared']
          },
          {
            from: 'shared',
            allow: []
          }
        ]
      }
    ],
    // Prevent cross-imports between slices on the same layer
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // Pages should not import from other pages
          {
            group: ['*/pages/*/*'],
            message: 'Cross-imports between pages are not allowed. Extract shared logic to widgets or features.'
          },
          // Features should not import internals from other features
          {
            group: ['@/features/*/lib/*', '@/features/*/model/*', '@/features/*/api/*', '@/features/*/ui/*', '@/features/*/utils/*'],
            message: 'Features should only import public APIs from other features, not internal modules.'
          },
          // Entities should not import internals from other entities
          {
            group: ['@/entities/*/model/*', '@/entities/*/lib/*', '@/entities/*/ui/*'],
            message: 'Entities should only import public APIs from other entities.'
          }
        ]
      }
    ],
    'complexity': ['warn', { max: 25 }],
    'max-depth': ['error', 10],
    'max-nested-callbacks': ['error', 4],
    'max-params': ['error', 7],
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    },
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**' },
      { type: 'pages', pattern: 'src/pages/**' },
      { type: 'widgets', pattern: 'src/widgets/**' },
      { type: 'features', pattern: 'src/features/**' },
      { type: 'entities', pattern: 'src/entities/**' },
      { type: 'shared', pattern: 'src/shared/**' }
    ]
  }
},
// Same-layer cross-slice bans. boundaries/element-types can't see slices
// (elements are defined per layer), so alias imports of a sibling slice are
// banned per layer here. Same-slice imports use relative paths, so an alias
// import of your own layer is by definition a cross-slice import.
{
  files: ['src/widgets/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/widgets', '@/widgets/*'], message: 'Cross-imports between widget slices are not allowed. Merge the slices, move shared code down a layer, or compose at the page level.' },
        { group: ['@/features/*/lib/*', '@/features/*/model/*', '@/features/*/api/*', '@/features/*/ui/*', '@/features/*/utils/*'], message: 'Import the feature public API, not internal modules.' },
        { group: ['@/entities/*/model/*', '@/entities/*/lib/*', '@/entities/*/ui/*'], message: 'Import the entity public API, not internal modules.' }
      ]
    }]
  }
},
{
  files: ['src/features/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/features', '@/features/*'], message: 'Cross-imports between feature slices are not allowed. Move shared code to entities/shared, or compose at the widget/page level (e.g. via a slot prop).' },
        { group: ['@/entities/*/model/*', '@/entities/*/lib/*', '@/entities/*/ui/*'], message: 'Import the entity public API, not internal modules.' }
      ]
    }]
  }
},
{
  files: ['src/entities/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/entities', '@/entities/*'], message: 'Cross-imports between entity slices are not allowed. Use relative paths within a slice; move shared code to shared.' }
      ]
    }]
  }
},
{
  files: ['src/pages/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/pages', '@/pages/*'], message: 'Cross-imports between pages are not allowed. Extract shared logic to widgets or features.' },
        { group: ['@/features/*/lib/*', '@/features/*/model/*', '@/features/*/api/*', '@/features/*/ui/*', '@/features/*/utils/*'], message: 'Import the feature public API, not internal modules.' },
        { group: ['@/entities/*/model/*', '@/entities/*/lib/*', '@/entities/*/ui/*'], message: 'Import the entity public API, not internal modules.' }
      ]
    }]
  }
},
...storybook.configs["flat/recommended"]];