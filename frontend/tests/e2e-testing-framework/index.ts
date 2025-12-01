/**
 * E2E Testing Framework Index
 * Main entry point for the testing framework
 */

// Configuration
export * from './config/test-config';

// Core utilities
export * from './core/dependency-manager';
export * from './core/field-validator';
export * from './core/test-orchestrator';

// Test fixtures
export * from './fixtures/entity-fixtures';

// Page objects
export * from './page-objects/base-page';
export * from './page-objects/form-page';
export * from './page-objects/list-page';
export * from './page-objects/pages/index';

/**
 * Test Dependency Order
 *
 * LEVEL 0 (No Dependencies - Foundation):
 * ├── auth.spec.ts           - Authentication tests
 * ├── warehouse.spec.ts      - Warehouse management
 * └── component-masters.spec.ts - Component attributes
 *
 * LEVEL 1 (Basic Master Data):
 * ├── customer.spec.ts       - Customer management
 * ├── supplier.spec.ts       - Supplier management
 * └── material.spec.ts       - Material management
 *
 * LEVEL 2 (Intermediate - Depends on Level 1):
 * ├── fabric.spec.ts         - Fabric management (→ material, supplier)
 * ├── greige.spec.ts         - Greige management (→ material, supplier)
 * ├── style.spec.ts          - Style management (→ customer, componentMaster)
 * └── purchase-order.spec.ts - Purchase orders (→ supplier, material)
 *
 * LEVEL 3 (Complex - Depends on Level 2):
 * ├── bom.spec.ts            - Bill of Materials (→ style, material)
 * ├── order.spec.ts          - Sales orders (→ customer, style)
 * ├── grn.spec.ts            - Goods Receiving Notes (→ purchaseOrder)
 * └── cost-sheet.spec.ts     - Cost sheets (→ style, bom)
 *
 * LEVEL 4 (Highest Level - Depends on Level 3):
 * ├── work-order.spec.ts     - Work orders (→ order, location)
 * ├── stock-movement.spec.ts - Stock movements (→ material, warehouse)
 * └── invoice.spec.ts        - Invoices (→ order)
 */

/**
 * Test Categories
 */
export const TestCategories = {
  FOUNDATION: 'Foundation',
  MASTERS: 'Master Data',
  TRANSACTIONS: 'Transactions',
  REPORTS: 'Reports',
  INTEGRATION: 'Integration',
};

/**
 * Test Tags for filtering
 */
export const TestTags = {
  SMOKE: '@smoke',           // Quick sanity tests
  REGRESSION: '@regression', // Full regression suite
  CRITICAL: '@critical',     // Business-critical paths
  SLOW: '@slow',             // Long-running tests
  FLAKY: '@flaky',           // Known flaky tests
};

/**
 * Run configuration
 */
export interface RunConfig {
  levels?: number[];         // Which levels to run (0-4)
  categories?: string[];     // Which categories to run
  tags?: string[];           // Which tags to include
  parallel?: boolean;        // Run tests in parallel
  retries?: number;          // Number of retries for failed tests
  timeout?: number;          // Global timeout
}

/**
 * Default run configuration
 */
export const DefaultRunConfig: RunConfig = {
  levels: [0, 1, 2, 3, 4],
  parallel: false, // Sequential for dependency management
  retries: 2,
  timeout: 60000,
};

/**
 * Get spec files for a specific level
 */
export function getSpecFilesForLevel(level: number): string[] {
  const specFiles: Record<number, string[]> = {
    0: [
      './specs/01-foundation/auth.spec.ts',
      './specs/01-foundation/warehouse.spec.ts',
      './specs/01-foundation/component-masters.spec.ts',
    ],
    1: [
      './specs/02-masters/customer.spec.ts',
      './specs/02-masters/supplier.spec.ts',
      './specs/02-masters/material.spec.ts',
    ],
    2: [
      './specs/02-masters/fabric.spec.ts',
      './specs/02-masters/greige.spec.ts',
      './specs/02-masters/style.spec.ts',
      './specs/02-masters/purchase-order.spec.ts',
    ],
    3: [
      './specs/03-transactions/bom.spec.ts',
      './specs/03-transactions/order.spec.ts',
      './specs/03-transactions/grn.spec.ts',
      './specs/03-transactions/cost-sheet.spec.ts',
    ],
    4: [
      './specs/04-production/work-order.spec.ts',
      './specs/04-production/stock-movement.spec.ts',
      './specs/04-production/invoice.spec.ts',
    ],
  };

  return specFiles[level] || [];
}

/**
 * Get all spec files in dependency order
 */
export function getAllSpecFiles(): string[] {
  return [
    ...getSpecFilesForLevel(0),
    ...getSpecFilesForLevel(1),
    ...getSpecFilesForLevel(2),
    ...getSpecFilesForLevel(3),
    ...getSpecFilesForLevel(4),
  ];
}
