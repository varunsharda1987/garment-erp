/**
 * Test Utilities
 *
 * Helper functions and utilities for writing tests
 */

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(userId: string, role: string = 'USER'): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
}

/**
 * Generate authorization header for API tests
 */
export function getAuthHeader(userId: string, role: string = 'USER'): Record<string, string> {
  const token = generateTestToken(userId, role);
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides: Partial<{ email: string; password: string; name: string; role: string }> = {}) {
  const defaultUser = {
    email: `test-${Date.now()}@test.com`,
    password: '$2b$10$abcdefghijklmnopqrstuv', // Hashed "password"
    name: 'Test User',
    role: 'USER',
    ...overrides,
  };

  return await prisma.user.create({
    data: defaultUser,
  });
}

/**
 * Clean up test data from the database
 */
export async function cleanupTestData() {
  // Delete test data in reverse order of dependencies
  // Add more cleanup as needed based on your schema

  try {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-',
        },
      },
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();

  while (!(await condition())) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Mock Prisma client for unit tests
 */
export function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Add more models as needed
  };
}

/**
 * Sleep for testing async operations
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
