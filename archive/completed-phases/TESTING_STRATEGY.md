# Testing Strategy - Kashaya Fabs ERP

## Overview

This document outlines the comprehensive testing strategy for the Kashaya Fabs ERP system. Our testing approach combines unit tests, component tests, and end-to-end tests to ensure system reliability and maintainability.

## Table of Contents

1. [Testing Pyramid](#testing-pyramid)
2. [Unit Tests](#unit-tests)
3. [Component Tests](#component-tests)
4. [End-to-End Tests](#end-to-end-tests)
5. [Test Organization](#test-organization)
6. [Running Tests](#running-tests)
7. [Writing Tests](#writing-tests)
8. [Best Practices](#best-practices)
9. [CI/CD Integration](#cicd-integration)

---

## Testing Pyramid

We follow the standard testing pyramid approach:

```
        /\
       /  \      E2E Tests (Few)
      /____\     - Critical user flows
     /      \    - Cross-module integration
    /________\   Component Tests (More)
   /          \  - UI component behavior
  /____________\ - User interactions
 /              \
/________________\ Unit Tests (Most)
                   - Business logic
                   - Utility functions
                   - Validators
```

### Test Distribution

- **Unit Tests**: ~60% of total tests
- **Component Tests**: ~30% of total tests
- **E2E Tests**: ~10% of total tests

---

## Unit Tests

### Technology Stack

- **Framework**: Vitest
- **Libraries**:
  - `@testing-library/react` for component testing
  - `@testing-library/jest-dom` for DOM assertions
  - `@testing-library/user-event` for user interactions

### What to Unit Test

1. **Utility Functions**
   - Validators (`lib/validators.ts`)
   - API error handlers (`lib/api-error-handler.ts`)
   - Date formatters
   - Number formatters

2. **Isolated Components**
   - EmptyState
   - SearchInput
   - StatusBadge
   - LoadingSpinner
   - ConfirmDialog

3. **Business Logic**
   - Form validation schemas
   - Data transformation functions
   - State management utilities

### Example Unit Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import Component from './Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const { user } = render(<Component />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('After Click')).toBeInTheDocument();
  });
});
```

### Location

- Component tests: `frontend/src/components/**/*.test.tsx`
- Utility tests: `frontend/src/lib/**/*.test.ts`
- Test utilities: `frontend/src/test/test-utils.tsx`

---

## Component Tests

### What to Component Test

1. **Form Components**
   - Field validation
   - Form submission
   - Error display
   - Required field handling

2. **Data Display Components**
   - DataTable rendering
   - Pagination
   - Sorting
   - Filtering

3. **Interactive Components**
   - Button states
   - Modal interactions
   - Dropdown menus
   - Date pickers

### Testing Approach

```typescript
describe('DataTable', () => {
  it('displays data correctly', () => {
    const data = [mockData1, mockData2];
    render(<DataTable data={data} columns={columns} />);

    expect(screen.getByText(mockData1.name)).toBeInTheDocument();
    expect(screen.getByText(mockData2.name)).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<DataTable data={[]} columns={columns} emptyState={emptyConfig} />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    const onPageChange = vi.fn();
    render(<DataTable pagination={{ currentPage: 1, onPageChange }} />);

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
```

---

## End-to-End Tests

### Technology Stack

- **Framework**: Playwright
- **Browsers**: Chromium (default), Firefox, Webkit (optional)

### What to E2E Test

1. **Critical User Flows**
   - Authentication (login, register, logout)
   - Customer CRUD operations
   - Order creation and management
   - User management (admin only)

2. **Cross-Module Integration**
   - Creating an order with customer selection
   - Material procurement workflow
   - Style-to-BOM relationships

3. **Non-Functional Requirements**
   - No console errors on pages
   - Page load performance
   - Session persistence

### Test Helpers

We provide reusable helpers in `frontend/tests/helpers/`:

1. **auth.helper.ts**
   - `registerUser(page, user)` - Register and login
   - `loginUser(page, email, password)` - Login existing user
   - `logoutUser(page)` - Logout current user
   - `clearAuth(page)` - Clear authentication state

2. **navigation.helper.ts**
   - `navigateToCustomers(page)` - Go to customers page
   - `navigateToOrders(page)` - Go to orders page
   - `waitForPageLoad(page)` - Wait for full page load

3. **assertions.helper.ts**
   - `assertSuccessToast(page)` - Verify success message
   - `assertTableHasData(page)` - Verify table has rows
   - `assertNoConsoleErrors(page)` - Check for errors

### Test Fixtures

Located in `frontend/tests/fixtures/`:

1. **test-data.ts**
   - `generateTestCustomer()` - Create customer data
   - `generateTestMaterial()` - Create material data
   - `generateTestSupplier()` - Create supplier data

2. **test-fixtures.ts**
   - `authenticatedPage` - Page with logged-in user
   - `adminPage` - Page with admin user
   - `cleanupAuth` - Auto-cleanup fixture

### Example E2E Test

```typescript
import { test, expect } from '@playwright/test';
import { registerUser, generateTestUser } from './helpers/auth.helper';
import { navigateToCustomers } from './helpers/navigation.helper';
import { generateTestCustomer } from './fixtures/test-data';

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateTestUser();
    await registerUser(page, user);
  });

  test('creates a new customer', async ({ page }) => {
    await navigateToCustomers(page);

    await page.getByRole('button', { name: /add customer/i }).click();

    const customer = generateTestCustomer();
    await page.getByLabel(/name/i).fill(customer.name);
    await page.getByLabel(/email/i).fill(customer.email);

    await page.getByRole('button', { name: /save/i }).click();

    await expect(page).toHaveURL(/\/customers/);
    await expect(page.getByText(customer.name)).toBeVisible();
  });
});
```

### Location

- E2E tests: `frontend/tests/**/*.spec.ts`
- Test helpers: `frontend/tests/helpers/**/*.helper.ts`
- Test fixtures: `frontend/tests/fixtures/**/*.ts`
- Test configuration: `frontend/playwright.config.ts`

---

## Test Organization

### Folder Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── EmptyState.tsx
│   │   └── EmptyState.test.tsx          # Component tests
│   ├── lib/
│   │   ├── validators.ts
│   │   └── validators.test.ts           # Unit tests
│   └── test/
│       ├── setup.ts                      # Test setup
│       └── test-utils.tsx                # Test utilities
├── tests/                                # E2E tests
│   ├── auth.spec.ts
│   ├── customers.spec.ts
│   ├── users.spec.ts
│   ├── helpers/
│   │   ├── auth.helper.ts
│   │   ├── navigation.helper.ts
│   │   └── assertions.helper.ts
│   └── fixtures/
│       ├── test-data.ts
│       └── test-fixtures.ts
├── vitest.config.ts                      # Vitest configuration
└── playwright.config.ts                  # Playwright configuration
```

### Naming Conventions

- **Unit/Component Tests**: `*.test.tsx` or `*.test.ts`
- **E2E Tests**: `*.spec.ts`
- **Test Helpers**: `*.helper.ts`
- **Test Fixtures**: `test-data.ts`, `test-fixtures.ts`

---

## Running Tests

### Unit & Component Tests (Vitest)

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- EmptyState.test.tsx
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests with UI
npm run test:e2e:ui

# View test report
npm run test:e2e:report

# Run specific test file
npx playwright test customers.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium
```

### Prerequisites for E2E Tests

1. **Backend must be running**: `cd backend && npm run dev`
2. **Database must be accessible**: PostgreSQL running on configured port
3. **Frontend dev server**: Playwright will auto-start (configured in `playwright.config.ts`)

---

## Writing Tests

### Unit/Component Test Guidelines

1. **Test File Location**: Co-locate with component/utility
2. **Test Structure**: Use `describe` and `it` blocks
3. **Arrange-Act-Assert**: Follow AAA pattern
4. **Mock External Dependencies**: API calls, localStorage, etc.
5. **Use Test Utilities**: Import from `@/test/test-utils`

### E2E Test Guidelines

1. **Test File Location**: `frontend/tests/*.spec.ts`
2. **Use Helpers**: Leverage auth, navigation, and assertion helpers
3. **Use Fixtures**: Use test data fixtures for consistency
4. **Independent Tests**: Each test should be independent
5. **Clean Up**: Use `beforeEach` and `afterEach` for cleanup
6. **Wait Properly**: Use `waitForLoadState`, `waitForURL`, not arbitrary `waitForTimeout`
7. **Meaningful Screenshots**: Take screenshots for documentation

### Test Data Best Practices

1. **Generate Unique Data**: Use timestamps to avoid conflicts
2. **Use Fixtures**: Centralize test data in `fixtures/test-data.ts`
3. **Realistic Data**: Use realistic names, emails, phone numbers
4. **Valid Format**: Ensure GST, phone, email follow validation rules

---

## Best Practices

### General

1. **Test Behavior, Not Implementation**: Test what the user sees/does
2. **One Assertion Per Test**: Keep tests focused (flexible rule)
3. **Descriptive Test Names**: Use clear, descriptive test names
4. **Fast Tests**: Keep unit tests under 100ms
5. **Deterministic**: Tests should always produce same result

### Unit/Component Tests

1. **Avoid Testing React Internals**: Don't test state directly
2. **Use `screen` queries**: Prefer `screen.getByRole` over manual queries
3. **Accessibility**: Use semantic queries (`getByRole`, `getByLabelText`)
4. **User Events**: Use `@testing-library/user-event` for interactions
5. **Async Operations**: Always use `waitFor` for async assertions

### E2E Tests

1. **Use Data Attributes**: Add `data-testid` only when necessary
2. **Prefer Semantic Selectors**: Use role, label, text over CSS selectors
3. **Page Object Pattern**: Use helpers for repeated interactions
4. **Resilient Selectors**: Avoid brittle selectors (CSS classes)
5. **Test Critical Paths**: Focus on user-critical workflows
6. **Parallel Execution**: Write tests that can run in parallel

---

## CI/CD Integration

### GitHub Actions Workflow (Example)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm install
      - run: cd frontend && npm test -- --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd backend && npm install
      - run: cd backend && npm run migrate
      - run: cd backend && npm run dev &
      - run: cd frontend && npx playwright install --with-deps
      - run: cd frontend && npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### Test Triggers

- **On Pull Request**: Run all tests
- **On Push to Main**: Run all tests + generate coverage report
- **Nightly**: Run full E2E suite across all browsers
- **Before Deployment**: Run smoke tests

### Coverage Thresholds

Maintain minimum coverage:
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

---

## Test Coverage

### Current Coverage Status

Run `npm run test:coverage` to see current coverage:

```bash
cd frontend
npm run test:coverage
```

Coverage reports are generated in:
- **HTML Report**: `frontend/coverage/index.html`
- **JSON Report**: `frontend/coverage/coverage-final.json`

### Coverage Goals by Module

| Module | Target Coverage |
|--------|----------------|
| Components | 85% |
| Utilities | 90% |
| Services | 75% |
| Pages | 70% |

---

## Troubleshooting

### Common Issues

1. **Tests Timing Out**
   - Increase timeout in test or config
   - Check for network issues
   - Verify backend is running

2. **Flaky E2E Tests**
   - Add proper waits (`waitForLoadState`)
   - Use `waitFor` with conditions
   - Avoid `waitForTimeout` when possible

3. **Port Conflicts**
   - Ensure no other services on ports 5173, 5000
   - Configure different ports in test config

4. **Database Issues**
   - Reset database before E2E tests
   - Use test database, not production

---

## Future Enhancements

1. **Visual Regression Testing**
   - Integrate Percy or Chromatic
   - Capture UI changes automatically

2. **Performance Testing**
   - Lighthouse CI integration
   - Load time monitoring

3. **Accessibility Testing**
   - Integrate axe-core
   - Automated a11y checks

4. **API Testing**
   - Separate API test suite
   - Contract testing with Pact

5. **Load Testing**
   - K6 or Artillery for load tests
   - Stress test critical endpoints

---

## Resources

### Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

### Internal

- [Test Utilities](./frontend/src/test/test-utils.tsx)
- [Test Helpers](./frontend/tests/helpers/)
- [Test Fixtures](./frontend/tests/fixtures/)
- [Coding Standards](./CODING_STANDARDS.md)

---

## Contributing

When contributing tests:

1. Follow naming conventions
2. Use existing helpers and fixtures
3. Write descriptive test names
4. Add comments for complex test logic
5. Update this document if needed
6. Ensure tests pass before committing

---

**Last Updated**: January 2025
**Maintainer**: Development Team
