# Testing Guide - Kashaya Fabs Garment ERP

**Last Updated:** November 22, 2025
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Testing (Jest + Supertest)](#backend-testing)
3. [Frontend Testing (Vitest + Testing Library)](#frontend-testing)
4. [E2E Testing (Playwright)](#e2e-testing)
5. [Test Coverage](#test-coverage)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Our testing strategy consists of three layers:

```
┌─────────────────────────────────────┐
│   E2E Tests (Playwright)            │  ← User workflows
├─────────────────────────────────────┤
│   Integration Tests (Supertest)     │  ← API endpoints
├─────────────────────────────────────┤
│   Unit Tests (Jest + Vitest)        │  ← Functions & Components
└─────────────────────────────────────┘
```

**Coverage Targets:**
- **Backend:** 70% (unit + integration)
- **Frontend:** 60% (component + integration)
- **E2E:** Critical user flows

---

## Backend Testing

### Technology Stack

- **Jest** - Test framework
- **ts-jest** - TypeScript support
- **Supertest** - HTTP assertions
- **Prisma** - Database testing

### Running Tests

```bash
cd backend

# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Generate coverage report
npm run test:coverage

# CI/CD mode (no watch, with coverage)
npm run test:ci
```

### Test Structure

```
backend/src/
├── __tests__/
│   ├── setup.ts                    # Global test setup
│   ├── helpers/
│   │   └── test-utils.ts           # Test utilities
│   └── integration/
│       └── auth.test.ts            # Integration tests
├── services/
│   └── __tests__/
│       └── Service.test.ts         # Unit tests
└── controllers/
    └── __tests__/
        └── Controller.test.ts      # Controller tests
```

### Writing Unit Tests

**Example: Service Test**

```typescript
// src/services/__tests__/MyService.test.ts
import { MyService } from '../MyService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should calculate correctly', () => {
    const result = service.calculate(10, 20);
    expect(result).toBe(30);
  });

  it('should handle edge cases', () => {
    const result = service.calculate(0, 0);
    expect(result).toBe(0);
  });
});
```

### Writing Integration Tests

**Example: API Test**

```typescript
// src/__tests__/integration/users.test.ts
import request from 'supertest';
import app from '../../app';
import { prisma, cleanupTestData } from '../helpers/test-utils';

describe('Users API', () => {
  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('should get all users', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('users');
    expect(Array.isArray(response.body.users)).toBe(true);
  });

  it('should create a user', async () => {
    const newUser = {
      email: 'test@test.com',
      name: 'Test User',
      password: 'password123',
    };

    const response = await request(app)
      .post('/api/users')
      .send(newUser)
      .expect(201);

    expect(response.body.user.email).toBe(newUser.email);
  });
});
```

### Test Utilities

**Available helpers in `test-utils.ts`:**

```typescript
// Generate auth token
const token = generateTestToken(userId, role);

// Get authorization header
const headers = getAuthHeader(userId, 'ADMIN');

// Create test user
const user = await createTestUser({ email: 'test@test.com' });

// Cleanup test data
await cleanupTestData();

// Mock Prisma client
const mockPrisma = createMockPrisma();
```

### Mocking

**Logger is auto-mocked in `setup.ts`:**

```typescript
// Logger calls are automatically mocked in tests
logInfo('message'); // Won't output during tests
```

**Mock external services:**

```typescript
jest.mock('../services/external-api', () => ({
  fetchData: jest.fn().mockResolvedValue({ data: 'mocked' }),
}));
```

---

## Frontend Testing

### Technology Stack

- **Vitest** - Test framework
- **Testing Library** - Component testing
- **jsdom** - DOM simulation
- **Playwright** - E2E testing

### Running Tests

```bash
cd frontend

# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Generate coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E in headed mode
npm run test:e2e:headed
```

### Test Structure

```
frontend/src/
├── test/
│   └── setup.ts                    # Global test setup
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx             # Component test
├── pages/
│   ├── LoginPage.tsx
│   └── LoginPage.test.tsx          # Page test
└── tests/ (Playwright E2E)
    ├── auth.spec.ts
    ├── users.spec.ts
    └── fabric-management.spec.ts
```

### Writing Component Tests

**Example: Component Test**

```typescript
// src/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByText('Click')).toBeDisabled();
  });
});
```

### Writing Page Tests

**Example: Page Test**

```typescript
// src/pages/LoginPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

vi.mock('../services/auth.service', () => ({
  login: vi.fn(),
}));

describe('LoginPage', () => {
  it('should render login form', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should display validation errors', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Library Queries

**Priority order:**

1. `getByRole` - Accessible queries
2. `getByLabelText` - Form elements
3. `getByPlaceholderText` - Input placeholders
4. `getByText` - Text content
5. `getByTestId` - Last resort

---

## E2E Testing

### Technology Stack

- **Playwright** - Browser automation
- **Multiple browsers** - Chromium, Firefox, WebKit

### Running E2E Tests

```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run with UI mode
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

### Writing E2E Tests

**Example: User Flow Test**

```typescript
// tests/fabric-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Fabric Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create new fabric', async ({ page }) => {
    await page.goto('/fabrics');
    await page.click('button:has-text("Add")');

    await page.fill('input[name="name"]', 'Test Fabric');
    await page.fill('input[name="code"]', 'TF-001');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### E2E Best Practices

1. **Use data-testid for stability**
   ```html
   <button data-testid="submit-button">Submit</button>
   ```
   ```typescript
   await page.click('[data-testid="submit-button"]');
   ```

2. **Wait for network idle**
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

3. **Handle dynamic content**
   ```typescript
   await page.waitForSelector('text=Success', { timeout: 10000 });
   ```

4. **Use fixtures for test data**
   ```typescript
   test.use({ testData: 'fixtures/fabrics.json' });
   ```

---

## Test Coverage

### Viewing Coverage Reports

**Backend:**
```bash
cd backend
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html  # Windows
```

**Frontend:**
```bash
cd frontend
npm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Thresholds

**Backend (jest.config.js):**
```javascript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
}
```

**Frontend (vitest.config.ts):**
```typescript
coverage: {
  thresholds: {
    lines: 50,
    functions: 50,
    branches: 50,
    statements: 50,
  },
}
```

### Improving Coverage

1. **Identify uncovered code**
   - Check HTML coverage report
   - Look for red highlighted lines

2. **Write missing tests**
   - Focus on critical paths first
   - Test edge cases
   - Test error handling

3. **Exclude non-testable code**
   - Configuration files
   - Type definitions
   - Mock data

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: garment_erp_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run tests
        working-directory: ./backend
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/garment_erp_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run tests
        working-directory: ./frontend
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Install Playwright browsers
        working-directory: ./frontend
        run: npx playwright install --with-deps

      - name: Run E2E tests
        working-directory: ./frontend
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### Pre-commit Hooks (Husky)

**Install Husky:**
```bash
npm install --save-dev husky lint-staged
npx husky install
```

**Add pre-commit hook:**
```bash
npx husky add .husky/pre-commit "npm run test:ci"
```

**.lintstagedrc.json:**
```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "npm run test:related"
  ]
}
```

---

## Best Practices

### General

1. **Follow AAA pattern**
   - **Arrange:** Setup test data
   - **Act:** Execute the function
   - **Assert:** Verify the result

2. **Test behavior, not implementation**
   - Focus on what the code does
   - Don't test internal details

3. **Keep tests independent**
   - Each test should run standalone
   - Use `beforeEach` for setup
   - Clean up after tests

4. **Use descriptive test names**
   ```typescript
   // Good
   it('should return 400 when email is missing', () => {});

   // Bad
   it('test email', () => {});
   ```

5. **Don't test external libraries**
   - Trust that React, Prisma, etc. work
   - Test your code that uses them

### Backend Specific

1. **Use test database**
   - Never test against production
   - Use separate test database

2. **Clean up test data**
   - Delete test records after tests
   - Use transactions for isolation

3. **Mock external APIs**
   - Don't make real API calls
   - Use mocks or stubs

### Frontend Specific

1. **Test user interactions**
   - Click buttons
   - Fill forms
   - Navigate pages

2. **Test accessibility**
   - Use `getByRole`
   - Test keyboard navigation
   - Test screen reader labels

3. **Avoid testing implementation details**
   - Don't test component state
   - Don't test CSS classes
   - Test user-visible behavior

---

## Troubleshooting

### Common Issues

#### Backend Tests

**Issue:** Database connection failed
```
Solution: Check DATABASE_URL in test environment
Ensure PostgreSQL is running
```

**Issue:** Jest timeout
```
Solution: Increase timeout in jest.config.js
jest.setTimeout(10000);
```

**Issue:** Prisma client not generated
```bash
cd backend
npx prisma generate
```

#### Frontend Tests

**Issue:** Module not found
```
Solution: Check vitest.config.ts alias configuration
Ensure imports use correct paths
```

**Issue:** DOM not available
```
Solution: Ensure environment is set to 'jsdom' in vitest.config.ts
```

**Issue:** Component not rendering
```
Solution: Wrap component in required providers (Router, Theme, etc.)
```

#### E2E Tests

**Issue:** Playwright browser not installed
```bash
npx playwright install
```

**Issue:** Test timeout
```
Solution: Increase timeout:
test.setTimeout(60000);
```

**Issue:** Element not found
```
Solution: Add proper waits:
await page.waitForSelector('selector');
```

---

## Quick Reference

### Backend Commands

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # With coverage
```

### Frontend Commands

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
npm run test:coverage # With coverage
npm run test:e2e      # E2E tests
```

### Useful Matchers

```typescript
// Jest/Vitest
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(array).toContain(item);
expect(number).toBeGreaterThan(5);
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(arg);

// Testing Library
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeDisabled();
expect(element).toHaveTextContent('text');
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [Kent C. Dodds - Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Maintained By:** Kashaya Fabs Development Team
**Last Review:** November 22, 2025
**Next Review:** December 22, 2025
