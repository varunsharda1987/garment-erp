import { Page, expect } from '@playwright/test';

/**
 * Navigation Helper for E2E Tests
 * Provides reusable navigation methods
 */

/**
 * Navigate to a specific module/page
 */
export async function navigateToModule(page: Page, moduleName: string): Promise<void> {
  // Click on the module link in the sidebar or navigation
  await page.getByRole('link', { name: new RegExp(moduleName, 'i') }).first().click();
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to Dashboard
 */
export async function navigateToDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Navigate to Customers
 */
export async function navigateToCustomers(page: Page): Promise<void> {
  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/customers/);
}

/**
 * Navigate to Create Customer
 */
export async function navigateToCreateCustomer(page: Page): Promise<void> {
  await navigateToCustomers(page);
  await page.getByRole('button', { name: /add|create|new customer/i }).click();
  await page.waitForURL(/\/customers\/new/, { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to Materials
 */
export async function navigateToMaterials(page: Page): Promise<void> {
  await page.goto('/materials');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/materials/);
}

/**
 * Navigate to Orders
 */
export async function navigateToOrders(page: Page): Promise<void> {
  await page.goto('/orders');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/orders/);
}

/**
 * Navigate to Suppliers
 */
export async function navigateToSuppliers(page: Page): Promise<void> {
  await page.goto('/suppliers');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/suppliers/);
}

/**
 * Navigate to Users (Admin only)
 */
export async function navigateToUsers(page: Page): Promise<void> {
  await page.goto('/users');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/users/);
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}
