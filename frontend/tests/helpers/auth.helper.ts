import { Page } from '@playwright/test';

/**
 * Authentication Helper for E2E Tests
 * Provides reusable authentication methods
 */

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

/**
 * Register a new user
 */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/name/i).fill(`${user.firstName} ${user.lastName}`);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/^password$/i).fill(user.password);
  await page.getByLabel(/confirm password/i).fill(user.password);

  await page.getByRole('button', { name: /create account|register|sign up/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Login with existing credentials
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Logout current user
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.getByRole('button', { name: /logout|sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 5000 });
}

/**
 * Clear all auth state
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Generate a unique test user
 */
export function generateTestUser(prefix: string = 'test'): TestUser {
  const timestamp = Date.now();
  return {
    email: `${prefix}${timestamp}@kashayafabs.com`,
    password: 'Test@123',
    firstName: 'Test',
    lastName: `User${timestamp}`,
  };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('auth-token'));
  return !!token;
}

/**
 * Get current user info from storage
 */
export async function getCurrentUser(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const userStr = localStorage.getItem('auth-user');
    return userStr ? JSON.parse(userStr) : null;
  });
}
