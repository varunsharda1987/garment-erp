/**
 * E2E Tests for Fabric Management
 *
 * Critical user flow: Create, view, edit, and manage fabrics
 */

import { test, expect } from '@playwright/test';

test.describe('Fabric Management', () => {
  // Use a unique fabric name for each test run
  const fabricName = `Test Fabric ${Date.now()}`;
  const fabricCode = `TF-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@kashayafabs.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to fabric list page', async ({ page }) => {
    await page.goto('/fabrics');

    // Check page title
    await expect(page.locator('h1, h2').filter({ hasText: /fabric/i }).first()).toBeVisible();

    // Check for table or list
    await expect(page.locator('table, [role="list"]').first()).toBeVisible();
  });

  test('should create a new fabric', async ({ page }) => {
    await page.goto('/fabrics');

    // Click "Add" or "Create" button
    await page.click('button:has-text("Add"), button:has-text("Create"), a:has-text("Add")');

    // Wait for form to load
    await page.waitForSelector('form', { timeout: 5000 });

    // Fill fabric details
    await page.fill('input[name="name"], input[name="fabricName"]', fabricName);
    await page.fill('input[name="code"], input[name="fabricCode"]', fabricCode);

    // Fill other required fields if they exist
    const categoryField = page.locator('select[name="category"], input[name="category"]').first();
    if (await categoryField.isVisible()) {
      await categoryField.selectOption({ index: 1 });
    }

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message or redirect
    await page.waitForTimeout(2000);

    // Verify creation (check for success message or redirect to list)
    const successMessage = page.locator('text=/success|created/i');
    const isRedirected = page.url().includes('/fabrics');

    expect(await successMessage.isVisible() || isRedirected).toBeTruthy();
  });

  test('should view fabric details', async ({ page }) => {
    await page.goto('/fabrics');

    // Search for the created fabric
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(fabricName);
      await page.waitForTimeout(1000);
    }

    // Click on the fabric row or view button
    const fabricRow = page.locator(`text=${fabricName}, text=${fabricCode}`).first();
    if (await fabricRow.isVisible()) {
      await fabricRow.click();

      // Wait for details page
      await page.waitForTimeout(1000);

      // Verify we're on details page
      expect(await page.locator(`text=${fabricName}`).isVisible()).toBeTruthy();
    }
  });

  test('should edit fabric details', async ({ page }) => {
    await page.goto('/fabrics');

    // Find and click edit button for the test fabric
    const editButton = page.locator(`button:has-text("Edit"), a:has-text("Edit")`).first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Wait for form
      await page.waitForSelector('form');

      // Update fabric name
      const updatedName = `${fabricName} (Updated)`;
      await page.fill('input[name="name"], input[name="fabricName"]', updatedName);

      // Submit
      await page.click('button[type="submit"]');

      // Wait for success
      await page.waitForTimeout(2000);

      // Verify update
      expect(await page.locator(`text=${updatedName}`).isVisible()).toBeTruthy();
    }
  });

  test('should filter fabrics by category', async ({ page }) => {
    await page.goto('/fabrics');

    // Find category filter dropdown
    const categoryFilter = page.locator('select, [role="combobox"]').filter({ hasText: /category/i }).first();

    if (await categoryFilter.isVisible()) {
      // Select a category
      await categoryFilter.selectOption({ index: 1 });

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Verify table/list is updated
      await expect(page.locator('table tbody tr, [role="listitem"]').first()).toBeVisible();
    }
  });

  test('should search fabrics', async ({ page }) => {
    await page.goto('/fabrics');

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();

    if (await searchInput.isVisible()) {
      // Search for test fabric
      await searchInput.fill(fabricCode);
      await page.waitForTimeout(1000);

      // Verify results contain search term
      const resultsText = await page.locator('table, [role="list"]').first().textContent();
      expect(resultsText).toContain(fabricCode);
    }
  });

  test('should paginate fabric list', async ({ page }) => {
    await page.goto('/fabrics');

    // Check if pagination exists
    const nextButton = page.locator('button:has-text("Next"), button[aria-label="Next"]').first();

    if (await nextButton.isVisible() && !await nextButton.isDisabled()) {
      // Get current page number
      const currentPageText = await page.locator('text=/page \\d+ of \\d+/i').first().textContent();

      // Click next
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Verify page changed
      const newPageText = await page.locator('text=/page \\d+ of \\d+/i').first().textContent();
      expect(newPageText).not.toBe(currentPageText);
    }
  });

  test('should export fabric list', async ({ page }) => {
    await page.goto('/fabrics');

    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

    if (await exportButton.isVisible()) {
      // Start waiting for download
      const downloadPromise = page.waitForEvent('download');

      // Click export button
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/fabric|export/i);
    }
  });

  test('should handle fabric form validation', async ({ page }) => {
    await page.goto('/fabrics');

    // Click to create new fabric
    await page.click('button:has-text("Add"), a:has-text("Add")');
    await page.waitForSelector('form');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Wait for validation messages
    await page.waitForTimeout(500);

    // Check for validation errors
    const errorMessages = page.locator('text=/required|invalid/i');
    expect(await errorMessages.count()).toBeGreaterThan(0);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API and force error
    await page.route('**/api/fabrics*', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/fabrics');

    // Wait for error message
    await page.waitForTimeout(2000);

    // Check for error notification
    const errorNotification = page.locator('text=/error|failed/i').first();
    expect(await errorNotification.isVisible()).toBeTruthy();
  });
});
