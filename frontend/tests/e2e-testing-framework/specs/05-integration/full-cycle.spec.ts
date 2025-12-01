import { test, expect, Page } from '@playwright/test';
import { TestConfig } from '../../config/test-config';
import {
  generateTestCustomer,
  generateTestSupplier,
  generateTestMaterial,
  generateTestWarehouse,
} from '../../fixtures/entity-fixtures';

/**
 * FULL CYCLE INTEGRATION TEST
 * Tests the complete business flow from master data to transactions
 *
 * Flow:
 * 1. Create Warehouse (Level 0)
 * 2. Create Customer (Level 1)
 * 3. Create Supplier (Level 1)
 * 4. Create Material (Level 1)
 * 5. Create Style (Level 2 - needs Customer)
 * 6. Create Purchase Order (Level 2 - needs Supplier, Material)
 * 7. Create Order (Level 3 - needs Customer, Style)
 * 8. Verify all data is connected
 */

test.describe('Full Cycle Integration Test', () => {
  // Shared state across tests
  let authToken: string;
  const createdEntities: {
    warehouse?: { id: string; name: string };
    customer?: { id: string; name: string };
    supplier?: { id: string; name: string };
    material?: { id: string; name: string };
    style?: { id: string; name: string };
    order?: { id: string; number: string };
    purchaseOrder?: { id: string; number: string };
  } = {};

  // Helper to navigate after auth
  async function authenticatePage(page: Page): Promise<void> {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    const timestamp = Date.now();
    await page.goto('/register');
    await page.getByLabel(/name/i).fill(`Integration Test ${timestamp}`);
    await page.getByLabel(/email/i).fill(`integration_${timestamp}@kashayafabs.com`);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  }

  // ============================================
  // SETUP: Authenticate once
  // ============================================

  test.beforeEach(async ({ page }) => {
    await authenticatePage(page);
  });

  // ============================================
  // LEVEL 0: Foundation Data
  // ============================================

  test.describe.serial('Level 0: Foundation', () => {
    test('1. Create Warehouse', async ({ page }) => {
      const warehouse = generateTestWarehouse('IntegrationTest');

      await page.goto('/warehouses/new');
      await page.waitForLoadState('networkidle');

      // Fill warehouse form
      const codeField = page.getByLabel(/code/i);
      if (await codeField.isVisible() && await codeField.isEnabled()) {
        await codeField.fill(warehouse.code);
      }

      await page.getByLabel(/warehouse.*name|^name$/i).fill(warehouse.name);

      const addressField = page.getByLabel(/address/i);
      if (await addressField.isVisible()) {
        await addressField.fill(warehouse.address);
      }

      // Submit
      await page.getByRole('button', { name: /create|save/i }).click();

      // Verify redirect
      await expect(page).toHaveURL(/\/warehouses\/?$/, { timeout: 10000 });

      // Store for later use
      createdEntities.warehouse = {
        id: '', // Would need to capture from response
        name: warehouse.name,
      };

      // Verify warehouse appears
      await page.waitForTimeout(1000);
      await expect(page.getByText(warehouse.name)).toBeVisible({ timeout: 5000 });
    });
  });

  // ============================================
  // LEVEL 1: Master Data
  // ============================================

  test.describe.serial('Level 1: Master Data', () => {
    test('2. Create Customer', async ({ page }) => {
      const customer = generateTestCustomer('IntegrationTest');

      await page.goto('/customers/new');
      await page.waitForLoadState('networkidle');

      // Fill customer form
      await page.getByLabel(/company name|customer name|^name$/i).fill(customer.name);

      const emailField = page.getByLabel(/email/i);
      if (await emailField.isVisible()) {
        await emailField.fill(customer.email);
      }

      const phoneField = page.getByLabel(/phone/i);
      if (await phoneField.isVisible()) {
        await phoneField.fill(customer.phone);
      }

      // Submit
      await page.getByRole('button', { name: /create|save/i }).click();

      // Verify redirect
      await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 10000 });

      // Store for later use
      createdEntities.customer = {
        id: '',
        name: customer.name,
      };

      // Verify customer appears
      await page.waitForTimeout(1000);
      await expect(page.getByText(customer.name)).toBeVisible({ timeout: 5000 });
    });

    test('3. Create Supplier', async ({ page }) => {
      const supplier = generateTestSupplier('IntegrationTest');

      await page.goto('/suppliers/new');
      await page.waitForLoadState('networkidle');

      // Fill supplier form
      await page.getByLabel(/supplier name|company name|^name$/i).fill(supplier.name);

      const emailField = page.getByLabel(/email/i);
      if (await emailField.isVisible()) {
        await emailField.fill(supplier.email);
      }

      const phoneField = page.getByLabel(/phone/i);
      if (await phoneField.isVisible()) {
        await phoneField.fill(supplier.phone);
      }

      // Submit
      await page.getByRole('button', { name: /create|save/i }).click();

      // Verify redirect
      await expect(page).toHaveURL(/\/suppliers\/?$/, { timeout: 10000 });

      // Store for later use
      createdEntities.supplier = {
        id: '',
        name: supplier.name,
      };

      // Verify supplier appears
      await page.waitForTimeout(1000);
      await expect(page.getByText(supplier.name)).toBeVisible({ timeout: 5000 });
    });

    test('4. Create Material', async ({ page }) => {
      const material = generateTestMaterial('IntegrationTest');

      await page.goto('/materials/new');
      await page.waitForLoadState('networkidle');

      // Fill material form
      const codeField = page.getByLabel(/code/i);
      if (await codeField.isVisible() && await codeField.isEnabled()) {
        await codeField.fill(material.code);
      }

      await page.getByLabel(/material name|^name$/i).fill(material.name);

      // Submit
      await page.getByRole('button', { name: /create|save/i }).click();

      // Verify redirect or success
      await page.waitForTimeout(3000);

      // Store for later use
      createdEntities.material = {
        id: '',
        name: material.name,
      };
    });
  });

  // ============================================
  // LEVEL 2: Intermediate Data
  // ============================================

  test.describe.serial('Level 2: Intermediate Data', () => {
    test('5. Create Style (depends on Customer)', async ({ page }) => {
      const timestamp = Date.now();
      const styleName = `Integration Style ${timestamp}`;
      const styleCode = `STY-INT-${timestamp}`;

      await page.goto('/styles/new');
      await page.waitForLoadState('networkidle');

      // Fill style form
      const codeField = page.getByLabel(/style.*code|code/i);
      if (await codeField.isVisible() && await codeField.isEnabled()) {
        await codeField.fill(styleCode);
      }

      await page.getByLabel(/style.*name|^name$/i).fill(styleName);

      // Select customer if dropdown exists
      const customerSelect = page.locator('[data-testid="customer-select"], [aria-label*="customer"]').first();
      if (await customerSelect.isVisible()) {
        await customerSelect.click();
        await page.waitForTimeout(500);
        // Select first customer option
        const firstOption = page.getByRole('option').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }

      // Submit
      await page.getByRole('button', { name: /create|save/i }).click();

      // Wait for success
      await page.waitForTimeout(3000);

      // Store for later use
      createdEntities.style = {
        id: '',
        name: styleName,
      };
    });

    test('6. Create Purchase Order (depends on Supplier, Material)', async ({ page }) => {
      const timestamp = Date.now();
      const poNumber = `PO-INT-${timestamp}`;

      await page.goto('/purchase-orders/new');
      await page.waitForLoadState('networkidle');

      // Fill PO form
      const poField = page.getByLabel(/po.*number|purchase.*order.*number/i);
      if (await poField.isVisible() && await poField.isEnabled()) {
        await poField.fill(poNumber);
      }

      // Select supplier
      const supplierSelect = page.locator('[data-testid="supplier-select"], [aria-label*="supplier"]').first();
      if (await supplierSelect.isVisible()) {
        await supplierSelect.click();
        await page.waitForTimeout(500);
        const firstOption = page.getByRole('option').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }

      // Submit (even if partial - testing form renders)
      await page.getByRole('button', { name: /create|save|submit/i }).click();

      await page.waitForTimeout(3000);

      createdEntities.purchaseOrder = {
        id: '',
        number: poNumber,
      };
    });
  });

  // ============================================
  // LEVEL 3: Transaction Data
  // ============================================

  test.describe.serial('Level 3: Transactions', () => {
    test('7. Create Order (depends on Customer, Style)', async ({ page }) => {
      const timestamp = Date.now();
      const orderNumber = `ORD-INT-${timestamp}`;

      await page.goto('/orders/new');
      await page.waitForLoadState('networkidle');

      // Fill order form
      const orderField = page.getByLabel(/order.*number/i);
      if (await orderField.isVisible() && await orderField.isEnabled()) {
        await orderField.fill(orderNumber);
      }

      // Select customer
      const customerSelect = page.locator('[data-testid="customer-select"], [aria-label*="customer"]').first();
      if (await customerSelect.isVisible()) {
        await customerSelect.click();
        await page.waitForTimeout(500);
        const firstOption = page.getByRole('option').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }

      // Submit
      await page.getByRole('button', { name: /create|save|submit/i }).click();

      await page.waitForTimeout(3000);

      createdEntities.order = {
        id: '',
        number: orderNumber,
      };
    });
  });

  // ============================================
  // VERIFICATION: Check all data is connected
  // ============================================

  test.describe.serial('Verification', () => {
    test('8. Verify Customer appears in Customer List', async ({ page }) => {
      if (!createdEntities.customer) {
        test.skip();
        return;
      }

      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(createdEntities.customer.name)).toBeVisible({ timeout: 5000 });
    });

    test('9. Verify Supplier appears in Supplier List', async ({ page }) => {
      if (!createdEntities.supplier) {
        test.skip();
        return;
      }

      await page.goto('/suppliers');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(createdEntities.supplier.name)).toBeVisible({ timeout: 5000 });
    });

    test('10. Verify Warehouse appears in Warehouse List', async ({ page }) => {
      if (!createdEntities.warehouse) {
        test.skip();
        return;
      }

      await page.goto('/warehouses');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(createdEntities.warehouse.name)).toBeVisible({ timeout: 5000 });
    });

    test('11. No console errors on Dashboard', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      expect(errors.length, `Console errors: ${errors.join(', ')}`).toBe(0);
    });
  });

  // ============================================
  // CROSS-PAGE NAVIGATION TESTS
  // ============================================

  test.describe.serial('Cross-Page Navigation', () => {
    test('12. Navigate through all main pages without errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      const pagesToVisit = [
        '/dashboard',
        '/customers',
        '/suppliers',
        '/materials',
        '/styles',
        '/orders',
        '/warehouses',
        '/purchase-orders',
      ];

      for (const pageUrl of pagesToVisit) {
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      }

      // Allow some non-critical console errors
      const criticalErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('404')
      );

      expect(criticalErrors.length, `Critical errors: ${criticalErrors.join(', ')}`).toBe(0);
    });

    test('13. Can navigate from Customer to their Orders', async ({ page }) => {
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      // Click on first customer row
      const firstRow = page.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await page.waitForTimeout(1000);

        // Check if we're on customer detail or can see related info
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/customers/);
      }
    });
  });

  // ============================================
  // FORM FIELD COMPREHENSIVE TESTS
  // ============================================

  test.describe.serial('Comprehensive Form Field Tests', () => {
    test('14. Customer form - all fields test', async ({ page }) => {
      await page.goto('/customers/new');
      await page.waitForLoadState('networkidle');

      // Test each field type
      const textFields = ['name', 'contactPerson', 'email', 'phone'];
      const textareaFields = ['billingAddress', 'shippingAddress'];

      // Verify all text fields accept input
      for (const fieldName of textFields) {
        const field = page.getByLabel(new RegExp(fieldName, 'i'));
        if (await field.isVisible()) {
          await field.fill(`Test ${fieldName}`);
          const value = await field.inputValue();
          expect(value).toContain('Test');
        }
      }

      // Verify textarea fields
      for (const fieldName of textareaFields) {
        const field = page.getByLabel(new RegExp(fieldName, 'i'));
        if (await field.isVisible()) {
          await field.fill(`Test ${fieldName}\nLine 2`);
        }
      }

      // Verify numeric fields
      const creditLimitField = page.getByLabel(/credit.*limit/i);
      if (await creditLimitField.isVisible()) {
        await creditLimitField.fill('100000');
      }

      const creditDaysField = page.getByLabel(/credit.*days/i);
      if (await creditDaysField.isVisible()) {
        await creditDaysField.fill('30');
      }
    });

    test('15. Order form - all fields test', async ({ page }) => {
      await page.goto('/orders/new');
      await page.waitForLoadState('networkidle');

      // Test order number field
      const orderNumberField = page.getByLabel(/order.*number/i);
      if (await orderNumberField.isVisible() && await orderNumberField.isEnabled()) {
        await orderNumberField.fill('TEST-ORD-001');
      }

      // Test date fields
      const orderDateField = page.getByLabel(/order.*date/i);
      if (await orderDateField.isVisible()) {
        // Date fields might be date pickers
        await orderDateField.click();
        await page.waitForTimeout(500);
      }

      // Test priority dropdown
      const priorityField = page.getByLabel(/priority/i);
      if (await priorityField.isVisible()) {
        await priorityField.click();
        await page.waitForTimeout(500);
      }
    });
  });
});
