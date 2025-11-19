import { test as base, Page } from '@playwright/test';
import {
  registerUser,
  loginUser,
  logoutUser,
  clearAuth,
  generateTestUser,
  type TestUser,
} from '../helpers/auth.helper';

/**
 * Custom Fixtures for Playwright Tests
 * Extends base test with custom fixtures for authentication and setup
 */

type CustomFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
  testUser: TestUser;
  cleanupAuth: void;
};

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<CustomFixtures>({
  /**
   * Fixture: authenticatedPage
   * Provides a page with an authenticated user
   */
  authenticatedPage: async ({ page }, use) => {
    const user = generateTestUser('fixture');
    await clearAuth(page);
    await registerUser(page, user);
    await use(page);
    await clearAuth(page);
  },

  /**
   * Fixture: adminPage
   * Provides a page with an authenticated admin user
   */
  adminPage: async ({ page }, use) => {
    const adminUser: TestUser = {
      ...generateTestUser('admin'),
      role: 'ADMIN',
    };
    await clearAuth(page);
    await registerUser(page, adminUser);
    await use(page);
    await clearAuth(page);
  },

  /**
   * Fixture: testUser
   * Provides a unique test user for each test
   */
  testUser: async ({}, use) => {
    const user = generateTestUser();
    await use(user);
  },

  /**
   * Fixture: cleanupAuth
   * Automatically clears auth before and after each test
   */
  cleanupAuth: [
    async ({ page }, use) => {
      await clearAuth(page);
      await use();
      await clearAuth(page);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
