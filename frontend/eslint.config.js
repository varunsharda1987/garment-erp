import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // v7 moved the flat-config preset under .flat; the top-level key of the same name is now
      // the legacy eslintrc config, which ESLint 10 rejects (`plugins` as an array).
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React Compiler rules (react-hooks v7) that flag a working pattern used across ~125 pages
      // rather than a defect: a load function declared below the effect that calls it
      // (immutability, 192) and setState inside a load effect (set-state-in-effect, 183). Kept
      // visible as warnings — clean them up file by file when a page is touched (declare the
      // loader above the effect / useCallback; prefer React Query for loads). The other compiler
      // rules (refs, purity, static-components, …) stay errors.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Playwright E2E (frontend/tests): Node, not React. Fixtures call Playwright's `use()`, which
    // react-hooks mistakes for React's `use` hook, and a fixture that needs no other fixture must
    // be written `async ({}, use) =>` (Playwright requires the object pattern).
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
      // Test helpers wrap loosely typed API payloads; keep `any` visible but non-blocking there.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
