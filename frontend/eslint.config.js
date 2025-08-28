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
  ignores: ['dist/**', 'node_modules/**', '*.js', '*.d.ts', '*.cjs', 'vite.config.ts'],
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
            allow: ['processes', 'pages', 'widgets', 'features', 'entities', 'shared']
          },
          {
            from: 'processes',
            allow: ['pages', 'widgets', 'features', 'entities', 'shared']
          },
          {
            from: 'pages',
            allow: ['widgets', 'features', 'entities', 'shared', 'app']
          },
          {
            from: 'widgets',
            allow: ['features', 'entities', 'shared', 'app']
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
            group: ['@/features/*/lib/*', '@/features/*/model/*', '@/features/*/api/*'],
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
      { type: 'processes', pattern: 'src/processes/**' },
      { type: 'pages', pattern: 'src/pages/**' },
      { type: 'widgets', pattern: 'src/widgets/**' },
      { type: 'features', pattern: 'src/features/**' },
      { type: 'entities', pattern: 'src/entities/**' },
      { type: 'shared', pattern: 'src/shared/**' }
    ]
  }
}, ...storybook.configs["flat/recommended"]];