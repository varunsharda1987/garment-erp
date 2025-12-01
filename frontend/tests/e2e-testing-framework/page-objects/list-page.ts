import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { TestConfig } from '../config/test-config';

/**
 * Base List Page Object
 * Provides common functionality for list/table pages
 */
export abstract class ListPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ============================================
  // ABSTRACT METHODS
  // ============================================

  /**
   * Get the create button text/label
   */
  abstract get createButtonLabel(): string | RegExp;

  /**
   * Get the create page URL pattern
   */
  abstract get createPageUrl(): string;

  // ============================================
  // PAGE ELEMENTS
  // ============================================

  /**
   * Get page title/header
   */
  get pageTitle(): Locator {
    return this.page.locator('h1, [class*="title"]').first();
  }

  /**
   * Get create/add button
   */
  get createButton(): Locator {
    return this.page.getByRole('button', { name: this.createButtonLabel });
  }

  /**
   * Get export button
   */
  get exportButton(): Locator {
    return this.page.getByRole('button', { name: /export/i });
  }

  /**
   * Get import button
   */
  get importButton(): Locator {
    return this.page.getByRole('button', { name: /import/i });
  }

  /**
   * Get search input
   */
  get searchInput(): Locator {
    return this.page.getByPlaceholder(/search/i);
  }

  /**
   * Get clear search button
   */
  get clearSearchButton(): Locator {
    return this.page.getByRole('button', { name: /clear|×/i }).first();
  }

  /**
   * Get data table
   */
  get dataTable(): Locator {
    return this.page.locator('table, [role="table"], [data-testid="data-table"]').first();
  }

  /**
   * Get table rows
   */
  get tableRows(): Locator {
    return this.dataTable.locator('tbody tr, [role="row"]:not([role="rowheader"])');
  }

  /**
   * Get table headers
   */
  get tableHeaders(): Locator {
    return this.dataTable.locator('thead th, [role="columnheader"]');
  }

  /**
   * Get empty state element
   */
  get emptyState(): Locator {
    return this.page.locator('[data-testid="empty-state"], .empty-state, [class*="empty"]').first();
  }

  /**
   * Get loading indicator
   */
  get loadingIndicator(): Locator {
    return this.page.locator('[data-testid="loading"], .loading, .skeleton, [class*="loading"]').first();
  }

  /**
   * Get pagination container
   */
  get pagination(): Locator {
    return this.page.locator('[class*="pagination"], [role="navigation"][aria-label*="pagination"]').first();
  }

  /**
   * Get next page button
   */
  get nextPageButton(): Locator {
    return this.page.getByRole('button', { name: /next/i });
  }

  /**
   * Get previous page button
   */
  get prevPageButton(): Locator {
    return this.page.getByRole('button', { name: /previous|prev/i });
  }

  /**
   * Get page info text (e.g., "Page 1 of 10")
   */
  get pageInfo(): Locator {
    return this.page.getByText(/page \d+ of \d+/i);
  }

  // ============================================
  // TABLE ACTIONS
  // ============================================

  /**
   * Get row count
   */
  async getRowCount(): Promise<number> {
    await this.waitForLoad();
    return await this.tableRows.count();
  }

  /**
   * Check if table has data
   */
  async hasData(): Promise<boolean> {
    const count = await this.getRowCount();
    return count > 0;
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateShown(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Get row by index (0-based)
   */
  getRowByIndex(index: number): Locator {
    return this.tableRows.nth(index);
  }

  /**
   * Get row containing specific text
   */
  getRowByText(text: string | RegExp): Locator {
    return this.tableRows.filter({ hasText: text }).first();
  }

  /**
   * Get cell value from row
   */
  async getCellValue(row: Locator, columnIndex: number): Promise<string> {
    const cell = row.locator('td, [role="cell"]').nth(columnIndex);
    return (await cell.textContent()) || '';
  }

  /**
   * Get edit button for a row
   */
  getEditButton(row: Locator): Locator {
    return row.getByRole('button', { name: /edit/i });
  }

  /**
   * Get delete button for a row
   */
  getDeleteButton(row: Locator): Locator {
    return row.getByRole('button', { name: /delete/i });
  }

  /**
   * Get view button for a row
   */
  getViewButton(row: Locator): Locator {
    return row.getByRole('button', { name: /view|details/i });
  }

  /**
   * Get actions dropdown for a row
   */
  getActionsDropdown(row: Locator): Locator {
    return row.getByRole('button', { name: /actions|more|⋮|\.{3}/i });
  }

  // ============================================
  // NAVIGATION ACTIONS
  // ============================================

  /**
   * Click create button and navigate to create page
   */
  async clickCreate(): Promise<void> {
    await this.createButton.click();
    await expect(this.page).toHaveURL(new RegExp(this.createPageUrl), {
      timeout: TestConfig.timeouts.navigation,
    });
  }

  /**
   * Click edit button for a specific row
   */
  async clickEdit(row: Locator): Promise<void> {
    // Try direct edit button first
    const editButton = this.getEditButton(row);
    if (await editButton.isVisible()) {
      await editButton.click();
    } else {
      // Try actions dropdown
      const actionsDropdown = this.getActionsDropdown(row);
      if (await actionsDropdown.isVisible()) {
        await actionsDropdown.click();
        await this.page.getByRole('menuitem', { name: /edit/i }).click();
      }
    }
    await this.waitForLoad();
  }

  /**
   * Click view/details button for a specific row
   */
  async clickView(row: Locator): Promise<void> {
    const viewButton = this.getViewButton(row);
    if (await viewButton.isVisible()) {
      await viewButton.click();
    } else {
      // Try clicking the row itself
      await row.click();
    }
    await this.waitForLoad();
  }

  /**
   * Click delete button for a specific row
   */
  async clickDelete(row: Locator): Promise<void> {
    const deleteButton = this.getDeleteButton(row);
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
    } else {
      // Try actions dropdown
      const actionsDropdown = this.getActionsDropdown(row);
      if (await actionsDropdown.isVisible()) {
        await actionsDropdown.click();
        await this.page.getByRole('menuitem', { name: /delete/i }).click();
      }
    }
  }

  /**
   * Confirm delete in dialog
   */
  async confirmDelete(): Promise<void> {
    const dialog = await this.waitForDialog();
    const confirmButton = dialog.getByRole('button', { name: /delete|confirm|yes/i });
    await confirmButton.click();
    await this.waitForLoad();
  }

  /**
   * Cancel delete in dialog
   */
  async cancelDelete(): Promise<void> {
    const dialog = await this.waitForDialog();
    const cancelButton = dialog.getByRole('button', { name: /cancel|no/i });
    await cancelButton.click();
  }

  // ============================================
  // SEARCH & FILTER
  // ============================================

  /**
   * Search for a term
   */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    // Wait for debounce
    await this.page.waitForTimeout(TestConfig.timeouts.debounce);
    await this.waitForLoad();
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    const clearButton = this.clearSearchButton;
    if (await clearButton.isVisible()) {
      await clearButton.click();
    } else {
      await this.searchInput.fill('');
    }
    await this.page.waitForTimeout(TestConfig.timeouts.debounce);
    await this.waitForLoad();
  }

  /**
   * Apply filter (generic)
   */
  async applyFilter(filterName: string, value: string): Promise<void> {
    // Try to find filter dropdown/select by name
    const filter = this.page.getByLabel(new RegExp(filterName, 'i'));
    if (await filter.isVisible()) {
      await filter.selectOption(value);
      await this.waitForLoad();
    }
  }

  // ============================================
  // PAGINATION
  // ============================================

  /**
   * Check if pagination exists
   */
  async hasPagination(): Promise<boolean> {
    return await this.pagination.isVisible();
  }

  /**
   * Go to next page
   */
  async goToNextPage(): Promise<void> {
    if (await this.nextPageButton.isEnabled()) {
      await this.nextPageButton.click();
      await this.waitForLoad();
    }
  }

  /**
   * Go to previous page
   */
  async goToPrevPage(): Promise<void> {
    if (await this.prevPageButton.isEnabled()) {
      await this.prevPageButton.click();
      await this.waitForLoad();
    }
  }

  /**
   * Get current page number
   */
  async getCurrentPage(): Promise<number> {
    const pageText = await this.pageInfo.textContent();
    if (!pageText) return 1;
    const match = pageText.match(/page\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Get total pages
   */
  async getTotalPages(): Promise<number> {
    const pageText = await this.pageInfo.textContent();
    if (!pageText) return 1;
    const match = pageText.match(/of\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  // ============================================
  // EXPORT/IMPORT
  // ============================================

  /**
   * Click export button
   */
  async clickExport(): Promise<void> {
    await this.exportButton.click();
    await this.page.waitForTimeout(TestConfig.timeouts.animation);
  }

  /**
   * Click import button
   */
  async clickImport(): Promise<void> {
    await this.importButton.click();
    await this.page.waitForTimeout(TestConfig.timeouts.animation);
  }

  // ============================================
  // VERIFICATION METHODS
  // ============================================

  /**
   * Verify page is loaded correctly
   */
  async verifyPageLoaded(): Promise<void> {
    await this.verifyUrl();
    await expect(this.pageTitle).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  /**
   * Verify table structure
   */
  async verifyTableStructure(expectedHeaders: string[]): Promise<void> {
    const headers = await this.tableHeaders.allTextContents();
    for (const expected of expectedHeaders) {
      const found = headers.some((h) => h.toLowerCase().includes(expected.toLowerCase()));
      expect(found, `Expected table to have header "${expected}"`).toBe(true);
    }
  }

  /**
   * Verify row contains expected text
   */
  async verifyRowExists(text: string): Promise<void> {
    const row = this.getRowByText(text);
    await expect(row).toBeVisible({ timeout: TestConfig.timeouts.apiResponse });
  }

  /**
   * Verify row does not exist
   */
  async verifyRowNotExists(text: string): Promise<void> {
    const row = this.getRowByText(text);
    await expect(row).not.toBeVisible();
  }

  // ============================================
  // COMPLETE WORKFLOW TESTS
  // ============================================

  /**
   * Test search functionality
   */
  async testSearchFunctionality(searchTerm: string, expectedToFind: boolean): Promise<void> {
    await this.search(searchTerm);

    if (expectedToFind) {
      const hasData = await this.hasData();
      expect(hasData, `Expected to find results for "${searchTerm}"`).toBe(true);
    }

    await this.clearSearch();
  }

  /**
   * Test pagination functionality
   */
  async testPaginationFunctionality(): Promise<void> {
    if (!(await this.hasPagination())) {
      return; // Skip if no pagination
    }

    const initialPage = await this.getCurrentPage();
    const totalPages = await this.getTotalPages();

    if (totalPages > 1) {
      // Go to next page
      await this.goToNextPage();
      const newPage = await this.getCurrentPage();
      expect(newPage).toBe(initialPage + 1);

      // Go back
      await this.goToPrevPage();
      const backPage = await this.getCurrentPage();
      expect(backPage).toBe(initialPage);
    }
  }

  /**
   * Test delete functionality
   */
  async testDeleteFunctionality(rowText: string): Promise<void> {
    const row = this.getRowByText(rowText);
    await expect(row).toBeVisible();

    await this.clickDelete(row);
    await this.confirmDelete();

    await this.assertSuccessToast();
    await this.verifyRowNotExists(rowText);
  }
}

export default ListPage;
