# End-to-End Testing Framework Guide

## Overview

This framework provides comprehensive E2E testing for the Garment ERP application with:
- **Dependency Management**: Tests run in the correct order based on data dependencies
- **Page Object Model**: Reusable page objects for all forms and lists
- **Field Validation**: Automatic testing of all form field types
- **API Helpers**: Fast data setup/teardown via direct API calls
- **Full Cycle Integration**: Tests that verify the complete business flow

## Directory Structure

```
frontend/tests/e2e-testing-framework/
├── README.md                     # Overview documentation
├── E2E_TESTING_GUIDE.md         # This guide
├── index.ts                      # Main exports
├── config/
│   └── test-config.ts           # Configuration, routes, timeouts
├── core/
│   ├── dependency-manager.ts    # Entity dependency management
│   ├── field-validator.ts       # Form field validation utilities
│   └── test-orchestrator.ts     # Test execution orchestration
├── fixtures/
│   └── entity-fixtures.ts       # Test data generators for all entities
├── helpers/
│   ├── api-helper.ts            # Direct API calls for setup
│   └── cleanup-helper.ts        # Test data cleanup
├── page-objects/
│   ├── base-page.ts             # Base page class
│   ├── form-page.ts             # Base form page class
│   ├── list-page.ts             # Base list page class
│   └── pages/
│       ├── index.ts             # Page factory exports
│       └── customer-pages.ts    # Customer-specific page objects
└── specs/
    ├── 01-foundation/           # Level 0: No dependencies
    │   └── auth.spec.ts
    ├── 02-masters/              # Level 1-2: Master data
    │   └── customer.spec.ts
    ├── 03-transactions/         # Level 3: Transaction data
    │   └── order.spec.ts
    └── 05-integration/          # Full cycle tests
        └── full-cycle.spec.ts
```

## Dependency Levels

The framework organizes tests by dependency level:

### Level 0: Foundation (No Dependencies)
- Authentication (`auth.spec.ts`)
- Warehouses
- Component Masters
- Financial Setup (Currencies, Tax, Payment Terms)

### Level 1: Basic Masters
- Customers (`customer.spec.ts`)
- Suppliers
- Materials
- Locations

### Level 2: Intermediate (Depends on Level 1)
- Styles → Customers, Component Masters
- Fabrics → Materials, Suppliers
- Greige → Materials, Suppliers
- Purchase Orders → Suppliers, Materials

### Level 3: Complex (Depends on Level 2)
- Bill of Materials → Styles, Materials
- Orders → Customers, Styles
- GRN → Purchase Orders
- Cost Sheets → Styles, BOMs

### Level 4: Highest Level (Depends on Level 3)
- Work Orders → Orders, Locations
- Stock Movements → Materials, Warehouses
- Invoices → Orders

## Running Tests

### NPM Scripts

```bash
# Run all E2E tests (existing)
npm run test:e2e

# Run framework tests by level
npm run test:e2e:foundation    # Level 0 tests
npm run test:e2e:masters       # Level 1-2 tests
npm run test:e2e:transactions  # Level 3 tests
npm run test:e2e:integration   # Full cycle tests

# Run all levels in dependency order (sequential)
npm run test:e2e:all-levels

# Run with UI
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### CLI Options

```bash
# Run specific test file
npx playwright test tests/e2e-testing-framework/specs/02-masters/customer.spec.ts

# Run with specific browser
npx playwright test --project=chromium

# Run in headed mode
npx playwright test --headed

# Run with UI
npx playwright test --ui

# Generate report
npx playwright test --reporter=html
```

## Test Types

### 1. Page Load Tests
Verify that pages load without errors:
```typescript
test('page loads correctly', async ({ page }) => {
  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Customers')).toBeVisible();
});
```

### 2. Form Field Tests
Test all form fields for rendering and validation:
```typescript
test('all form fields are rendered', async ({ page }) => {
  await page.goto('/customers/new');
  await expect(page.getByLabel(/name/i)).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/phone/i)).toBeVisible();
});
```

### 3. Validation Tests
Verify form validation works correctly:
```typescript
test('email validation works', async ({ page }) => {
  await page.getByLabel(/email/i).fill('invalid-email');
  await page.keyboard.press('Tab');
  await expect(page.getByText(/invalid.*email/i)).toBeVisible();
});
```

### 4. CRUD Tests
Test Create, Read, Update, Delete operations:
```typescript
test('can create customer', async ({ page }) => {
  await page.goto('/customers/new');
  await page.getByLabel(/name/i).fill('Test Customer');
  await page.getByRole('button', { name: /create/i }).click();
  await expect(page).toHaveURL(/\/customers\/?$/);
});
```

### 5. Console Error Tests
Ensure no JavaScript errors on page:
```typescript
test('no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  expect(errors.length).toBe(0);
});
```

### 6. Integration Tests
Test complete business flows:
```typescript
test('full order flow', async ({ page }) => {
  // 1. Create customer
  // 2. Create style
  // 3. Create order with customer and style
  // 4. Verify order appears in list
});
```

## Using the Framework

### Creating Test Data

Use fixtures to generate consistent test data:

```typescript
import { generateTestCustomer, generateTestOrder } from '../fixtures/entity-fixtures';

