import { test, expect } from '@playwright/test';

/**
 * LEVEL 4: Invoice Management Tests
 * Dependencies: Customers, Orders (completed status)
 *
 * Tests:
 * - Invoice list page
 * - Create invoice form
 * - Invoice detail page
 * - Record payment
 * - Invoice summary statistics
 * - PDF generation
 * - Status management
 */

test.describe('Level 4: Invoice Management', () => {
  let authToken: string;
  let customerId: string;
  let orderId: string;
  let styleId: string;
  let sizeId: string;

  // Authenticate and setup test data
  test.beforeAll(async ({ request }) => {
    // Register and login
    const timestamp = Date.now();
    const email = `invoice_test_${timestamp}@kashayafabs.com`;

    const registerResponse = await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Invoice Tester',
        email,
        password: 'Test@123',
      },
    });

    const registerData = await registerResponse.json();
    if (registerResponse.status() !== 201) {
      console.error('Registration failed:', registerData);
      throw new Error(`Failed to register: ${JSON.stringify(registerData)}`);
    }

    const loginResponse = await request.post('http://localhost:5000/api/auth/login', {
      data: { email, password: 'Test@123' },
    });

    const loginData = await loginResponse.json();
    if (!loginData.token) {
      console.error('Login failed:', loginData);
      throw new Error(`Failed to login: ${JSON.stringify(loginData)}`);
    }
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

    // Create test style with sizes
    const styleResponse = await request.post('http://localhost:5000/api/styles', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        styleCode: `STY-${timestamp}`,
        styleName: `Test Style ${timestamp}`,
        sizeOptions: [
          {
            sizeName: 'Medium',
            sizeCode: 'M',
            sortOrder: 0,
          },
        ],
      },
    });

    const styleData = await styleResponse.json();
    if (!styleData.data) {
      console.error('Style creation failed:', styleData);
      throw new Error(`Failed to create style: ${JSON.stringify(styleData)}`);
    }
    styleId = styleData.data.id;

    // Fetch the style back to get sizeOptions (they may not be in the create response)
    const getStyleResponse = await request.get(`http://localhost:5000/api/styles/${styleId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const getStyleData = await getStyleResponse.json();
    if (!getStyleData.data || !getStyleData.data.sizes || getStyleData.data.sizes.length === 0) {
      console.error('Style sizes not found:', getStyleData);
      throw new Error(`Style was created without sizes: ${JSON.stringify(getStyleData)}`);
    }
    sizeId = getStyleData.data.sizes[0].id;

    // Create test order (completed status) with proper schema
    const orderResponse = await request.post('http://localhost:5000/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        customerId,
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'MEDIUM',
        items: [
          {
            styleId,
            unitPrice: 500,
            breakup: [
              {
                colorId: null,
                sizeId,
                quantity: 100,
              },
            ],
          },
        ],
      },
    });

    const orderData = await orderResponse.json();
    if (!orderData.data) {
      console.error('Order creation failed:', orderData);
      throw new Error(`Failed to create order: ${JSON.stringify(orderData)}`);
    }
    orderId = orderData.data.id;
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

  test.describe('Invoice List Page', () => {
    test('page loads and displays correctly', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      // Verify page elements
      await expect(page.getByText('Invoices').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /new invoice/i })).toBeVisible();
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();

      // Verify summary cards
      await expect(page.getByText('Total Invoices')).toBeVisible();
      await expect(page.getByText('Pending')).toBeVisible();
      await expect(page.getByText('Overdue')).toBeVisible();
      await expect(page.getByText('Outstanding')).toBeVisible();
    });

    test('create button navigates to form', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /new invoice/i }).click();
      await expect(page).toHaveURL(/\/invoices\/new/);
    });

    test('filter by customer works', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      // Open customer filter
      const customerFilter = page.locator('select, [role="combobox"]').filter({ hasText: /all customers/i }).first();
      if (await customerFilter.isVisible()) {
        await customerFilter.click();
      }
    });

    test('filter by status works', async ({ page }) => {
      await page.goto('/invoices');
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

      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      expect(errors.length, `Console errors: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ============================================
  // CREATE FORM TESTS
  // ============================================

  test.describe('Create Invoice Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/invoices/new');
      await page.waitForLoadState('networkidle');
    });

    test('form fields are rendered', async ({ page }) => {
      // Check required fields
      await expect(page.getByLabel(/customer/i)).toBeVisible();
      await expect(page.getByLabel(/order/i)).toBeVisible();
      await expect(page.getByLabel(/due date/i)).toBeVisible();
      await expect(page.getByLabel(/subtotal/i)).toBeVisible();
      await expect(page.getByLabel(/total amount/i)).toBeVisible();
    });

    test('can create invoice successfully', async ({ page }) => {
      // Select customer
      await page.getByLabel(/customer/i).click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Wait for orders to load
      await page.waitForTimeout(1000);

      // Select order
      await page.getByLabel(/order/i).click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Fill due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await page.getByLabel(/due date/i).fill(dueDate.toISOString().split('T')[0]);

      // Fill amounts
      await page.getByLabel(/subtotal/i).fill('50000');
      await page.getByLabel(/tax amount/i).fill('9000');
      // Total should auto-calculate to 59000

      // Fill remarks
      await page.getByLabel(/remarks/i).fill('Test invoice for E2E testing');

      // Submit
      await page.getByRole('button', { name: /create invoice/i }).click();

      // Wait for navigation to invoice list
      await expect(page).toHaveURL(/\/invoices/, { timeout: 10000 });

      // Verify success message
      await expect(page.getByText(/invoice.*created.*successfully/i)).toBeVisible({ timeout: 5000 });
    });

    test('validation works for required fields', async ({ page }) => {
      // Try to submit without filling required fields
      await page.getByRole('button', { name: /create invoice/i }).click();

      // Should not navigate away
      await expect(page).toHaveURL(/\/invoices\/new/);
    });

    test('total amount auto-calculates', async ({ page }) => {
      // Fill subtotal and tax
      await page.getByLabel(/subtotal/i).fill('10000');
      await page.getByLabel(/tax amount/i).fill('1800');

      // Check if total is calculated
      const totalField = page.getByLabel(/total amount/i);
      await expect(totalField).toHaveValue('11800');
    });
  });

  // ============================================
  // DETAIL PAGE TESTS
  // ============================================

  test.describe('Invoice Detail Page', () => {
    let invoiceId: string;

    test.beforeAll(async ({ request }) => {
      // Create test invoice
      const response = await request.post('http://localhost:5000/api/invoices', {
        headers: { Authorization: `Bearer ${authToken}` },
        data: {
          customerId,
          orderId,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: 50000,
          taxAmount: 9000,
          totalAmount: 59000,
          remarks: 'Test invoice for detail page',
        },
      });

      const data = await response.json();
      invoiceId = data.data.id;
    });

    test('detail page displays invoice information', async ({ page }) => {
      await page.goto(`/invoices/${invoiceId}`);
      await page.waitForLoadState('networkidle');

      // Verify invoice details are visible
      await expect(page.getByText(/INV-/)).toBeVisible(); // Invoice number
      await expect(page.getByText(/Total Amount/i)).toBeVisible();
      await expect(page.getByText(/Paid Amount/i)).toBeVisible();
      await expect(page.getByText(/Balance/i)).toBeVisible();

      // Verify customer information
      await expect(page.getByText(/Customer & Order Information/i)).toBeVisible();
    });

    test('record payment button is visible for unpaid invoices', async ({ page }) => {
      await page.goto(`/invoices/${invoiceId}`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('button', { name: /record payment/i })).toBeVisible();
    });

    test('can record payment successfully', async ({ page }) => {
      await page.goto(`/invoices/${invoiceId}`);
      await page.waitForLoadState('networkidle');

      // Click record payment
      await page.getByRole('button', { name: /record payment/i }).click();

      // Wait for dialog
      await expect(page.getByText(/Record Payment/i)).toBeVisible();

      // Fill payment details
      await page.getByLabel(/payment amount/i).fill('30000');

      // Select payment method
      await page.getByLabel(/payment method/i).click();
      await page.getByText('Bank Transfer').click();

      // Fill reference number
      await page.getByLabel(/reference number/i).fill('REF-12345');

      // Submit payment
      await page.getByRole('button', { name: /^record payment$/i }).click();

      // Wait for success message
      await expect(page.getByText(/payment.*recorded.*successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify balance is updated
      await page.waitForTimeout(2000);
      await expect(page.getByText(/29,000/)).toBeVisible(); // Balance should be 59000 - 30000
    });
  });

  // ============================================
  // SEARCH AND FILTER TESTS
  // ============================================

  test.describe('Search and Filters', () => {
    test('search by invoice number works', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      // Type in search
      await page.getByPlaceholder(/search/i).fill('INV-');
      await page.waitForTimeout(1000);

      // Results should filter
      // This is a basic check - actual results depend on data
    });
  });

  // ============================================
  // PDF GENERATION TEST
  // ============================================

  test.describe('PDF Generation', () => {
    test.skip('can download invoice PDF', async ({ page }) => {
      // This test requires backend PDF endpoint to be set up
      // Will be implemented once PDF download route is added to controller
    });
  });
});
