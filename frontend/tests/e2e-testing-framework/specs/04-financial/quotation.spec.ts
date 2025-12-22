import { test, expect } from '@playwright/test';

/**
 * LEVEL 4: Quotation Management Tests
 * Dependencies: Customers, Styles
 *
 * Tests:
 * - Quotation list page
 * - Create quotation form with multi-item support
 * - Quotation detail page
 * - Status update workflows (DRAFT → SENT → ACCEPTED/REJECTED)
 * - Summary statistics
 * - Search and filters
 */

test.describe('Level 4: Quotation Management', () => {
  let authToken: string;
  let customerId: string;
  let styleId: string;

  // Authenticate and setup test data
  test.beforeAll(async ({ request }) => {
    // Register and login
    const timestamp = Date.now();
    const email = `quotation_test_${timestamp}@kashayafabs.com`;

    await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Quotation Tester',
        email,
        password: 'Test@123',
      },
    });

    const loginResponse = await request.post('http://localhost:5000/api/auth/login', {
      data: { email, password: 'Test@123' },
    });

    const loginData = await loginResponse.json();
    authToken = loginData.token;

    // Create test customer
    const customerResponse = await request.post('http://localhost:5000/api/customers', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        code: `CUST-${timestamp}`,
        name: `Test Customer ${timestamp}`,
        billingName: `Test Billing ${timestamp}`,
        type: 'BUYER',
        category: 'DOMESTIC',
        email: `customer${timestamp}@test.com`,
        phone: '9876543210',
      },
    });

    const customerData = await customerResponse.json();
    if (!customerData.data) {
      console.error('Customer creation failed:', customerData);
      throw new Error(`Failed to create customer: ${JSON.stringify(customerData)}`);
    }
    customerId = customerData.data.id;

    // Create test style
    const styleResponse = await request.post('http://localhost:5000/api/styles', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        styleCode: `STY-${timestamp}`,
        styleName: `Test Style ${timestamp}`,
        description: 'Test style for quotation',
      },
    });

    const styleData = await styleResponse.json();
    styleId = styleData.data.id;
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);
  });

  // ============================================
  // LIST PAGE TESTS
  // ============================================

  test.describe('Quotation List Page', () => {
    test('page loads and displays correctly', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      // Verify page elements
      await expect(page.getByText('Quotations').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /new quotation/i })).toBeVisible();
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();

      // Verify summary cards
      await expect(page.getByText('Total')).toBeVisible();
      await expect(page.getByText('Draft')).toBeVisible();
      await expect(page.getByText('Sent')).toBeVisible();
      await expect(page.getByText('Accepted')).toBeVisible();
      await expect(page.getByText('Rejected')).toBeVisible();
    });

    test('create button navigates to form', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /new quotation/i }).click();
      await expect(page).toHaveURL(/\/quotations\/new/);
    });

    test('filter by customer works', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      // Open customer filter
      const customerFilter = page.locator('select, [role="combobox"]').filter({ hasText: /all customers/i }).first();
      if (await customerFilter.isVisible()) {
        await customerFilter.click();
      }
    });

    test('filter by status works', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      // Open status filter
      const statusFilter = page.locator('select, [role="combobox"]').filter({ hasText: /all statuses/i }).first();
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
      }
    });

    test('no console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      expect(errors.length, `Console errors: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ============================================
  // CREATE FORM TESTS
  // ============================================

  test.describe('Create Quotation Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/quotations/new');
      await page.waitForLoadState('networkidle');
    });

    test('form fields are rendered', async ({ page }) => {
      // Check required fields
      await expect(page.getByLabel(/customer/i).first()).toBeVisible();
      await expect(page.getByLabel(/quotation date/i)).toBeVisible();
      await expect(page.getByLabel(/valid until/i)).toBeVisible();
      await expect(page.getByLabel(/remarks/i)).toBeVisible();
      await expect(page.getByLabel(/terms and conditions/i)).toBeVisible();

      // Check item fields
      await expect(page.getByText('Quotation Items')).toBeVisible();
      await expect(page.getByRole('button', { name: /add item/i })).toBeVisible();
    });

    test('can add and remove items', async ({ page }) => {
      // Initially should have 1 item
      await expect(page.getByText('Item 1')).toBeVisible();

      // Add second item
      await page.getByRole('button', { name: /add item/i }).click();
      await expect(page.getByText('Item 2')).toBeVisible();

      // Add third item
      await page.getByRole('button', { name: /add item/i }).click();
      await expect(page.getByText('Item 3')).toBeVisible();

      // Remove second item
      const removeButtons = page.getByRole('button').filter({ has: page.locator('svg') });
      await removeButtons.nth(1).click();

      // Should still have 2 items
      await expect(page.getByText('Item 1')).toBeVisible();
      await expect(page.getByText('Item 2')).toBeVisible();
    });

    test('can create quotation successfully', async ({ page }) => {
      // Select customer
      await page.getByLabel(/customer/i).first().click();
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Fill valid until date (30 days from now)
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      await page.getByLabel(/valid until/i).fill(validUntil.toISOString().split('T')[0]);

      // Fill first item
      const styleSelects = page.locator('[role="combobox"]').filter({ hasText: /select style/i });
      await styleSelects.first().click();
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Fill quantity and price
      const quantityInputs = page.getByLabel(/quantity/i);
      await quantityInputs.first().fill('1000');

      const priceInputs = page.getByLabel(/unit price/i);
      await priceInputs.first().fill('250');

      // Fill delivery days
      const deliveryInputs = page.getByLabel(/delivery days/i);
      await deliveryInputs.first().fill('45');

      // Fill remarks
      await page.getByLabel(/remarks/i).first().fill('Test quotation for E2E testing');

      // Fill terms and conditions
      await page.getByLabel(/terms and conditions/i).fill('Payment: 30 days from invoice date');

      // Submit
      await page.getByRole('button', { name: /create quotation/i }).click();

      // Wait for navigation to quotation list
      await expect(page).toHaveURL(/\/quotations$/, { timeout: 10000 });

      // Verify success message
      await expect(page.getByText(/quotation.*created.*successfully/i)).toBeVisible({ timeout: 5000 });
    });

    test('validation works for required fields', async ({ page }) => {
      // Try to submit without filling required fields
      await page.getByRole('button', { name: /create quotation/i }).click();

      // Should not navigate away
      await expect(page).toHaveURL(/\/quotations\/new/);
    });

    test('total amount auto-calculates', async ({ page }) => {
      // Fill quantity and price for first item
      const quantityInputs = page.getByLabel(/quantity/i);
      await quantityInputs.first().fill('500');

      const priceInputs = page.getByLabel(/unit price/i);
      await priceInputs.first().fill('100');

      // Check if total is calculated
      await expect(page.getByText(/₹50,000\.00/)).toBeVisible({ timeout: 2000 });
    });

    test('multi-item quotation calculates correct total', async ({ page }) => {
      // Add second item
      await page.getByRole('button', { name: /add item/i }).click();

      // Fill first item
      const quantityInputs = page.getByLabel(/quantity/i);
      await quantityInputs.nth(0).fill('100');

      const priceInputs = page.getByLabel(/unit price/i);
      await priceInputs.nth(0).fill('500');

      // Fill second item
      await quantityInputs.nth(1).fill('200');
      await priceInputs.nth(1).fill('300');

      // Total should be (100 * 500) + (200 * 300) = 50,000 + 60,000 = 110,000
      await expect(page.getByText(/₹1,10,000\.00/)).toBeVisible({ timeout: 2000 });
    });
  });

  // ============================================
  // DETAIL PAGE TESTS
  // ============================================

  test.describe('Quotation Detail Page', () => {
    let quotationId: string;

    test.beforeAll(async ({ request }) => {
      // Create test quotation
      const response = await request.post('http://localhost:5000/api/quotations', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          customerId,
          quotationDate: new Date().toISOString(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          remarks: 'Test quotation for detail page',
          termsAndConditions: 'Payment: 30 days from invoice date\nDelivery: FOB',
          items: [
            {
              styleId,
              description: 'Premium quality garment',
              totalQuantity: 1000,
              unitPrice: 250,
              deliveryDays: 45,
              remarks: 'First production run',
            },
          ],
        },
      });

      const data = await response.json();
      if (!data.data) {
        console.error('Quotation creation failed:', data);
        throw new Error(`Failed to create quotation: ${JSON.stringify(data)}`);
      }
      quotationId = data.data.id;
    });

    test('detail page displays quotation information', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Verify quotation details are visible
      await expect(page.getByText(/QT-/)).toBeVisible(); // Quotation number
      await expect(page.getByText(/Total Amount/i)).toBeVisible();
      await expect(page.getByText(/Total Items/i)).toBeVisible();

      // Verify customer information
      await expect(page.getByText(/Customer Information/i)).toBeVisible();

      // Verify quotation items
      await expect(page.getByText(/Quotation Items/i)).toBeVisible();
    });

    test('status badge is displayed correctly', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Should show DRAFT status initially
      await expect(page.getByText('Draft')).toBeVisible();
    });

    test('can mark quotation as sent', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Click Mark as Sent button
      await page.getByRole('button', { name: /mark as sent/i }).click();

      // Wait for confirmation dialog
      await expect(page.getByText(/Update Quotation Status/i)).toBeVisible();

      // Confirm status update
      await page.getByRole('button', { name: /^update status$/i }).click();

      // Wait for success message
      await expect(page.getByText(/status.*updated.*successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify status is updated
      await page.waitForTimeout(2000);
      await expect(page.getByText('Sent')).toBeVisible();
    });

    test('sent quotation shows accept/reject buttons', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Should show Accept and Reject buttons
      await expect(page.getByRole('button', { name: /accept/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
    });

    test('can accept quotation', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Click Accept button
      await page.getByRole('button', { name: /accept/i }).click();

      // Wait for confirmation dialog
      await expect(page.getByText(/Update Quotation Status/i)).toBeVisible();

      // Confirm status update
      await page.getByRole('button', { name: /^update status$/i }).click();

      // Wait for success message
      await expect(page.getByText(/status.*updated.*successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify status is updated
      await page.waitForTimeout(2000);
      await expect(page.getByText('Accepted')).toBeVisible();
    });

    test('accepted quotation hides action buttons', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Should NOT show Mark as Sent, Accept, or Reject buttons
      await expect(page.getByRole('button', { name: /mark as sent/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /accept/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /reject/i })).not.toBeVisible();
    });

    test('quotation items display correctly', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Verify item details
      await expect(page.getByText(/Item 1:/)).toBeVisible();
      await expect(page.getByText(/1,000 pcs/)).toBeVisible();
      await expect(page.getByText(/₹250\.00/)).toBeVisible(); // Unit price
      await expect(page.getByText(/₹2,50,000\.00/)).toBeVisible(); // Total price
      await expect(page.getByText(/45 days/)).toBeVisible(); // Delivery days
    });

    test('terms and conditions display correctly', async ({ page }) => {
      await page.goto(`/quotations/${quotationId}`);
      await page.waitForLoadState('networkidle');

      // Verify terms and conditions
      await expect(page.getByText(/Payment: 30 days from invoice date/)).toBeVisible();
    });
  });

  // ============================================
  // SEARCH AND FILTER TESTS
  // ============================================

  test.describe('Search and Filters', () => {
    test('search by quotation number works', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      // Type in search
      await page.getByPlaceholder(/search/i).fill('QT-');
      await page.waitForTimeout(1000);

      // Results should filter
      // This is a basic check - actual results depend on data
    });

    test('customer filter works', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      // Open customer filter dropdown
      const customerFilter = page.locator('select, [role="combobox"]').filter({ hasText: /all customers/i }).first();
      if (await customerFilter.isVisible()) {
        await customerFilter.click();
        await page.waitForTimeout(500);

        // Should show customer options
        const options = page.locator('[role="option"]');
        const count = await options.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('status filter works', async ({ page }) => {
      await page.goto('/quotations');
      await page.waitForLoadState('networkidle');

      // Open status filter dropdown
      const statusFilter = page.locator('select, [role="combobox"]').filter({ hasText: /all statuses/i }).first();
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.waitForTimeout(500);

        // Should show status options
        await expect(page.getByText('Draft', { exact: true })).toBeVisible();
        await expect(page.getByText('Sent', { exact: true })).toBeVisible();
        await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
        await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
      }
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================

  test.describe('Delete Quotation', () => {
    let draftQuotationId: string;

    test.beforeAll(async ({ request }) => {
      // Create a draft quotation for deletion test
      const response = await request.post('http://localhost:5000/api/quotations', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          customerId,
          quotationDate: new Date().toISOString(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          remarks: 'Test quotation for deletion',
          items: [
            {
              styleId,
              totalQuantity: 100,
              unitPrice: 100,
            },
          ],
        },
      });

      const data = await response.json();
      if (!data.data) {
        console.error('Draft quotation creation failed:', data);
        throw new Error(`Failed to create draft quotation: ${JSON.stringify(data)}`);
      }
      draftQuotationId = data.data.id;
    });

    test('can delete draft quotation', async ({ page }) => {
      await page.goto(`/quotations/${draftQuotationId}`);
      await page.waitForLoadState('networkidle');

      // Click delete button
      await page.getByRole('button', { name: /delete/i }).click();

      // Wait for confirmation dialog
      await expect(page.getByText(/Are you sure you want to delete/i)).toBeVisible();

      // Confirm deletion
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Should navigate to list page
      await expect(page).toHaveURL(/\/quotations$/, { timeout: 10000 });

      // Verify success message
      await expect(page.getByText(/quotation.*deleted.*successfully/i)).toBeVisible({ timeout: 5000 });
    });
  });

  // ============================================
  // EDIT TESTS
  // ============================================

  test.describe('Edit Quotation', () => {
    let editQuotationId: string;

    test.beforeAll(async ({ request }) => {
      // Create a draft quotation for edit test
      const response = await request.post('http://localhost:5000/api/quotations', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          customerId,
          quotationDate: new Date().toISOString(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          remarks: 'Original remarks',
          items: [
            {
              styleId,
              totalQuantity: 500,
              unitPrice: 200,
            },
          ],
        },
      });

      const data = await response.json();
      if (!data.data) {
        console.error('Edit quotation creation failed:', data);
        throw new Error(`Failed to create quotation for editing: ${JSON.stringify(data)}`);
      }
      editQuotationId = data.data.id;
    });

    test('can navigate to edit form', async ({ page }) => {
      await page.goto(`/quotations/${editQuotationId}`);
      await page.waitForLoadState('networkidle');

      // Click edit button
      await page.getByRole('button', { name: /edit/i }).click();

      // Should navigate to edit page
      await expect(page).toHaveURL(new RegExp(`/quotations/${editQuotationId}/edit`));
    });

    test('edit form pre-fills with existing data', async ({ page }) => {
      await page.goto(`/quotations/${editQuotationId}/edit`);
      await page.waitForLoadState('networkidle');

      // Verify remarks are pre-filled
      const remarksField = page.getByLabel(/remarks/i).first();
      await expect(remarksField).toHaveValue('Original remarks');

      // Verify quantity is pre-filled
      const quantityInput = page.getByLabel(/quantity/i).first();
      await expect(quantityInput).toHaveValue('500');

      // Verify price is pre-filled
      const priceInput = page.getByLabel(/unit price/i).first();
      await expect(priceInput).toHaveValue('200');
    });
  });
});
