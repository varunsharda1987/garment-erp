import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';

test.describe('Debug Dashboard Loading', () => {
  test('should debug dashboard page', async ({ page }) => {
    // Listen for console messages
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message);
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
      console.log('[REQUEST FAILED]:', request.url(), request.failure()?.errorText);
    });

    // Navigate to login
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`);
    await page.screenshot({ path: 'test-results/debug-01-login.png', fullPage: true });

    // Login
    console.log('Filling login form...');
    await page.fill('input[type="email"]', 'admin@kashayafabs.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.screenshot({ path: 'test-results/debug-02-login-filled.png', fullPage: true });

    console.log('Clicking submit...');
    await page.click('button[type="submit"]');

    // Wait and see what happens
    await page.waitForTimeout(5000);

    console.log('Current URL:', page.url());
    await page.screenshot({ path: 'test-results/debug-03-after-login.png', fullPage: true });

    // Try to navigate to dashboard
    console.log('Navigating to dashboard...');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(3000);

    console.log('Dashboard URL:', page.url());
    await page.screenshot({ path: 'test-results/debug-04-dashboard.png', fullPage: true });

    // Check what's on the page
    const pageContent = await page.content();
    console.log('Page title:', await page.title());
    console.log('Page has h1:', await page.locator('h1').count());
    console.log('Page has h2:', await page.locator('h2').count());

    // Get all headings
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('All headings:', headings);

    // Check for error messages
    const errorMessages = await page.locator('[role="alert"], .error, [class*="error"]').allTextContents();
    if (errorMessages.length > 0) {
      console.log('Error messages found:', errorMessages);
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/debug-05-final.png', fullPage: true });
  });
});
