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
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

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
