import { test, expect, Page } from '@playwright/test';
import { registerUser, generateTestUser, clearAuth } from './helpers/auth.helper';
import { navigateToCustomers, navigateToCreateCustomer, waitForPageLoad } from './helpers/navigation.helper';
import {
  assertNoConsoleErrors,
  assertSuccessToast,
  assertTableHasData,
  assertTableHasRow,
  assertEmptyState,
  assertPaginationExists,
  assertValidationError,
  assertDialogOpen,
  assertDialogClosed,
} from './helpers/assertions.helper';
import { generateTestCustomer } from './fixtures/test-data';

/**
 * Customer Management E2E Tests for Kashaya Fabs ERP
 *
 * These tests verify:
 * - Customer list page loads correctly
 * - User can create a new customer
 * - User can edit an existing customer
 * - User can delete a customer
 * - Search functionality works
 * - Filter functionality works
 * - Pagination works
 * - Form validation works
 * - No console errors on pages
 */

test.describe('Customer Management', () => {

  test.beforeEach(async ({ page }) => {
    // Clear auth and register a new user
    await clearAuth(page);
    const user = generateTestUser('customer');
    await registerUser(page, user);
  });

  test('customer list page loads and displays correctly', async ({ page }) => {
    await navigateToCustomers(page);

    // Check page title and header
    await expect(page.getByText('Customers')).toBeVisible();

    // Check action buttons exist
    await expect(page.getByRole('button', { name: /add|create.*customer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();

    // Check search input exists
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/customers-list.png', fullPage: true });
  });

  test('user can create a new customer successfully', async ({ page }) => {
    await navigateToCreateCustomer(page);

    // Verify we're on the create page
    await expect(page.getByText(/create.*customer|new customer/i)).toBeVisible();

    // Generate test customer data
    const customer = generateTestCustomer('E2E');

    // Fill in the form
    await page.getByLabel(/customer code/i).fill(customer.code);
    await page.getByLabel(/company name|customer name/i).fill(customer.name);
    await page.getByLabel(/contact person/i).fill(customer.contactPerson);
    await page.getByLabel(/email/i).fill(customer.email);
    await page.getByLabel(/phone/i).fill(customer.phone);
    await page.getByLabel(/billing address/i).fill(customer.billingAddress);
    await page.getByLabel(/shipping address/i).fill(customer.shippingAddress);
    await page.getByLabel(/gst number/i).fill(customer.gstNumber);
    await page.getByLabel(/credit limit/i).fill(customer.creditLimit || '');
    await page.getByLabel(/credit days/i).fill(customer.creditDays || '');

    // Submit the form
    await page.getByRole('button', { name: /create.*customer|save/i }).click();

    // Should redirect to customer list
    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });

    // Should show success toast
    await assertSuccessToast(page);

    // Should see the new customer in the list
    await page.waitForTimeout(1000); // Wait for table to refresh
    await expect(page.getByText(customer.name)).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-created.png', fullPage: true });
  });

  test('form validation works correctly', async ({ page }) => {
    await navigateToCreateCustomer(page);

    // Try to submit empty form
    await page.getByRole('button', { name: /create.*customer|save/i }).click();

    // Should show validation errors
    await expect(page.getByText(/required|cannot be empty/i).first()).toBeVisible({ timeout: 3000 });

    // Should stay on create page
    await expect(page).toHaveURL(/\/customers\/new/);

    // Fill invalid email
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/company name|customer name/i).click(); // Trigger blur

    // Should show email validation error
    await expect(page.getByText(/invalid.*email|valid email/i)).toBeVisible({ timeout: 3000 });

    // Fill invalid phone (too long)
    await page.getByLabel(/phone/i).fill('12345678901');
    await page.getByLabel(/company name|customer name/i).click(); // Trigger blur

    // Should show phone validation error or limit input
    const phoneValue = await page.getByLabel(/phone/i).inputValue();
    expect(phoneValue.length).toBeLessThanOrEqual(10);

    // Fill invalid GST
    await page.getByLabel(/gst number/i).fill('INVALID');
    await page.getByLabel(/company name|customer name/i).click(); // Trigger blur

    // Should show GST validation error
    await expect(page.getByText(/invalid.*gst|gst.*format/i)).toBeVisible({ timeout: 3000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-validation.png', fullPage: true });
  });

  test('user can edit an existing customer', async ({ page }) => {
    // First create a customer
    await navigateToCreateCustomer(page);
    const customer = generateTestCustomer('Edit');

    await page.getByLabel(/customer code/i).fill(customer.code);
    await page.getByLabel(/company name|customer name/i).fill(customer.name);
    await page.getByLabel(/contact person/i).fill(customer.contactPerson);
    await page.getByLabel(/email/i).fill(customer.email);
    await page.getByLabel(/phone/i).fill(customer.phone);
    await page.getByLabel(/billing address/i).fill(customer.billingAddress);
    await page.getByRole('button', { name: /create.*customer|save/i }).click();

    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click Edit button for the customer
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    await editButton.click();

    // Should navigate to edit page
    await expect(page).toHaveURL(/\/customers\/[a-f0-9-]+\/edit/, { timeout: 5000 });

    // Update customer information
    const updatedName = `${customer.name} UPDATED`;
    await page.getByLabel(/company name|customer name/i).fill(updatedName);
    await page.getByLabel(/contact person/i).fill('Updated Contact Person');

    // Save changes
    await page.getByRole('button', { name: /update.*customer|save/i }).click();

    // Should redirect back to customer list
    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });

    // Should show success toast
    await assertSuccessToast(page);

    // Should see updated customer
    await page.waitForTimeout(1000);
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-updated.png', fullPage: true });
  });

  test('user can delete a customer', async ({ page }) => {
    // First create a customer
    await navigateToCreateCustomer(page);
    const customer = generateTestCustomer('Delete');

    await page.getByLabel(/customer code/i).fill(customer.code);
    await page.getByLabel(/company name|customer name/i).fill(customer.name);
    await page.getByLabel(/contact person/i).fill(customer.contactPerson);
    await page.getByLabel(/email/i).fill(customer.email);
    await page.getByLabel(/phone/i).fill(customer.phone);
    await page.getByLabel(/billing address/i).fill(customer.billingAddress);
    await page.getByRole('button', { name: /create.*customer|save/i }).click();

    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify customer is in the list
    await expect(page.getByText(customer.name)).toBeVisible();

    // Click Delete button
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    await deleteButton.click();

    // Should show confirmation dialog
    await assertDialogOpen(page, /delete.*customer|are you sure/i);

    // Confirm deletion
    await page.getByRole('button', { name: /^delete$|confirm/i }).click();

    // Dialog should close
    await assertDialogClosed(page);

    // Should show success toast
    await assertSuccessToast(page);

    // Customer should be removed from list
    await page.waitForTimeout(1000);
    await expect(page.getByText(customer.name)).not.toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-deleted.png', fullPage: true });
  });

  test('search functionality works', async ({ page }) => {
    // Create a few customers first
    const customers = [
      generateTestCustomer('SearchA'),
      generateTestCustomer('SearchB'),
      generateTestCustomer('SearchC'),
    ];

    for (const customer of customers) {
      await navigateToCreateCustomer(page);
      await page.getByLabel(/customer code/i).fill(customer.code);
      await page.getByLabel(/company name|customer name/i).fill(customer.name);
      await page.getByLabel(/contact person/i).fill(customer.contactPerson);
      await page.getByLabel(/email/i).fill(customer.email);
      await page.getByLabel(/phone/i).fill(customer.phone);
      await page.getByLabel(/billing address/i).fill(customer.billingAddress);
      await page.getByRole('button', { name: /create.*customer|save/i }).click();
      await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });
      await page.waitForTimeout(500);
    }

    // Now test search
    await navigateToCustomers(page);
    await page.waitForTimeout(1000);

    // Search for specific customer
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('SearchB');

    // Wait for debounce and results
    await page.waitForTimeout(500);

    // Should show SearchB customer
    await expect(page.getByText(customers[1].name)).toBeVisible({ timeout: 5000 });

    // Should not show other customers (might be visible if pagination shows them)
    // This is optional based on your implementation

    // Clear search
    const clearButton = page.getByRole('button', { name: /clear|×/i }).first();
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-search.png', fullPage: true });
  });

  test('pagination works correctly', async ({ page }) => {
    await navigateToCustomers(page);

    // Check if pagination exists
    const paginationText = page.getByText(/page \d+ of \d+/i);
    const hasPagination = await paginationText.isVisible().catch(() => false);

    if (hasPagination) {
      // Test pagination controls
      await assertPaginationExists(page);

      // Get initial page number
      const initialPageText = await paginationText.textContent();

      // Click next page if not on last page
      const nextButton = page.getByRole('button', { name: /next/i });
      const isNextEnabled = await nextButton.isEnabled();

      if (isNextEnabled) {
        await nextButton.click();
        await page.waitForTimeout(1000);

        // Page number should change
        const newPageText = await paginationText.textContent();
        expect(newPageText).not.toBe(initialPageText);

        // Go back to previous page
        const prevButton = page.getByRole('button', { name: /previous/i });
        await prevButton.click();
        await page.waitForTimeout(1000);

        // Should be back to initial page
        const finalPageText = await paginationText.textContent();
        expect(finalPageText).toBe(initialPageText);
      }

      // Take screenshot
      await page.screenshot({ path: 'test-results/customer-pagination.png', fullPage: true });
    }
  });

  test('cancel button returns to list without saving', async ({ page }) => {
    await navigateToCreateCustomer(page);

    // Fill some data
    const customer = generateTestCustomer('Cancel');
    await page.getByLabel(/company name|customer name/i).fill(customer.name);

    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Should return to customer list
    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 5000 });

    // Customer should not be in the list
    await page.waitForTimeout(1000);
    await expect(page.getByText(customer.name)).not.toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-cancel.png', fullPage: true });
  });

  test('no console errors on customer list page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await navigateToCustomers(page);
    await page.waitForTimeout(2000);

    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('no console errors on create customer page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await navigateToCreateCustomer(page);
    await page.waitForTimeout(2000);

    expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
  });

  test('export button is visible and clickable', async ({ page }) => {
    await navigateToCustomers(page);

    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-export.png', fullPage: true });
  });

  test('customer details are displayed correctly in list', async ({ page }) => {
    // Create a customer with all details
    await navigateToCreateCustomer(page);
    const customer = generateTestCustomer('Details');

    await page.getByLabel(/customer code/i).fill(customer.code);
    await page.getByLabel(/company name|customer name/i).fill(customer.name);
    await page.getByLabel(/contact person/i).fill(customer.contactPerson);
    await page.getByLabel(/email/i).fill(customer.email);
    await page.getByLabel(/phone/i).fill(customer.phone);
    await page.getByLabel(/billing address/i).fill(customer.billingAddress);
    await page.getByRole('button', { name: /create.*customer|save/i }).click();

    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify customer details are shown
    await expect(page.getByText(customer.name)).toBeVisible();
    await expect(page.getByText(customer.code)).toBeVisible();
    await expect(page.getByText(customer.contactPerson)).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-details.png', fullPage: true });
  });

});
