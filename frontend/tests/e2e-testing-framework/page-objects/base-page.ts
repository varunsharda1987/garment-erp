import { Page, Locator, expect } from '@playwright/test';
import { TestConfig } from '../config/test-config';

/**
 * Base Page Object
 * Provides common functionality for all page objects
 */
export abstract class BasePage {
  readonly page: Page;
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleListeners();
  }

  /**
   * Setup console error/warning listeners
   */
  private setupConsoleListeners(): void {
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.errors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        this.warnings.push(msg.text());
      }
    });

    this.page.on('pageerror', (error) => {
      this.errors.push(`Page error: ${error.message}`);
    });
  }

  /**
   * Navigate to the page
   */
  abstract goto(): Promise<void>;

  /**
   * Get the page URL pattern
   */
  abstract get urlPattern(): RegExp;

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Verify the page URL
   */
  async verifyUrl(): Promise<void> {
    await expect(this.page).toHaveURL(this.urlPattern, {
      timeout: TestConfig.timeouts.navigation,
    });
  }

  /**
   * Take a screenshot
   */
  async screenshot(name: string): Promise<void> {
    if (TestConfig.screenshots.enabled) {
      await this.page.screenshot({
        path: `${TestConfig.screenshots.path}/${name}.png`,
        fullPage: TestConfig.screenshots.fullPage,
      });
    }
  }

  /**
   * Check for console errors
   */
  hasConsoleErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get console errors
   */
  getConsoleErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Clear console errors
   */
  clearConsoleErrors(): void {
    this.errors.length = 0;
  }

  /**
   * Assert no console errors
   */
  async assertNoConsoleErrors(): Promise<void> {
    // Wait a bit for any delayed errors
    await this.page.waitForTimeout(TestConfig.timeouts.animation);
    expect(this.errors.length, `Found console errors: ${this.errors.join(', ')}`).toBe(0);
  }

  /**
   * Check if element exists
   */
  async elementExists(locator: Locator): Promise<boolean> {
    return (await locator.count()) > 0;
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(locator: Locator, timeout?: number): Promise<void> {
    await locator.waitFor({
      state: 'visible',
      timeout: timeout || TestConfig.timeouts.pageLoad,
    });
  }

  /**
   * Click element and wait for navigation
   */
  async clickAndWaitForNavigation(locator: Locator): Promise<void> {
    await Promise.all([this.page.waitForNavigation(), locator.click()]);
  }

  /**
   * Get text content of element
   */
  async getText(locator: Locator): Promise<string> {
    return (await locator.textContent()) || '';
  }

  /**
   * Wait for toast notification
   */
  async waitForToast(type: 'success' | 'error' | 'warning' | 'info' = 'success'): Promise<Locator> {
    const toastSelectors: Record<string, string | RegExp> = {
      success: /success|created|updated|saved|deleted/i,
      error: /error|failed|invalid/i,
      warning: /warning|attention/i,
      info: /info|note/i,
    };

    const toast = this.page.getByText(toastSelectors[type]);
    await toast.waitFor({ timeout: TestConfig.timeouts.toast });
    return toast;
  }

  /**
   * Assert success toast is shown
   */
  async assertSuccessToast(): Promise<void> {
    const toast = await this.waitForToast('success');
    await expect(toast).toBeVisible();
  }

  /**
   * Assert error toast is shown
   */
  async assertErrorToast(): Promise<void> {
    const toast = await this.waitForToast('error');
    await expect(toast).toBeVisible();
  }

  /**
   * Wait for dialog to open
   */
  async waitForDialog(): Promise<Locator> {
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ timeout: TestConfig.timeouts.dialog });
    return dialog;
  }

  /**
   * Close dialog
   */
  async closeDialog(): Promise<void> {
    const closeButton = this.page.getByRole('button', { name: /close|×|cancel/i });
    if (await this.elementExists(closeButton)) {
      await closeButton.click();
    }
  }

  /**
   * Get loading indicator
   */
  getLoadingIndicator(): Locator {
    return this.page.locator('[data-testid="loading"], .loading, .spinner, [class*="loading"]');
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    const loading = this.getLoadingIndicator();
    if (await this.elementExists(loading)) {
      await loading.waitFor({ state: 'hidden', timeout: TestConfig.timeouts.pageLoad });
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.page.evaluate(() => localStorage.getItem('auth-token'));
    return !!token;
  }

  /**
   * Get authentication token
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => localStorage.getItem('auth-token'));
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

export default BasePage;
