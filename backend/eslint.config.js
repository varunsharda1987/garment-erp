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
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Auth middleware import restrictions
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/middleware/auth.middleware'],
              importNamePattern: '^(?!authenticateToken$|authorize$).*$',
              message:
                "Only 'authenticateToken' and 'authorize' can be imported from auth.middleware. Do not use aliases.",
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
        {
          selector:
            "ImportDeclaration[source.value=/auth\\.middleware/] ImportSpecifier[imported.name='authorize'][local.name!='authorize']",
          message: "Do not rename 'authorize' on import. Use the standard name directly.",
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'prisma/**', '**/*.test.ts', '**/__tests__/**'],
  },
];