test('create customer', async ({ page }) => {
  const customer = generateTestCustomer('MyTest');
  // customer.name = "MyTest Customer 1234567890"
  // customer.email = "customer1234567890@test.com"
  // ... all fields populated
});
```

### Using Page Objects

Page objects provide reusable page interactions:

```typescript
import { CustomerListPage, CustomerFormPage } from '../page-objects/pages';

test('customer workflow', async ({ page }) => {
  const listPage = new CustomerListPage(page);
  await listPage.goto();
  await listPage.clickCreate();

  const formPage = new CustomerFormPage(page);
  await formPage.fillField('name', 'Test Customer');
  await formPage.submit();
});
```

### API Helpers for Fast Setup

Use API helpers to create data quickly without UI interaction:

```typescript
import { createAPIHelper } from '../helpers/api-helper';

test.beforeAll(async ({ request }) => {
  const api = createAPIHelper(request);
  await api.register('setup@test.com', 'Setup User', 'Test@123');

  // Create dependencies via API
  await api.createCustomer({ name: 'Test Customer', ... });
  await api.createStyle({ name: 'Test Style', ... });
});
```

### Dependency Manager

Automatically manage entity dependencies:

```typescript
import { DependencyManager } from '../core/dependency-manager';

test('order with dependencies', async ({ page, request }) => {
  const manager = new DependencyManager(page);
  await manager.initialize(request, authToken);

  // This creates customer and style automatically
  const deps = await manager.setupDependencies('order');

  // Now create the order
  // ...

  // Cleanup in correct order
  await manager.cleanup();
});
```

## Field Validation Reference

The framework supports testing these field types:

| Field Type | Validation | Example |
|------------|------------|---------|
| TEXT | Required, min/max length | Name, Code |
| EMAIL | Email format | customer@test.com |
| PHONE | Max 20 chars, numeric | 9876543210 |
| GST | GST format regex | 22AAAAA0000A1Z5 |
| NUMBER | Integer, min/max | Credit Days (0-365) |
| DECIMAL | Decimal, min | Credit Limit |
| SELECT | Valid option | Category dropdown |
| DATE | Valid date | Order Date |
| TEXTAREA | Multi-line text | Address |
| FILE | File upload | Image upload |

## Best Practices

### 1. Test Independence
Each test should be independent and not rely on state from other tests:
```typescript
test.beforeEach(async ({ page }) => {
  // Clear state and re-authenticate
  await page.evaluate(() => localStorage.clear());
  await authenticatePage(page);
});
```

### 2. Use Serial Mode for Dependencies
When tests must run in order, use serial mode:
```typescript
test.describe.serial('Level 1: Master Data', () => {
  test('1. Create Customer', ...);
  test('2. Create Supplier', ...);
});
```

### 3. Wait for Network Idle
Always wait for network requests to complete:
```typescript
await page.goto('/customers');
await page.waitForLoadState('networkidle');
```

### 4. Use Flexible Selectors
Use regex for labels to handle variations:
```typescript
// Instead of exact match
page.getByLabel('Customer Name')

// Use flexible matching
page.getByLabel(/customer.*name|company.*name|^name$/i)
```

### 5. Handle Optional Fields
Check if fields exist before interacting:
```typescript
const emailField = page.getByLabel(/email/i);
if (await emailField.isVisible()) {
  await emailField.fill(customer.email);
}
```

### 6. Cleanup After Tests
Always clean up test data:
```typescript
test.afterAll(async () => {
  await cleanupHelper.cleanup();
});
```

## Adding New Tests

### 1. Create Page Object (if needed)

```typescript
// page-objects/pages/supplier-pages.ts
export class SupplierFormPage extends FormPage {
  get formDefinition(): FormDefinition {
    return {
      name: 'Supplier',
      fields: [...],
      submitButton: /create|save/i,
    };
  }
}
```

### 2. Create Fixtures

```typescript
// fixtures/entity-fixtures.ts
export function generateTestSupplier(prefix: string): TestSupplier {
  const timestamp = Date.now();
  return {
    code: `SUP-${timestamp}`,
    name: `${prefix} Supplier ${timestamp}`,
    // ...
  };
}
```

### 3. Create Spec File

```typescript
// specs/02-masters/supplier.spec.ts
test.describe('Supplier Management', () => {
  test('page loads correctly', ...);
  test('can create supplier', ...);
  test('can edit supplier', ...);
  test('can delete supplier', ...);
});
```

### 4. Update Dependencies

Add to `test-config.ts`:
```typescript
export const EntityDependencies = {
  // ...
  supplier: [],
  purchaseOrder: ['supplier', 'material'],
};
```

## Troubleshooting

### Tests Timing Out
- Increase timeout in config
- Add explicit waits
- Check if server is running

### Flaky Tests
- Use `test.describe.serial` for dependent tests
- Add `waitForLoadState('networkidle')`
- Use more specific selectors

### Console Errors
- Check if errors are from the app or test
- Filter out known non-critical errors
- Fix actual app errors

### Authentication Issues
- Clear localStorage before tests
- Check if token is valid
- Verify API endpoint is correct
