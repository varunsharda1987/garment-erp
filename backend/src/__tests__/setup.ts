/**
 * Jest Test Setup
 *
 * This file runs before all tests and sets up the test environment
 */

import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env files (needed for integration tests that hit the real DB)
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
// Tests run against the TEST database, never live (2026-09-29): garment_erp_test, a copy of live rebuilt
// nightly and on demand by scripts/refresh-test-db.ps1. Until then every test wrote into the team's
// data (78 blank trims, 2026-09-26). TEST_DATABASE_URL overrides; otherwise the live URL's database name
// is swapped for garment_erp_test. Any database whose name does not end in _test is REFUSED.
process.env.DATABASE_URL = testDatabaseUrl();

function testDatabaseUrl(): string {
  const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('No DATABASE_URL / TEST_DATABASE_URL for the tests');
  const url = new URL(base);
  if (!process.env.TEST_DATABASE_URL) url.pathname = '/garment_erp_test';
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `Refusing to run tests against "${dbName}": tests may only use a database whose name ends in _test. ` +
        'Rebuild the copy with: powershell -ExecutionPolicy Bypass -File scripts\\refresh-test-db.ps1'
    );
  }
  return url.toString();
}

// Mock logger to avoid console output during tests.
// __esModule is required: without it esModuleInterop hands `import logger from '../utils/logger'`
// the whole mock object instead of its `default`, so every `logger.info(...)` in a controller
// throws "logger.info is not a function" and the suite sees a 500 that production never returns.
jest.mock('../utils/logger', () => ({
  __esModule: true,
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
  logHttp: jest.fn(),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  // Add cleanup logic here if needed
});
