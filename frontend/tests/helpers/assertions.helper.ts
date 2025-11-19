import { Page, expect } from '@playwright/test';

/**
 * Assertions Helper for E2E Tests
 * Provides reusable assertion methods
 */

/**
 * Assert no console errors on page
 */
export async function assertNoConsoleErrors(page: Page, testName: string): Promise<void> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`Page error: ${error.message}`);
  });

  await page.waitForTimeout(2000); // Wait for any delayed errors

  if (errors.length > 0) {
    console.log(`Console errors in ${testName}:`, errors);
  }

  expect(errors.length, `Found ${errors.length} console errors: ${errors.join(', ')}`).toBe(0);
}

/**
 * Assert toast notification appears
 */
export async function assertToastVisible(page: Page, message: string | RegExp): Promise<void> {
  const toast = page.getByText(message);
  await expect(toast).toBeVisible({ timeout: 5000 });
}

/**
 * Assert success toast
 */
export async function assertSuccessToast(page: Page, message?: string | RegExp): Promise<void> {
  const successMessage = message || /success|created|updated|deleted|saved/i;
  await assertToastVisible(page, successMessage);
}

/**
 * Assert error toast
 */
export async function assertErrorToast(page: Page, message?: string | RegExp): Promise<void> {
  const errorMessage = message || /error|failed|invalid/i;
  await assertToastVisible(page, errorMessage);
}

/**
 * Assert table has data
 */
export async function assertTableHasData(page: Page): Promise<void> {
  const table = page.locator('table tbody tr');
  await expect(table.first()).toBeVisible({ timeout: 5000 });
  const count = await table.count();
  expect(count).toBeGreaterThan(0);
}

/**
 * Assert table has specific row
 */
export async function assertTableHasRow(page: Page, text: string | RegExp): Promise<void> {
  const row = page.getByRole('row', { name: text });
  await expect(row).toBeVisible({ timeout: 5000 });
}

/**
 * Assert empty state is shown
 */
export async function assertEmptyState(page: Page, message?: string | RegExp): Promise<void> {
  const emptyMessage = message || /no.*found|empty|no data/i;
  await expect(page.getByText(emptyMessage)).toBeVisible({ timeout: 5000 });
}

/**
 * Assert loading spinner is shown
 */
export async function assertLoadingState(page: Page): Promise<void> {
  const loading = page.getByText(/loading|please wait/i);
  await expect(loading).toBeVisible({ timeout: 2000 });
}

/**
 * Assert pagination exists
 */
export async function assertPaginationExists(page: Page): Promise<void> {
  await expect(page.getByText(/page \d+ of \d+/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
}

/**
 * Assert form validation error
 */
export async function assertValidationError(page: Page, fieldLabel: string, errorMessage: string | RegExp): Promise<void> {
  const field = page.getByLabel(new RegExp(fieldLabel, 'i'));
  const errorText = page.getByText(errorMessage);

  await expect(field).toBeVisible();
  await expect(errorText).toBeVisible({ timeout: 3000 });
}

/**
 * Assert URL matches pattern
 */
export async function assertURLMatches(page: Page, pattern: RegExp): Promise<void> {
  await expect(page).toHaveURL(pattern, { timeout: 5000 });
}

/**
 * Assert dialog is open
 */
export async function assertDialogOpen(page: Page, title: string | RegExp): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await expect(dialog.getByText(title)).toBeVisible();
}

/**
 * Assert dialog is closed
 */
export async function assertDialogClosed(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).not.toBeVisible({ timeout: 3000 });
}
