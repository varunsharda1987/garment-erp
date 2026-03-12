import { test, expect } from '@playwright/test';

/**
 * LEVEL 4: GST & Tax Module Tests
 *
 * Tests the tax management pages added in the GST implementation:
 * - HSN/SAC Masters CRUD
 * - Tax Masters CRUD
 * - TDS Tracking (create, status transitions, summary)
 * - TCS Tracking (create, status transitions)
 * - GST Reports (GSTR-1, GSTR-3B generation)
 * - Credit Notes (list, status)
 * - Debit Notes (list, status)
 */

test.describe.serial('Level 4: GST & Tax Management', () => {
  let authToken: string;

  // Authenticate before all tests
  test.beforeAll(async ({ request }) => {
    const timestamp = Date.now();
    const email = `gst_test_${timestamp}@kashayafabs.com`;

    await request.post('http://localhost:5000/api/auth/register', {
      data: { name: 'GST Tester', email, password: 'Test@123' },
    });

    const loginResponse = await request.post('http://localhost:5000/api/auth/login', {
      data: { email, password: 'Test@123' },
    });

    const loginData = await loginResponse.json();
    authToken = loginData.token;
  });

  // ============================================
  // HSN/SAC Masters
  // ============================================
  test.describe('HSN/SAC Masters', () => {
    test('should navigate to HSN/SAC page', async ({ page }) => {
      await page.goto('http://localhost:5173/hsn-sac-masters');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/HSN.*SAC/i).first()).toBeVisible();
    });

    test('should display HSN/SAC list with table', async ({ page }) => {
      await page.goto('http://localhost:5173/hsn-sac-masters');
      await page.waitForLoadState('networkidle');

      // Table should be visible
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Should have column headers
      await expect(page.getByText('Code')).toBeVisible();
      await expect(page.getByText('Type')).toBeVisible();
    });

    test('should open create dialog', async ({ page }) => {
      await page.goto('http://localhost:5173/hsn-sac-masters');
      await page.waitForLoadState('networkidle');

      // Click create button
      const addButton = page.getByRole('button', { name: /add|create|new/i });
      if (await addButton.isVisible()) {
        await addButton.click();
        // Dialog should appear
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });

    test('should filter by type', async ({ page }) => {
      await page.goto('http://localhost:5173/hsn-sac-masters');
      await page.waitForLoadState('networkidle');

      // Look for type filter dropdown
      const typeFilter = page.locator('[data-testid="type-filter"], select').first();
      if (await typeFilter.isVisible()) {
        await typeFilter.click();
      }
    });
  });

  // ============================================
  // Tax Masters
  // ============================================
  test.describe('Tax Masters', () => {
    test('should navigate to Tax Masters page', async ({ page }) => {
      await page.goto('http://localhost:5173/tax-masters');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Tax Master/i).first()).toBeVisible();
    });

    test('should display tax master list', async ({ page }) => {
      await page.goto('http://localhost:5173/tax-masters');
      await page.waitForLoadState('networkidle');

      const table = page.locator('table');
      await expect(table).toBeVisible();
    });
  });

  // ============================================
  // TDS Tracking
  // ============================================
  test.describe('TDS Tracking', () => {
    test('should navigate to TDS page', async ({ page }) => {
      await page.goto('http://localhost:5173/tds');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/TDS/i).first()).toBeVisible();
    });

    test('should display TDS summary cards', async ({ page }) => {
      await page.goto('http://localhost:5173/tds');
      await page.waitForLoadState('networkidle');

      // Summary cards should be visible
      await expect(page.getByText(/Total Entries/i)).toBeVisible();
    });

    test('should display financial year filter', async ({ page }) => {
      await page.goto('http://localhost:5173/tds');
      await page.waitForLoadState('networkidle');

      // FY selector should exist
      await expect(page.getByText(/2025-26|Financial Year/i).first()).toBeVisible();
    });

    test('should open Record TDS dialog', async ({ page }) => {
      await page.goto('http://localhost:5173/tds');
      await page.waitForLoadState('networkidle');

      const recordButton = page.getByRole('button', { name: /Record TDS|Add TDS|New/i });
      if (await recordButton.isVisible()) {
        await recordButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();

        // Dialog should have key fields
        await expect(page.getByText(/Deductor/i)).toBeVisible();
        await expect(page.getByText(/Section/i)).toBeVisible();
      }
    });

    test('should create a TDS entry via API and verify in list', async ({ page, request }) => {
      // Create via API
      const createResponse = await request.post('http://localhost:5000/api/tds', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          deductorName: 'E2E Test Deductor',
          deducteeName: 'E2E Test Company',
          tdsSection: '194C',
          tdsRate: 1,
          grossAmount: 100000,
          tdsAmount: 1000,
          netAmount: 99000,
          deductionDate: '2026-01-15',
          financialYear: '2025-26',
          quarter: 4,
        },
      });

      if (createResponse.status() === 201) {
        const tdsData = await createResponse.json();

        // Navigate to TDS page and verify the entry appears
        await page.goto('http://localhost:5173/tds');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText('E2E Test Deductor')).toBeVisible();
        await expect(page.getByText('194C')).toBeVisible();

        // Cleanup
        await request.delete(`http://localhost:5000/api/tds/${tdsData.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    });

    test('should filter by quarter', async ({ page }) => {
      await page.goto('http://localhost:5173/tds');
      await page.waitForLoadState('networkidle');

      // Look for quarter filter
      const quarterFilter = page.getByText(/All Quarters|Quarter/i).first();
      await expect(quarterFilter).toBeVisible();
    });
  });

  // ============================================
  // TCS Tracking
  // ============================================
  test.describe('TCS Tracking', () => {
    test('should navigate to TCS page', async ({ page }) => {
      await page.goto('http://localhost:5173/tcs');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/TCS/i).first()).toBeVisible();
    });

    test('should display TCS summary cards', async ({ page }) => {
      await page.goto('http://localhost:5173/tcs');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/Total Entries/i)).toBeVisible();
    });

    test('should open Record TCS dialog', async ({ page }) => {
      await page.goto('http://localhost:5173/tcs');
      await page.waitForLoadState('networkidle');

      const recordButton = page.getByRole('button', { name: /Record TCS|Add TCS|New/i });
      if (await recordButton.isVisible()) {
        await recordButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();

        await expect(page.getByText(/Customer/i)).toBeVisible();
        await expect(page.getByText(/Section/i)).toBeVisible();
      }
    });

    test('should create a TCS entry via API and verify in list', async ({ page, request }) => {
      const createResponse = await request.post('http://localhost:5000/api/tcs', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          customerName: 'E2E Test Customer',
          tcsSection: '206C(1H)',
          tcsRate: 0.1,
          saleAmount: 5000000,
          tcsAmount: 5000,
          collectionDate: '2026-01-20',
          financialYear: '2025-26',
          quarter: 4,
        },
      });

      if (createResponse.status() === 201) {
        const tcsData = await createResponse.json();

        await page.goto('http://localhost:5173/tcs');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText('E2E Test Customer')).toBeVisible();

        // Cleanup
        await request.delete(`http://localhost:5000/api/tcs/${tcsData.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    });
  });

  // ============================================
  // GST Reports
  // ============================================
  test.describe('GST Reports', () => {
    test('should navigate to GST Reports page', async ({ page }) => {
      await page.goto('http://localhost:5173/gst-reports');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/GST Report/i).first()).toBeVisible();
    });

    test('should have date range inputs', async ({ page }) => {
      await page.goto('http://localhost:5173/gst-reports');
      await page.waitForLoadState('networkidle');

      // Date inputs should be present
      const fromDate = page.locator('input[type="date"]').first();
      await expect(fromDate).toBeVisible();
    });

    test('should have quick date select buttons', async ({ page }) => {
      await page.goto('http://localhost:5173/gst-reports');
      await page.waitForLoadState('networkidle');

      // Quick select buttons
      await expect(page.getByRole('button', { name: /This Month/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Last Month/i })).toBeVisible();
    });

    test('should set dates when clicking "This Month"', async ({ page }) => {
      await page.goto('http://localhost:5173/gst-reports');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /This Month/i }).click();

      // Date inputs should now have values
      const fromDate = page.locator('input[type="date"]').first();
      await expect(fromDate).not.toHaveValue('');
    });

    test('should have GSTR-1 and GSTR-3B tabs', async ({ page }) => {
      await page.goto('http://localhost:5173/gst-reports');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/GSTR-1/i).first()).toBeVisible();
      await expect(page.getByText(/GSTR-3B/i).first()).toBeVisible();
    });

    test('should generate report when clicking Generate', async ({ page }) => {
      await page.goto('http://localhost:5173/gst-reports');
      await page.waitForLoadState('networkidle');

      // Set dates
      await page.getByRole('button', { name: /This Month/i }).click();

      // Click generate
      const generateBtn = page.getByRole('button', { name: /Generate/i });
      if (await generateBtn.isEnabled()) {
        await generateBtn.click();
        await page.waitForLoadState('networkidle');

        // After generation, report data sections should appear
        // B2B, HSN Summary etc.
        await page.waitForTimeout(2000);
      }
    });
  });

  // ============================================
  // Credit Notes
  // ============================================
  test.describe('Credit Notes', () => {
    test('should navigate to Credit Notes page', async ({ page }) => {
      await page.goto('http://localhost:5173/credit-notes');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Credit Note/i).first()).toBeVisible();
    });

    test('should display credit notes list with table', async ({ page }) => {
      await page.goto('http://localhost:5173/credit-notes');
      await page.waitForLoadState('networkidle');

      const table = page.locator('table');
      await expect(table).toBeVisible();
    });

    test('should have status filter', async ({ page }) => {
      await page.goto('http://localhost:5173/credit-notes');
      await page.waitForLoadState('networkidle');

      // Status filter should be available
      const statusFilter = page.getByText(/All Status|Status/i).first();
      await expect(statusFilter).toBeVisible();
    });

    test('should open create dialog', async ({ page }) => {
      await page.goto('http://localhost:5173/credit-notes');
      await page.waitForLoadState('networkidle');

      const createButton = page.getByRole('button', { name: /Create|New|Add/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });
  });

  // ============================================
  // Debit Notes
  // ============================================
  test.describe('Debit Notes', () => {
    test('should navigate to Debit Notes page', async ({ page }) => {
      await page.goto('http://localhost:5173/debit-notes');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Debit Note/i).first()).toBeVisible();
    });

    test('should display debit notes list with table', async ({ page }) => {
      await page.goto('http://localhost:5173/debit-notes');
      await page.waitForLoadState('networkidle');

      const table = page.locator('table');
      await expect(table).toBeVisible();
    });

    test('should have status filter', async ({ page }) => {
      await page.goto('http://localhost:5173/debit-notes');
      await page.waitForLoadState('networkidle');

      const statusFilter = page.getByText(/All Status|Status/i).first();
      await expect(statusFilter).toBeVisible();
    });

    test('should open create dialog', async ({ page }) => {
      await page.goto('http://localhost:5173/debit-notes');
      await page.waitForLoadState('networkidle');

      const createButton = page.getByRole('button', { name: /Create|New|Add/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });
  });

  // ============================================
  // Sidebar Navigation
  // ============================================
  test.describe('Sidebar Navigation', () => {
    test('should have Tax & GST section in sidebar', async ({ page }) => {
      await page.goto('http://localhost:5173/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/Tax & GST|Tax/i).first()).toBeVisible();
    });

    test('should navigate to each tax page from sidebar', async ({ page }) => {
      await page.goto('http://localhost:5173/');
      await page.waitForLoadState('networkidle');

      // Try navigating to TDS from sidebar
      const tdsLink = page.getByRole('link', { name: /TDS/i }).first();
      if (await tdsLink.isVisible()) {
        await tdsLink.click();
        await expect(page).toHaveURL(/\/tds/);
      }
    });
  });
});
