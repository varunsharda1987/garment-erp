/**
 * Run Jest through the npm scripts (`npm test`, `npm run test:unit`, `npm run test:integration`), not
 * bare `npx jest`: the scripts start Node with `--experimental-vm-modules`.
 *
 * Why: puppeteer-core 25 (66250935) ships ESM only. The app imports it (the PDF renderer) and so does
 * whatsapp-web.js, so every test that loads `app` failed with "Must use import to load ES Module".
 * Jest 30 can `require()` an ES module natively — but only on Node >= 24.9 AND only when Node runs with
 * `--experimental-vm-modules`; without the flag it throws that error instead. No stub, no transform.
 *
 * Also: Jest 30 renamed `--testPathPattern` to `--testPathPatterns` (the old name is a hard error).
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/server.ts',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
