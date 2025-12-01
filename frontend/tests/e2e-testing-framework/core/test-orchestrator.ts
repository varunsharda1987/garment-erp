import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import { DependencyManager, CreatedEntity } from './dependency-manager';
import { TestConfig } from '../config/test-config';

/**
 * Test Orchestrator
 * Coordinates test execution with proper dependency management
 */

// Extended test interface with custom fixtures
interface TestFixtures {
  dependencyManager: DependencyManager;
  authenticatedPage: Page;
  testUser: { email: string; password: string; token: string };
}

/**
 * Custom test with dependency management
 */
export const test = base.extend<TestFixtures>({
  // Create dependency manager for each test
  dependencyManager: async ({ page }, use) => {
    const manager = new DependencyManager(page);
    await use(manager);
    // Cleanup after test
    await manager.cleanup();
  },

  // Authenticated page with test user
  authenticatedPage: async ({ page, request }, use) => {
    // Register and login a test user
    const timestamp = Date.now();
    const testEmail = `e2e_${timestamp}@kashayafabs.com`;
    const testPassword = 'Test@123';

    // Register user
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/name/i).fill(`E2E Test User ${timestamp}`);
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/^password$/i).fill(testPassword);
    await page.getByLabel(/confirm password/i).fill(testPassword);

    await page.getByRole('button', { name: /create account|register|sign up/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: TestConfig.timeouts.navigation });

    await use(page);

    // Cleanup: logout
    try {
      await page.getByRole('button', { name: /logout|sign out/i }).click();
    } catch {
      // Ignore logout errors
    }
  },

  // Test user credentials
  testUser: async ({ page, request }, use) => {
    const timestamp = Date.now();
    const email = `e2e_${timestamp}@kashayafabs.com`;
    const password = 'Test@123';

    // Register user via API
    const response = await request.post(`${TestConfig.apiURL}/auth/register`, {
      data: {
        name: `E2E Test User ${timestamp}`,
        email,
        password,
      },
    });

    let token = '';
    if (response.ok()) {
      const data = await response.json();
      token = data.token || data.data?.token || '';
    }

    await use({ email, password, token });
  },
});

/**
 * Test Suite Configuration
 * Defines the order of test suites based on dependencies
 */
export const TestSuites = {
  // Level 0: No dependencies (foundation)
  level0: [
    'auth',           // Authentication tests
    'warehouse',      // Warehouse management
    'component-masters', // Component attributes
  ],

  // Level 1: Basic dependencies
  level1: [
    'customer',       // Depends on: none
    'supplier',       // Depends on: none
    'material',       // Depends on: materialCategory
  ],

  // Level 2: Intermediate dependencies
  level2: [
    'fabric',         // Depends on: material, supplier
    'greige',         // Depends on: material, supplier
    'style',          // Depends on: customer, componentMaster
    'purchase-order', // Depends on: supplier, material
  ],

  // Level 3: Complex dependencies
  level3: [
    'bom',            // Depends on: style, material
    'order',          // Depends on: customer, style
    'grn',            // Depends on: purchaseOrder
    'cost-sheet',     // Depends on: style, bom
  ],

  // Level 4: Highest level dependencies
  level4: [
    'work-order',     // Depends on: order, location
    'stock-movement', // Depends on: material, warehouse
    'invoice',        // Depends on: order
  ],
};

/**
 * Get test execution order
 * Returns flat array of test suites in correct execution order
 */
export function getTestExecutionOrder(): string[] {
  return [
    ...TestSuites.level0,
    ...TestSuites.level1,
    ...TestSuites.level2,
    ...TestSuites.level3,
    ...TestSuites.level4,
  ];
}

/**
 * Test context with pre-created dependencies
 */
export interface TestContext {
  page: Page;
  request: APIRequestContext;
  dependencyManager: DependencyManager;
  entities: Map<string, CreatedEntity>;
}

/**
 * Setup dependencies for a test
 */
export async function setupTestDependencies(
  page: Page,
  request: APIRequestContext,
  entityType: string
): Promise<TestContext> {
  const manager = new DependencyManager(page);

  // Get auth token
  const timestamp = Date.now();
  const registerResponse = await request.post(`${TestConfig.apiURL}/auth/register`, {
    data: {
      name: `Setup User ${timestamp}`,
      email: `setup_${timestamp}@test.com`,
      password: 'Test@123',
    },
  });

  const authData = await registerResponse.json();
  const token = authData.token || authData.data?.token || '';

  // Initialize manager with API context
  await manager.initialize(request, token);

  // Setup required dependencies
  const entities = await manager.setupDependencies(entityType);

  return {
    page,
    request,
    dependencyManager: manager,
    entities,
  };
}

/**
 * Cleanup test dependencies
 */
export async function cleanupTestDependencies(context: TestContext): Promise<void> {
  await context.dependencyManager.cleanup();
}

/**
 * Helper to run authenticated tests
 */
export async function runAuthenticatedTest(
  page: Page,
  testFn: (page: Page) => Promise<void>
): Promise<void> {
  // Ensure we're authenticated
  const isAuthenticated = await page.evaluate(() => !!localStorage.getItem('auth-token'));

  if (!isAuthenticated) {
    // Register/login
    const timestamp = Date.now();
    await page.goto('/register');
    await page.getByLabel(/name/i).fill(`Test User ${timestamp}`);
    await page.getByLabel(/email/i).fill(`test_${timestamp}@test.com`);
    await page.getByLabel(/^password$/i).fill('Test@123');
    await page.getByLabel(/confirm password/i).fill('Test@123');
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/);
  }

  await testFn(page);
}

/**
 * Generate test report
 */
export function generateTestReport(results: Map<string, { passed: number; failed: number; skipped: number }>): string {
  let report = '# E2E Test Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## Summary by Module\n\n';
  report += '| Module | Passed | Failed | Skipped | Status |\n';
  report += '|--------|--------|--------|---------|--------|\n';

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [module, result] of results) {
    const status = result.failed > 0 ? '❌' : '✅';
    report += `| ${module} | ${result.passed} | ${result.failed} | ${result.skipped} | ${status} |\n`;
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  report += `| **Total** | **${totalPassed}** | **${totalFailed}** | **${totalSkipped}** | ${totalFailed > 0 ? '❌' : '✅'} |\n`;

  return report;
}

// Re-export expect for convenience
export { expect };

export default test;
