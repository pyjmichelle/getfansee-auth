import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      'e2e/**/*',
      'tests/**/*',
      'scripts/**/*',
      '.next/**/*',
      'node_modules/**/*',
      'out/**/*',
      'dist/**/*',
      'build/**/*',
      'test-*.js',
      'playwright.config.ts',
      'vitest.config.ts',
      'commitlint.config.js',
      'playwright-report/**/*',
      'test-results/**/*',
      '.ci-artifacts/**/*',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'prettier/prettier': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'off', // TypeScript 会处理未定义变量
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: [
      'e2e/*.{ts,tsx,js}',
      'e2e/**/*.{ts,tsx,js}',
      'scripts/*.{ts,tsx,js}',
      'scripts/**/*.{ts,tsx,js}',
      'tests/*.{ts,tsx,js}',
      'tests/**/*.{ts,tsx,js}',
      'test-*.js',
      'playwright.config.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];
