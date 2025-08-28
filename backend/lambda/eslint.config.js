const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const prettier = require('eslint-plugin-prettier');
const importPlugin = require('eslint-plugin-import');
const perfectionist = require('eslint-plugin-perfectionist');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'build.js', '*.js', '*.d.ts', 'coverage/**', 'scripts/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
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
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        test: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'prettier': prettier,
      'import': importPlugin,
      'perfectionist': perfectionist,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-magic-numbers': ['error', {
        ignore: [0, 1, -1, 2],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
      }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
      ],
      
      'prettier/prettier': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        disallowTypeAnnotations: true,
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'property',
          format: null,
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
      'no-console': ['error', {
        allow: ['warn', 'error'],
      }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'no-throw-literal': 'error',
      'require-await': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-duplicate-imports': 'error',
      // Code quality metrics
      'complexity': ['error', { max: 25 }],
      'max-depth': ['error', 10],
      'max-nested-callbacks': ['error', 4],
      'max-params': ['error', 6],
      'max-lines': ['warn', { max: 2000, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', { max: 30 }],
      
      // Enforce SRP and clean code
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      }],
      '@typescript-eslint/no-useless-constructor': 'off', // Needed for proper TypeScript type inference in subclasses
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', {
        accessibility: 'explicit',
        overrides: {
          constructors: 'no-public',
          methods: 'explicit',
          properties: 'explicit',
          parameterProperties: 'explicit',
        },
      }],
      '@typescript-eslint/member-ordering': 'off', // Using perfectionist/sort-classes instead for auto-fix
      'perfectionist/sort-classes': ['error', {
        type: 'natural',
        order: 'asc',
        groups: [
          // Static members first
          'static-property',
          'static-method',
          // Instance fields
          'property',
          'private-property',
          // Constructor
          'constructor',
          // Instance methods
          'method',
          'private-method',
        ],
      }],
      
      // Lambda-specific rules to prevent early termination
      'no-restricted-properties': ['error', {
        object: 'global',
        property: 'unref',
        message: 'unref() causes Lambda to terminate early. Remove unref() for Lambda compatibility.'
      }, {
        property: 'unref',
        message: 'unref() causes Lambda to terminate early. Remove unref() for Lambda compatibility.'
      }],
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.property.name="unref"]',
        message: 'unref() causes Lambda to terminate early. Remove unref() for Lambda compatibility.'
      }, {
        selector: 'MemberExpression[property.name="unref"]',
        message: 'unref() causes Lambda to terminate early. Remove unref() for Lambda compatibility.'
      }],
      
      // AWS SDK QuickSight import restrictions - Enforce layered architecture
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@aws-sdk/client-quicksight'],
            message: 'Do not import from @aws-sdk/client-quicksight directly. Use shared/types/aws-sdk-types.ts for types, or QuickSightAdapter for SDK operations.',
          },
          {
            group: ['**/adapters/aws/QuickSightAdapter'],
            message: 'Do not import QuickSightAdapter directly. Use QuickSightService for all QuickSight operations.',
          },
        ],
      }],
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.eslint.json',
        },
      },
    },
  },
  {
    // Exclude constants and config files from magic numbers rule
    files: ['**/constants/**/*.ts', '**/config/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  {
    // Special rules for test files
    files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'require-await': 'off',
      'no-undef': 'off', // Vitest globals are handled by TypeScript
      'no-restricted-imports': 'off', // Tests can import anything for mocking
    },
  },
  {
    // Allow adapters, type barrels, and client factory to import from AWS SDK
    files: [
      '**/adapters/aws/*.ts',
      '**/shared/types/aws-sdk-types.ts', 
      '**/shared/config/awsClients.ts'
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Allow QuickSightService to import QuickSightAdapter
    files: ['**/shared/services/aws/QuickSightService.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@aws-sdk/client-quicksight'],
            message: 'Do not import from @aws-sdk/client-quicksight directly. Use shared/types/aws-sdk-types.ts for types.',
          },
          // QuickSightService CAN import QuickSightAdapter, so we only restrict direct SDK imports
        ],
      }],
    },
  },
];