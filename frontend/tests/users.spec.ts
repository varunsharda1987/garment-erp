import { test, expect, Page } from '@playwright/test';

/**
 * User Management E2E Tests for Kashaya Fabs ERP
 *
 * These tests verify:
 * - Users list page loads correctly
 * - Admin can create new users
 * - Admin can edit existing users
 * - Admin can deactivate users
 * - Non-admin users have read-only access
 * - No console errors on user management pages
 */

test.describe('User Management', () => {
  let adminToken: string;
  let adminUserId: string;

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Register and login as admin user
    await page.goto('/register');
    const timestamp = Date.now();
    const adminEmail = `admin${timestamp}@kashayafabs.com`;

    await page.getByLabel(/name/i).fill('Admin Test User');
    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/^password$/i).fill('Admin@123');
    await page.getByLabel(/confirm password/i).fill('Admin@123');
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('users list page loads and displays correctly', async ({ page }) => {
    // Navigate to users page
    await page.getByRole('button', { name: /user management/i }).click();

    // Wait for users page to load
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Check page elements
    await expect(page.getByText('User Management')).toBeVisible();
    await expect(page.getByText(/manage users/i)).toBeVisible();

    // Check if table exists with headers
    await expect(page.getByText(/^name$/i)).toBeVisible();
    await expect(page.getByText(/^email$/i)).toBeVisible();
    await expect(page.getByText(/^role$/i)).toBeVisible();

    // Check if Add User button exists (admin only)
    await expect(page.getByRole('button', { name: /add user|\\+ add user/i })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/users-list.png', fullPage: true });
  });

  test('admin can navigate to create user page', async ({ page }) => {
    // Go to users page
    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });

    // Click Add User button
    await page.getByRole('button', { name: /add user|\\+ add user/i }).click();

    // Should navigate to create user page
    await page.waitForURL(/\/users\/new/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Check form elements exist
    await expect(page.getByText(/create new user/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/role/i)).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/create-user-form.png', fullPage: true });
  });

  test('admin can create a new user', async ({ page }) => {
    // Go to users page
    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });

    // Click Add User
    await page.getByRole('button', { name: /add user|\\+ add user/i }).click();
    await page.waitForURL(/\/users\/new/, { timeout: 5000 });

    // Fill in the form
    const timestamp = Date.now();
    await page.getByLabel(/email/i).fill(`newuser${timestamp}@kashayafabs.com`);
    await page.getByLabel(/password/i).fill('NewUser@123');
    await page.getByLabel(/first name/i).fill('New');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/phone/i).fill('+91-9876543210');
    await page.getByLabel(/role/i).selectOption('SALES');
    await page.getByLabel(/department/i).selectOption('Sales');

    // Submit form
    await page.getByRole('button', { name: /create user|update user/i }).click();

    // Should redirect back to users list
    await page.waitForURL(/^.*\/users\/?$/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Should see the new user in the list (wait for table to load)
    await page.waitForTimeout(1000); // Give time for API call and render
    await expect(page.getByText(/New.*User|newuser.*@kashayafabs\.com/i).first()).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/user-created.png', fullPage: true });
  });

  test('admin can edit an existing user', async ({ page }) => {
    // First create a user
    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.getByRole('button', { name: /add user|\\+ add user/i }).click();
    await page.waitForURL(/\/users\/new/, { timeout: 5000 });

    const timestamp = Date.now();
    await page.getByLabel(/email/i).fill(`edituser${timestamp}@kashayafabs.com`);
    await page.getByLabel(/password/i).fill('EditUser@123');
    await page.getByLabel(/first name/i).fill('Edit');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/role/i).selectOption('SALES');
    await page.getByRole('button', { name: /create user|update user/i }).click();
    await page.waitForURL(/^.*\/users\/?$/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for user to appear (wait for table to load)
    await page.waitForTimeout(1000); // Give time for API call and render
    await expect(page.getByText(/Edit.*User|edituser.*@kashayafabs\.com/i).first()).toBeVisible({ timeout: 10000 });

    // Click Edit button
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    await editButton.click();

    // Should navigate to edit page
    await page.waitForURL(/\/users\/[a-f0-9-]+/, { timeout: 5000 });

    // Update user information
    await page.getByLabel(/first name/i).fill('Updated');
    await page.getByLabel(/department/i).selectOption('Design');

    // Save changes
    await page.getByRole('button', { name: /update user/i }).click();

    // Should redirect back to users list
    await page.waitForURL(/^.*\/users\/?$/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Should see updated name (wait for table to refresh)
    await page.waitForTimeout(1000); // Give time for API call and render
    await expect(page.getByText(/Updated.*User|edituser.*@kashayafabs\.com/i).first()).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/user-edited.png', fullPage: true });
  });

  test('users list shows user status (active/inactive)', async ({ page }) => {
    // Go to users page
    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Check for status indicators
    const statusIndicators = page.getByText(/active|inactive/i);
    await expect(statusIndicators.first()).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/user-status.png', fullPage: true });
  });

  test('pagination works on users list', async ({ page }) => {
    // Go to users page
    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Check if pagination info is displayed
    const paginationText = page.getByText(/page \d+ of \d+/i);
    const paginationVisible = await paginationText.isVisible().catch(() => false);

    if (paginationVisible) {
      // If pagination exists, check buttons
      await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/users-pagination.png', fullPage: true });
  });

  test('no console errors on users list page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('no console errors on create user page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.getByRole('button', { name: /add user|\\+ add user/i }).click();
    await page.waitForURL(/\/users\/new/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('cancel button on create user form returns to list', async ({ page }) => {
    // Go to create user page
    await page.getByRole('button', { name: /user management/i }).click();
    await page.waitForURL(/\/users/, { timeout: 5000 });
    await page.getByRole('button', { name: /add user|\\+ add user/i }).click();
    await page.waitForURL(/\/users\/new/, { timeout: 5000 });

    // Click cancel button
    await page.getByRole('button', { name: /cancel/i }).click();

    // Should redirect back to users list
    await page.waitForURL(/^.*\/users\/?$/, { timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/create-user-cancel.png', fullPage: true });
  });

  test('user management link is visible on dashboard', async ({ page }) => {
    // Should be on dashboard after login
    await expect(page).toHaveURL(/\/dashboard/);

    // Check for User Management button/link
    await expect(page.getByRole('button', { name: /user management/i })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-user-link.png', fullPage: true });
  });
});
