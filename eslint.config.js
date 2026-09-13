import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

/**
 * One flat config for the whole monorepo: Node rules for the API, browser +
 * React rules for the web app. Stylistic choices are left alone — this is here
 * to catch real mistakes (unused bindings, broken hook deps, bad imports), not
 * to reformat the codebase.
 */
export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'backend/tmp/**', 'frontend/assets/**'],
  },

  js.configs.recommended,

  // --- Backend (Node, ESM) ---------------------------------------------------
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { import: importPlugin },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import/no-unresolved': 'off', // resolved by Node's ESM loader, not eslint
      'import/extensions': ['error', 'ignorePackages'],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // The logger and the seed script are the two places that print on purpose.
    files: ['backend/src/lib/logger.js', 'backend/prisma/seed.js'],
    rules: { 'no-console': 'off' },
  },

  // --- Frontend (browser, React) --------------------------------------------
  {
    files: ['frontend/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // the automatic JSX runtime
      'react/prop-types': 'off', // no prop-types in this codebase by choice
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // --- Config files ----------------------------------------------------------
  {
    files: ['*.config.js', '**/*.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
