# End-to-End Testing Framework for Garment ERP

This framework provides comprehensive E2E testing for all pages and fields, with proper dependency management.

## Architecture Overview

```
tests/
├── e2e-testing-framework/
│   ├── config/
│   │   └── test-config.ts          # Test configuration and timeouts
│   ├── core/
│   │   ├── dependency-manager.ts   # Manages entity dependencies
│   │   ├── test-orchestrator.ts    # Orchestrates test execution order
│   │   └── field-validator.ts      # Generic field validation utilities
│   ├── fixtures/
│   │   └── entity-fixtures.ts      # Test data generators for all entities
│   ├── page-objects/
│   │   ├── base-page.ts            # Base page object class
│   │   ├── form-page.ts            # Base form page class
│   │   ├── list-page.ts            # Base list page class
│   │   └── pages/                  # Individual page objects
│   ├── helpers/
│   │   ├── api-helper.ts           # Direct API calls for setup
│   │   └── cleanup-helper.ts       # Test data cleanup
│   └── specs/
│       ├── 01-foundation/          # Master data with no dependencies
│       ├── 02-masters/             # Master data with basic dependencies
│       ├── 03-transactions/        # Transaction pages
│       └── 04-reports/             # Report pages
```

## Dependency Chain

```
LEVEL 0 (No Dependencies):
├── Users (admin seeded)
├── Warehouses
├── Material Categories
├── Component Masters
└── Financial Setup (Tax, Currency, Payment Terms)

LEVEL 1 (Depends on Level 0):
├── Customers
├── Suppliers
├── Materials (→ Material Categories)
└── Locations (→ Warehouses)

LEVEL 2 (Depends on Level 1):
├── Styles (→ Customers, Component Masters)
├── Purchase Orders (→ Suppliers, Materials)
├── Fabric Masters (→ Materials)
└── Greige Masters (→ Materials)

LEVEL 3 (Depends on Level 2):
├── Bill of Materials (→ Styles, Materials)
├── GRN (→ Purchase Orders)
├── Orders (→ Customers, Styles)
└── Cost Sheets (→ Styles, BOMs)

LEVEL 4 (Depends on Level 3):
├── Work Orders (→ Orders, Locations)
├── Stock Movements (→ Materials, Locations)
└── Invoices (→ Orders)
```

## Running Tests

```bash
# Run all E2E tests in dependency order
npm run test:e2e

# Run specific level
npm run test:e2e -- --grep "Level 0"

# Run with UI
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## Field Testing Strategy

Each form is tested for:
1. **Field Rendering** - All fields visible and enabled
2. **Validation** - Required fields, format validation
3. **Interactions** - Dropdowns, date pickers, file uploads
4. **CRUD Operations** - Create, Read, Update, Delete
5. **Error Handling** - API errors, validation errors
6. **Console Errors** - No JavaScript errors

## Test Isolation

- Each test file creates its own test data
- Cleanup happens after each test suite
- Tests are designed to be independent
- Use API helpers for fast data setup
