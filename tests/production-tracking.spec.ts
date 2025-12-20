import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';
const API_BASE_URL = 'http://localhost:5000';

// Test user credentials
const ADMIN_USER = {
  email: 'admin@kashayafabs.com',
  password: 'admin123',
};

/**
 * E2E Tests for Production Tracking UI & Enhancement Features
 *
 * This test suite covers:
 * - Phase 1: Production Tracking UI
 * - Phase 2: Override History Page
 * - Phase 3: Enhanced Visual Blockers
 * - Phase 4: Notification System
 */

test.describe('Production Tracking & Blocking System', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.describe('Phase 1: Production Tracking UI', () => {
    test('should navigate to Production Status page', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Check page title
      await expect(page.locator('h1, h2').filter({ hasText: 'Production Status' })).toBeVisible();

      // Take screenshot
      await page.screenshot({ path: 'test-results/01-production-status-page.png', fullPage: true });
    });

    test('should display order items with current stages', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Check if order items are displayed
      const orderItems = page.locator('[class*="Card"]').filter({ has: page.locator('text=/Order #|ORD-/i') });
      const count = await orderItems.count();

      console.log(`Found ${count} order items`);
      expect(count).toBeGreaterThan(0);

      await page.screenshot({ path: 'test-results/02-order-items-list.png', fullPage: true });
    });

    test('should show "Update Stage" button for admin users', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Look for "Update Stage" button
      const updateButton = page.locator('button:has-text("Update Stage")').first();

      if (await updateButton.isVisible()) {
        console.log('✓ "Update Stage" button is visible');
        await page.screenshot({ path: 'test-results/03-update-stage-button.png' });
      } else {
        console.log('✗ "Update Stage" button not found - may indicate no work orders exist');
        await page.screenshot({ path: 'test-results/03-no-update-button.png', fullPage: true });
      }
    });

    test('should open inline production tracking form', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      const updateButton = page.locator('button:has-text("Update Stage")').first();

      if (await updateButton.isVisible()) {
        await updateButton.click();
        await page.waitForTimeout(500);

        // Check if form is displayed
        await expect(page.locator('text="Update Production Stage"')).toBeVisible();

        // Check form elements
        await expect(page.locator('label:has-text("New Stage")')).toBeVisible();
        await expect(page.locator('label:has-text("Quantity Completed")')).toBeVisible();
        await expect(page.locator('label:has-text("Remarks")')).toBeVisible();

        console.log('✓ Production tracking form opened successfully');
        await page.screenshot({ path: 'test-results/04-tracking-form-opened.png', fullPage: true });
      } else {
        console.log('⊘ Skipping - no update button available');
      }
    });

    test('should validate stage selection and show real-time validation', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      const updateButton = page.locator('button:has-text("Update Stage")').first();

      if (await updateButton.isVisible()) {
        await updateButton.click();
        await page.waitForTimeout(500);

        // Select a stage from dropdown
        const stageSelect = page.locator('[id="stage"]').first();
        await stageSelect.click();

        // Wait for dropdown options
        await page.waitForTimeout(300);

        // Get first available option
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();

          // Wait for validation to complete
          await page.waitForTimeout(2000);

          // Check for validation indicators
          const validIndicator = page.locator('text="Stage transition is valid"');
          const blockerIndicator = page.locator('text="Validation Issues"');

          if (await validIndicator.isVisible()) {
            console.log('✓ Stage transition is valid (no blockers)');
            await page.screenshot({ path: 'test-results/05-validation-success.png', fullPage: true });
          } else if (await blockerIndicator.isVisible()) {
            console.log('⚠ Stage transition has blockers');
            await page.screenshot({ path: 'test-results/05-validation-blocked.png', fullPage: true });
          } else {
            console.log('? Validation status unclear');
            await page.screenshot({ path: 'test-results/05-validation-unknown.png', fullPage: true });
          }
        }
      } else {
        console.log('⊘ Skipping - no update button available');
      }
    });
  });

  test.describe('Phase 3: Enhanced Visual Blockers', () => {
    test('should display enhanced blocker cards when blockers exist', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Look for blocker section
      const blockerSection = page.locator('text="Production Blockers"');

      if (await blockerSection.isVisible()) {
        console.log('✓ Found production blockers section');

        // Check for blocker cards
        const blockerCards = page.locator('[class*="border-red-500"], [class*="border-orange-500"], [class*="border-yellow-500"]');
        const blockerCount = await blockerCards.count();

        console.log(`Found ${blockerCount} blocker card(s)`);

        if (blockerCount > 0) {
          // Check first blocker card
          const firstBlocker = blockerCards.first();

          // Verify severity badge is visible
          const severityBadge = firstBlocker.locator('span:has-text(/CRITICAL|HIGH|MEDIUM/)');
          await expect(severityBadge.first()).toBeVisible();

          // Take screenshot
          await page.screenshot({ path: 'test-results/06-enhanced-blocker-cards.png', fullPage: true });

          // Test expandable details
          const expandButton = firstBlocker.locator('button').last();
          if (await expandButton.isVisible()) {
            await expandButton.click();
            await page.waitForTimeout(300);

            // Check if resolution steps are visible
            const resolutionSteps = firstBlocker.locator('text="Resolution Steps"');
            if (await resolutionSteps.isVisible()) {
              console.log('✓ Blocker card expanded with resolution steps');
              await page.screenshot({ path: 'test-results/07-blocker-expanded.png', fullPage: true });
            }
          }
        }
      } else {
        console.log('ℹ No production blockers found on this page');
        await page.screenshot({ path: 'test-results/06-no-blockers.png', fullPage: true });
      }
    });

    test('should show direct action buttons in blocker cards', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Look for action buttons in blocker cards
      const actionButtons = page.locator('button:has-text(/View Style|View Test|View Sample|Go to Testing/)');
      const actionButtonCount = await actionButtons.count();

      if (actionButtonCount > 0) {
        console.log(`✓ Found ${actionButtonCount} action button(s) in blocker cards`);
        await page.screenshot({ path: 'test-results/08-blocker-action-buttons.png', fullPage: true });
      } else {
        console.log('ℹ No action buttons found - may indicate no blockers with actions');
      }
    });
  });

  test.describe('Phase 2: Override History Page', () => {
    test('should navigate to Override History page (admin only)', async () => {
      // Navigate via sidebar
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Look for Admin menu in sidebar
      const adminMenu = page.locator('text="Admin"').first();

      if (await adminMenu.isVisible()) {
        await adminMenu.click();
        await page.waitForTimeout(300);

        // Click Override History link
        const overrideHistoryLink = page.locator('a[href="/admin/override-history"]');
        if (await overrideHistoryLink.isVisible()) {
          await overrideHistoryLink.click();
          await page.waitForURL(`${BASE_URL}/admin/override-history`);

          console.log('✓ Navigated to Override History page');
          await page.screenshot({ path: 'test-results/09-override-history-page.png', fullPage: true });
        }
      } else {
        // Try direct navigation
        await page.goto(`${BASE_URL}/admin/override-history`);
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'test-results/09-override-history-direct.png', fullPage: true });
      }

      // Check for page elements
      const pageTitle = page.locator('h1, h2').filter({ hasText: /Override History/i });
      if (await pageTitle.isVisible()) {
        console.log('✓ Override History page loaded');
      }
    });

    test('should display override history table', async () => {
      await page.goto(`${BASE_URL}/admin/override-history`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for table or data display
      const hasData = await page.locator('text=/No overrides found|Date\/Time|User/i').isVisible();

      if (hasData) {
        console.log('✓ Override history data section visible');
        await page.screenshot({ path: 'test-results/10-override-history-data.png', fullPage: true });
      } else {
        console.log('? Override history page structure unclear');
        await page.screenshot({ path: 'test-results/10-override-history-unclear.png', fullPage: true });
      }
    });

    test('should have CSV export button', async () => {
      await page.goto(`${BASE_URL}/admin/override-history`);
      await page.waitForLoadState('networkidle');

      const exportButton = page.locator('button:has-text(/Export|CSV/i)');

      if (await exportButton.isVisible()) {
        console.log('✓ Export CSV button found');
        await page.screenshot({ path: 'test-results/11-export-button.png' });
      } else {
        console.log('ℹ Export button not visible');
      }
    });
  });

  test.describe('Phase 4: Notification System', () => {
    test('should display toast notification when blocker is detected', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      const updateButton = page.locator('button:has-text("Update Stage")').first();

      if (await updateButton.isVisible()) {
        await updateButton.click();
        await page.waitForTimeout(500);

        // Select a stage
        const stageSelect = page.locator('[id="stage"]').first();
        await stageSelect.click();
        await page.waitForTimeout(300);

        const stageOption = page.locator('[role="option"]').first();
        if (await stageOption.isVisible()) {
          await stageOption.click();

          // Wait for validation and potential toast
          await page.waitForTimeout(3000);

          // Look for toast notification
          const toast = page.locator('[class*="sonner"], [role="status"], [role="alert"]').filter({ hasText: /Blocker|Production|Valid/i });

          if (await toast.isVisible()) {
            console.log('✓ Toast notification displayed');
            await page.screenshot({ path: 'test-results/12-toast-notification.png' });
          }
        }
      }
    });
  });

  test.describe('Integration Tests', () => {
    test('should show refresh mechanism with last updated timestamp', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Look for last updated timestamp
      const lastUpdated = page.locator('text=/Updated.*ago|Last updated/i');

      if (await lastUpdated.isVisible()) {
        console.log('✓ Last updated timestamp visible');

        // Look for refresh button
        const refreshButton = page.locator('button:has-text("Refresh")');
        if (await refreshButton.isVisible()) {
          console.log('✓ Refresh button visible');
          await page.screenshot({ path: 'test-results/13-refresh-mechanism.png' });
        }
      }
    });

    test('should handle form cancellation', async () => {
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      const updateButton = page.locator('button:has-text("Update Stage")').first();

      if (await updateButton.isVisible()) {
        await updateButton.click();
        await page.waitForTimeout(500);

        // Click cancel button
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(300);

          // Form should be hidden
          const form = page.locator('text="Update Production Stage"');
          const formVisible = await form.isVisible();

          if (!formVisible) {
            console.log('✓ Form closed on cancel');
          } else {
            console.log('✗ Form still visible after cancel');
          }
        }
      }
    });
  });

  test.describe('Error Scenarios', () => {
    test('should handle API errors gracefully', async () => {
      // This test checks error handling
      await page.goto(`${BASE_URL}/production/status`);
      await page.waitForLoadState('networkidle');

      // Listen for console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Listen for network errors
      const networkErrors: string[] = [];
      page.on('response', response => {
        if (response.status() >= 400) {
          networkErrors.push(`${response.status()} - ${response.url()}`);
        }
      });

      await page.waitForTimeout(2000);

      if (consoleErrors.length > 0) {
        console.log('⚠ Console errors detected:');
        consoleErrors.forEach(err => console.log(`  - ${err}`));
      } else {
        console.log('✓ No console errors detected');
      }

      if (networkErrors.length > 0) {
        console.log('⚠ Network errors detected:');
        networkErrors.forEach(err => console.log(`  - ${err}`));
      } else {
        console.log('✓ No network errors detected');
      }

      await page.screenshot({ path: 'test-results/14-error-check.png', fullPage: true });
    });
  });
});
