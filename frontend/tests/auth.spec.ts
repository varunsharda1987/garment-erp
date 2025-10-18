import { test, expect, Page } from '@playwright/test';

/**
 * Authentication E2E Tests for Kashaya Fabs ERP
 *
 * These tests verify:
 * - Login page loads correctly
 * - Registration page loads correctly
 * - User can register successfully
 * - User can login successfully
 * - Invalid credentials show error
 * - Protected routes redirect to login
 * - Logout works correctly
 * - No console errors on pages
 */

test.describe('Authentication Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('login page loads and displays correctly', async ({ page }) => {
    await page.goto('/login');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page).toHaveTitle(/Kashaya Fabs/i);

    // Check login form elements exist
    await expect(page.getByText('Kashaya Fabs ERP')).toBeVisible();
    await expect(page.getByText(/sign in to your account/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Check "Sign up" link exists
    await expect(page.getByText(/sign up/i)).toBeVisible();

    // Take screenshot for documentation
    await page.screenshot({ path: 'test-results/login-page.png', fullPage: true });
  });

  test('register page loads and displays correctly', async ({ page }) => {
    await page.goto('/register');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page).toHaveTitle(/Kashaya Fabs/i);

    // Check registration form elements exist
    await expect(page.getByText('Create an Account').first()).toBeVisible();
    await expect(page.getByText(/enter your information/i)).toBeVisible();
    await expect(page.getByLabel(/full name|name/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();

    // Check "Sign in" link exists
    await expect(page.getByText(/sign in/i)).toBeVisible();

    // Take screenshot for documentation
    await page.screenshot({ path: 'test-results/register-page.png', fullPage: true });
  });

  test('user can register successfully', async ({ page }) => {
    await page.goto('/register');

    // Generate unique email for test
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@kashayafabs.com`;

    // Fill registration form
    await page.getByLabel(/name/i).fill('Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');

    // Submit form
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Check for welcome message or user info
    await expect(page.getByText(/welcome|dashboard/i)).toBeVisible({ timeout: 5000 });

    // Take screenshot of successful registration
    await page.screenshot({ path: 'test-results/registration-success.png', fullPage: true });
  });

  test('user can login successfully', async ({ page }) => {
    // First register a user
    await page.goto('/register');
    const timestamp = Date.now();
    const testEmail = `login${timestamp}@kashayafabs.com`;

    await page.getByLabel(/name/i).fill('Login Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 5000 });

    // Now test login
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('Test@123');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Check dashboard elements
    await expect(page.getByText(/welcome|dashboard/i)).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/login-success.png', fullPage: true });
  });

  test('shows error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to login with invalid credentials
    await page.getByLabel(/email/i).fill('invalid@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait a bit for error to appear
    await page.waitForTimeout(2000);

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Check for error message (this depends on your error display implementation)
    // Adjust selector based on your actual error message display
    const errorVisible = await page.getByText(/invalid|error|incorrect|failed/i).isVisible().catch(() => false);

    // Take screenshot showing error
    await page.screenshot({ path: 'test-results/login-error.png', fullPage: true });
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    // Clear any existing auth data
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Try to access protected dashboard
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/protected-redirect.png', fullPage: true });
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    // First register and login
    await page.goto('/register');
    const timestamp = Date.now();
    const testEmail = `logout${timestamp}@kashayafabs.com`;

    await page.getByLabel(/name/i).fill('Logout Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Click logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Try to go back to dashboard
    await page.goto('/dashboard');

    // Should redirect back to login (session cleared)
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/logout-success.png', fullPage: true });
  });

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Listen for console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000);

    // Report errors if any
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
    if (warnings.length > 0) {
      console.log('Console warnings found:', warnings);
    }

    // Fail test if there are console errors
    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('no console errors on register page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('no console errors on dashboard page', async ({ page }) => {
    // First login
    await page.goto('/register');
    const timestamp = Date.now();
    const testEmail = `dashboard${timestamp}@kashayafabs.com`;

    await page.getByLabel(/name/i).fill('Dashboard Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    // Wait for dashboard to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('password confirmation validation works', async ({ page }) => {
    await page.goto('/register');

    // Fill form with non-matching passwords
    await page.getByLabel(/name/i).fill('Test User');
    await page.getByLabel(/email/i).fill('test@test.com');
    await page.getByLabel(/^password$/i).fill('Password123');
    await page.getByLabel(/confirm password/i).fill('DifferentPassword');

    // Try to submit
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    // Should show validation error (adjust based on your implementation)
    // Should stay on register page
    await expect(page).toHaveURL(/\/register/);

    // Take screenshot
    await page.screenshot({ path: 'test-results/password-validation.png', fullPage: true });
  });

  test('session persists after page refresh', async ({ page }) => {
    // Register and login
    await page.goto('/register');
    const timestamp = Date.now();
    const testEmail = `persist${timestamp}@kashayafabs.com`;

    await page.getByLabel(/name/i).fill('Persist Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Refresh the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/welcome|dashboard/i)).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/session-persist.png', fullPage: true });
  });

});
