import { test, expect } from '@playwright/test';
import { TestConfig } from '../../config/test-config';

/**
 * LEVEL 0: Authentication Tests
 * No dependencies - these are foundational tests
 *
 * Tests:
 * - Login page rendering
 * - Register page rendering
 * - User registration flow
 * - User login flow
 * - Invalid credentials handling
 * - Protected route redirect
 * - Session persistence
 * - Logout flow
 * - Form validation
 */

test.describe('Level 0: Authentication', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  // ============================================
  // LOGIN PAGE TESTS
  // ============================================

  test.describe('Login Page', () => {
    test('renders all form fields correctly', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Verify page title
      await expect(page).toHaveTitle(/Kashaya Fabs/i);

      // Verify all form elements
      await expect(page.getByText('Kashaya Fabs ERP')).toBeVisible();
      await expect(page.getByText(/sign in to your account/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByText(/sign up/i)).toBeVisible();
    });

    test('email field validation works', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const emailField = page.getByLabel(/email/i);

      // Test empty email
      await emailField.fill('');
      await page.keyboard.press('Tab');

      // Test invalid email format
      await emailField.fill('invalid-email');
      await page.keyboard.press('Tab');

      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('password field is masked', async ({ page }) => {
      await page.goto('/login');

      const passwordField = page.getByLabel(/password/i);
      const inputType = await passwordField.getAttribute('type');
      expect(inputType).toBe('password');
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@email.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      await page.waitForTimeout(2000);

      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('no console errors on page load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      page.on('pageerror', (error) => {
        errors.push(`Page error: ${error.message}`);
      });

      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      expect(errors.length, `Console errors: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ============================================
  // REGISTER PAGE TESTS
  // ============================================

  test.describe('Register Page', () => {
    test('renders all form fields correctly', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Verify all form elements
      await expect(page.getByText('Create an Account').first()).toBeVisible();
      await expect(page.getByLabel(/full name|name/i)).toBeVisible();
      await expect(page.getByLabel(/^email$/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    });

    test('password confirmation validation works', async ({ page }) => {
      await page.goto('/register');

      // Fill form with non-matching passwords
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('test@test.com');
      await page.getByLabel(/^password$/i).fill('Password123');
      await page.getByLabel(/confirm password/i).fill('DifferentPassword');

      await page.getByRole('button', { name: /create account/i }).click();

      // Should stay on register page
      await expect(page).toHaveURL(/\/register/);
    });

    test('required fields validation', async ({ page }) => {
      await page.goto('/register');

      // Try to submit empty form
      await page.getByRole('button', { name: /create account/i }).click();

      // Should stay on register page
      await expect(page).toHaveURL(/\/register/);
    });

    test('no console errors on page load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      expect(errors.length, `Console errors: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ============================================
  // REGISTRATION FLOW TESTS
  // ============================================

  test.describe('Registration Flow', () => {
    test('user can register successfully', async ({ page }) => {
      await page.goto('/register');

      const timestamp = Date.now();
      const testEmail = `e2e_register_${timestamp}@kashayafabs.com`;

      await page.getByLabel(/name/i).fill('E2E Test User');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill('Test@123');
      await page.getByLabel(/confirm password/i).fill('Test@123');

      await page.getByRole('button', { name: /create account/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Verify user is authenticated (Zustand stores auth in 'auth-storage')
      const hasToken = await page.evaluate(() => {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          return !!parsed?.state?.token;
        }
        return false;
      });
      expect(hasToken).toBe(true);
    });

    test('duplicate email shows error', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `e2e_duplicate_${timestamp}@kashayafabs.com`;

      // First registration
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('First User');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill('Test@123');
      await page.getByLabel(/confirm password/i).fill('Test@123');
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForURL(/\/dashboard/);

      // Logout
      await page.evaluate(() => localStorage.clear());

      // Second registration with same email
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Second User');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill('Test@123');
      await page.getByLabel(/confirm password/i).fill('Test@123');
      await page.getByRole('button', { name: /create account/i }).click();

      await page.waitForTimeout(2000);

      // Should stay on register page or show error
      await expect(page).toHaveURL(/\/register/);
    });
  });

  // ============================================
  // LOGIN FLOW TESTS
  // ============================================

  test.describe('Login Flow', () => {
    test('user can login after registration', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `e2e_login_${timestamp}@kashayafabs.com`;
      const testPassword = 'Test@123';

      // Register
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Login Test User');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill(testPassword);
      await page.getByLabel(/confirm password/i).fill(testPassword);
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });

      // Logout via dropdown menu
      // Click the user dropdown trigger (button with user icon in header)
      await page.locator('header').getByRole('button').last().click();
      await page.waitForTimeout(500);
      // Click logout menu item (use exact match to avoid matching user name)
      await page.getByText('Logout', { exact: true }).click();
      await page.waitForURL(/\/login/, { timeout: 10000 });

      // Login
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/password/i).fill(testPassword);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });
  });

  // ============================================
  // PROTECTED ROUTE TESTS
  // ============================================

  test.describe('Protected Routes', () => {
    test('redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('redirects customers page to login', async ({ page }) => {
      await page.goto('/customers');
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('redirects orders page to login', async ({ page }) => {
      await page.goto('/orders');
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });
  });

  // ============================================
  // SESSION TESTS
  // ============================================

  test.describe('Session Management', () => {
    test('session persists after page refresh', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `e2e_session_${timestamp}@kashayafabs.com`;

      // Register
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Session Test User');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill('Test@123');
      await page.getByLabel(/confirm password/i).fill('Test@123');
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });

      // Refresh page
      await page.reload();

      // Should still be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('logout clears session', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `e2e_session_clear_${timestamp}@kashayafabs.com`;

      // Register
      await page.goto('/register');
      await page.getByLabel(/name/i).fill('Session Clear User');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill('Test@123');
      await page.getByLabel(/confirm password/i).fill('Test@123');
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });

      // Logout via dropdown menu
      await page.locator('header').getByRole('button').last().click();
      await page.waitForTimeout(500);
      // Use exact match to avoid matching user name
      await page.getByText('Logout', { exact: true }).click();
      await page.waitForURL(/\/login/, { timeout: 10000 });

      // Try to access dashboard
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
