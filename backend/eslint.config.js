const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const eslintJs = require('@eslint/js');

module.exports = [
  eslintJs.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Allow unused vars with underscore prefix
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],

      // Auth middleware import restrictions — the four guards route-write-guard.test.ts accepts,
      // plus the identity check. requireAnyPermission is a deliberate guard (an action two
      // Permissions-page areas share, e.g. adding a weaver from a PO line or a GRN line).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/middleware/auth.middleware'],
              importNamePattern:
                '^(?!authenticateToken$|requirePermission$|requirePermissionForWrites$|requireAnyPermission$|requireAdmin$).*$',
              message:
                "Only 'authenticateToken', 'requirePermission', 'requirePermissionForWrites', 'requireAnyPermission' and 'requireAdmin' can be imported from auth.middleware. Do not use aliases.",
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value=/auth\\.middleware/] ImportSpecifier[imported.name='authenticateToken'][local.name!='authenticateToken']",
          message: "Do not rename 'authenticateToken' on import. Use the standard name directly.",
        },
      ],
    },
  },
  {
    // typescript-eslint's own overrides for TS files: turns off the core rules tsc already
    // checks (and blocks CI on), which misfire on TS — no-undef cannot see type-only namespaces
    // (Express.Multer.File, PDFKit.PDFDocument, NodeJS.Timeout, RequestInit: 57 false reports),
    // no-redeclare flags the `const X = {…} as const` + `type X` enum-mirror pattern — and turns
    // on no-var / prefer-const. The plain .js scripts under src/scripts keep the core rules.
    ...tsPlugin.configs['flat/eslint-recommended'],
    files: ['src/**/*.ts'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'prisma/**', '**/*.test.ts', '**/__tests__/**'],
  },
];
