# Tier 3 - Utility Controllers Reference

**Version:** 1.0
**Last Updated:** February 6, 2026

Low-impact utility and lookup controllers with standard CRUD patterns.

---

## Table of Contents

1. [Master Data Controllers](#1-master-data-controllers)
2. [Lookup Controllers](#2-lookup-controllers)
3. [Import/Export Controllers](#3-importexport-controllers)
4. [Utility Controllers](#4-utility-controllers)
5. [Standard CRUD Pattern](#5-standard-crud-pattern)

---

## 1. Master Data Controllers

Basic configuration and master data management.

### 1.1 Color Master

**Routes:** `backend/src/routes/color.routes.ts`

**Purpose:** Manage color definitions for styles and materials

**Fields:**
- Color code, name
- Hex value (#RRGGBB)
- Pantone code (optional)
- Color family (Red, Blue, etc.)

**Endpoints:**
- Standard CRUD + search by name/code

### 1.2 Size Category & Size Master

**Purpose:** Size definitions and categorization

**Size Categories:**
- NUMERIC (32, 34, 36, 38, 40, 42)
- ALPHA (XS, S, M, L, XL, XXL, 3XL)
- AGE (2Y, 4Y, 6Y, 8Y, 10Y, 12Y, 14Y)
- CUSTOM

**Fields:**
- Size category name
- Size code, description
- Sort order
- Measurements (chest, waist, hip, etc.)

### 1.3 Season Master

**Routes:** `backend/src/routes/season.routes.ts`
**Documented in:** [SEASON_MODULE_GUIDE.md](SEASON_MODULE_GUIDE.md)

**Season Types:** SS (Spring/Summer), AW (Autumn/Winter)

### 1.4 Product Category

**Routes:** `backend/src/routes/productCategory.routes.ts`

**Purpose:** Garment type categorization

**Examples:**
- Tops (Shirts, T-Shirts, Blouses)
- Bottoms (Pants, Jeans, Skirts)
- Outerwear (Jackets, Coats)
- Dresses, Jumpsuits
- Activewear

**Fields:**
- Category code, name
- Parent category (hierarchical)
- HSN code (for GST)
- Default components

### 1.5 Brand Master

**Purpose:** Brand definitions for multi-brand companies

**Fields:**
- Brand code, name, description
- Logo path
- Target market
- Brand guidelines (colors, fonts, etc.)

### 1.6 Component Group

**Routes:** `backend/src/routes/componentGroup.routes.ts`

**Purpose:** Group similar components

**Examples:**
- Collars (mandarin, convertible, shawl, etc.)
- Sleeves (set-in, raglan, kimono, etc.)
- Pockets (patch, welt, kangaroo, etc.)

**Fields:**
- Group name, description
- Sort order
- Component list

### 1.7 Pattern Part

**Routes:** `backend/src/routes/patternPart.routes.ts`

**Purpose:** Pattern cutting parts

**Examples:**
- Front panel, back panel
- Sleeve, cuff
- Collar, collar stand
- Pocket, pocket facing

**Fields:**
- Part name, code
- Component group
- Typical fabric consumption

---

## 2. Lookup Controllers

Simple lookup tables for dropdowns and selections.

### 2.1 Warehouse Master

**Purpose:** Warehouse/location definitions

**Fields:**
- Warehouse code, name
- Location type (main, sub-warehouse, vendor)
- Address, capacity
- Manager contact

### 2.2 Currency Master

**Routes:** `backend/src/routes/currencies.routes.ts`
**Documented in:** [FINANCIAL_ACCOUNTING_GUIDE.md](FINANCIAL_ACCOUNTING_GUIDE.md#8-currencies--exchange-rates)

**Fields:**
- Currency code (USD, EUR, GBP, INR)
- Symbol, decimal places
- Is base currency flag

### 2.3 Payment Terms Master

**Routes:** `backend/src/routes/paymentTerms.routes.ts`

**Examples:**
- Net 30, Net 45, Net 60
- 50% advance + 50% on delivery
- COD (Cash on Delivery)
- Letter of Credit (L/C)

### 2.4 Expense Types

**Routes:** `backend/src/routes/expenseTypes.routes.ts`

**Categories:**
- DIRECT (materials, labor)
- INDIRECT (utilities, maintenance)
- ADMIN (office supplies, salaries)
- MARKETING (ads, promotions)
- TRANSPORT (freight, logistics)

### 2.5 Cost Centers

**Routes:** `backend/src/routes/costCenters.routes.ts`

**Types:**
- DEPARTMENT (Production, Sales, Admin)
- LOCATION (Factory A, Factory B, Warehouse)
- PROJECT (specific order or style)
- PRODUCT_LINE (jeans, shirts, etc.)

### 2.6 Chart of Accounts

**Routes:** `backend/src/routes/chartOfAccounts.routes.ts`

**Account Types:**
- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE

**Account Groups:**
- CURRENT_ASSET, FIXED_ASSET
- CURRENT_LIABILITY, LONG_TERM_LIABILITY
- OPERATING_REVENUE, NON_OPERATING_REVENUE
- DIRECT_EXPENSE, INDIRECT_EXPENSE

### 2.7 Bank Accounts

**Routes:** `backend/src/routes/bankAccounts.routes.ts`

**Fields:**
- Bank name, branch
- Account number, IFSC code
- Account type (savings, current)
- Current balance

---

## 3. Import/Export Controllers

Bulk data operations.

### 3.1 Import Controller

**Routes:** `backend/src/routes/import.routes.ts`

**Supported Entities:**
- Materials (all types)
- Styles with components
- Customers, suppliers
- Colors, sizes

**File Formats:**
- CSV (comma-separated values)
- Excel (XLSX)
- JSON (for complex structures)

**Process:**
1. Upload file
2. Validate data (schema, required fields, duplicates)
3. Preview import (show errors if any)
4. Confirm import
5. Bulk insert with transaction

**Endpoints:**
- `POST /api/import/validate` - Validate file
- `POST /api/import/preview` - Preview data
- `POST /api/import/execute` - Execute import
- `GET /api/import/template/:entity` - Download template

### 3.2 Export Controller

**Routes:** `backend/src/routes/export.routes.ts`

**Supported Entities:**
- Orders, work orders
- Styles, BOMs
- Stock levels
- Financial reports

**File Formats:**
- CSV, Excel, PDF
- JSON (for API integration)

**Endpoints:**
- `GET /api/export/:entity` - Export data
- `POST /api/export/custom` - Custom query export

### 3.3 Style Import Controller

**Routes:** `backend/src/routes/style-import.routes.ts`

**Specialized style import with components:**
- Main style data
- Components with quantities
- Fabrics with consumption
- Accessories
- Processes

**Template Columns:**
- Style Number, Name, Category
- Component_1_Code, Component_1_Qty
- Fabric_1_Code, Fabric_1_Consumption
- ...

---

## 4. Utility Controllers

Helper and administrative functions.

### 4.1 Lookup Controller

**Routes:** `backend/src/routes/lookup.routes.ts`

**Purpose:** Consolidated dropdown data

**Endpoints:**
- `GET /api/lookup/colors` - All colors
- `GET /api/lookup/sizes/:category` - Sizes by category
- `GET /api/lookup/materials/:type` - Materials by type
- `GET /api/lookup/suppliers/:category` - Suppliers by category

**Response:**
```typescript
{
  id: string;
  code: string;
  name: string;
  // Minimal data for dropdowns
}
```

### 4.2 Template Controller

**Routes:** `backend/src/routes/template.routes.ts`

**Purpose:** File upload and template management

**Templates:**
- Import templates (CSV/Excel)
- Report templates (PDF)
- Email templates (HTML)
- Label templates (for printing)

**Endpoints:**
- `GET /api/templates/:type` - Get template
- `POST /api/templates/upload` - Upload template

### 4.3 Trim Dashboard Controller

**Routes:** `backend/src/routes/trim-dashboard.routes.ts`

**Purpose:** Summary view of all trim inventory

**Metrics:**
- Total trim types
- Stock levels by trim type
- Low stock alerts
- Recent usage
- Top suppliers

**Endpoint:**
- `GET /api/trim-dashboard/summary`

### 4.4 Master Data Dashboard

**Routes:** `backend/src/routes/masterDataDashboard.routes.ts`

**Purpose:** Overview of all master data

**Counts:**
- Total materials (by type)
- Total suppliers
- Total customers
- Total styles
- Total colors, sizes, etc.

**Endpoint:**
- `GET /api/master-data-dashboard/summary`

### 4.5 Permission Controller

**Routes:** `backend/src/routes/permission.routes.ts`
**Documented in:** [SECURITY_GUIDE.md](SECURITY_GUIDE.md#user-roles--permissions)

**Endpoints:**
- `GET /api/permissions/matrix` - Full permission matrix
- `GET /api/permissions/roles` - All roles
- `GET /api/permissions/roles/:role` - Permissions for role

### 4.6 Production Status Controller

**Routes:** `backend/src/routes/productionStatus.routes.ts`

**Purpose:** Track production stage status

**Stages:**
- PATTERN_MAKING
- SAMPLE_DEVELOPMENT
- BULK_CUTTING
- BULK_STITCHING
- FINISHING
- PACKING
- DISPATCH

**Fields:**
- Status code, name
- Stage, sort order
- Color coding (for UI)

### 4.7 Order Production Status

**Routes:** `backend/src/routes/orderProductionStatus.routes.ts`

**Purpose:** Track order-level production progress

**Endpoint:**
- `GET /api/orders/:id/production-status`

**Response:**
```typescript
{
  orderId: string;
  orderNumber: string;
  stages: [
    {
      stage: "CUTTING";
      status: "COMPLETED";
      percentage: 100;
      startDate: string;
      endDate: string;
    },
    {
      stage: "STITCHING";
      status: "IN_PROGRESS";
      percentage: 65;
      startDate: string;
    }
  ]
}
```

### 4.8 Quotation Controller

**Routes:** `backend/src/routes/quotation.routes.ts`

**Purpose:** Price quotations to customers before order

**Workflow:**
1. Create quotation
2. Send to customer
3. Customer accepts/rejects
4. Convert to order (if accepted)

**Endpoints:**
- Standard CRUD + send, accept, reject, convert

### 4.9 Tax Masters

**Routes:** `backend/src/routes/taxMasters.routes.ts`

**Tax Types:**
- GST (CGST, SGST, IGST)
- VAT
- Customs duty
- Other taxes

**Fields:**
- Tax code, name, description
- Tax rate percentage
- Effective from date, effective to date
- HSN/SAC code applicability

### 4.10 CAD Planning Controller

**Routes:** `backend/src/routes/cad-planning.controller.ts`
**Documented in:** [CAD_PLANNING_GUIDE.md](CAD_PLANNING_GUIDE.md)

**Purpose:** Fabric consumption optimization

### 4.11 Test Templates Controller

**Routes:** `backend/src/routes/testTemplates.routes.ts`

**Purpose:** Quality test templates

**Test Types:**
- FPT (First Production Test)
- GPT (Garment Performance Test)
- Lab tests (shrinkage, color fastness, etc.)

**Fields:**
- Template name, description
- Test parameters
- Pass/fail criteria

### 4.12 Testing Labs Controller

**Routes:** `backend/src/routes/testingLabs.routes.ts`

**Purpose:** External testing laboratory management

**Fields:**
- Lab name, location
- Accreditation, certifications
- Services offered
- Contact details

### 4.13 Garment Physical Tests

**Routes:** `backend/src/routes/garmentPhysicalTests.routes.ts`

**Purpose:** Record physical test results

**Tests:**
- Dimensional stability (shrinkage)
- Color fastness (wash, light, rub)
- Seam strength
- Pilling resistance
- Tear strength

**Endpoints:**
- `POST /api/physical-tests` - Record test result
- `GET /api/physical-tests/:styleId` - Get style test history

---

## 5. Standard CRUD Pattern

All utility controllers follow this pattern:

### Common Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/{entity}` | Create new record |
| GET | `/api/{entity}` | Get all records (paginated, searchable) |
| GET | `/api/{entity}/:id` | Get by ID |
| PUT | `/api/{entity}/:id` | Update record |
| DELETE | `/api/{entity}/:id` | Delete/deactivate record |

### Query Parameters

**Pagination:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Search:**
- `search` - Full-text search across name, code, description

**Filters:**
- `isActive` - Filter by active status
- `categoryId` - Filter by category
- `type` - Filter by type

**Sorting:**
- `sortBy` - Field to sort by (default: createdAt)
- `sortOrder` - asc or desc (default: desc)

### Standard Request

```typescript
POST /api/{entity}
{
  code: string;         // Unique identifier
  name: string;
  description?: string;
  isActive?: boolean;   // Default: true
  // ... entity-specific fields
}
```

### Standard Response

```typescript
// Success
{
  success: true;
  data: {
    id: string;
    code: string;
    name: string;
    // ... full entity
  }
}

// Error
{
  error: string;
  message: string;
  details?: any;
}
```

### Pagination Response

```typescript
{
  data: Entity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

---

## Quick Reference

### Entities by Category

**Configuration:**
- Colors, Sizes, Seasons, Brands, Categories
- Warehouses, Currencies, Payment Terms

**Master Data:**
- Materials (23 types)
- Customers, Suppliers
- Styles, Components

**Transactional:**
- Orders, Work Orders, POs, GRNs
- Cutting, Stitching, Finishing
- Invoices, Payments

**Processing:**
- Printing, Dyeing, Embroidery
- Sample Management
- Quality Testing

**Reports:**
- Dashboards, Summaries
- Production Status
- Stock Reports

### Common Fields

Almost all entities have:
- `id` - UUID primary key
- `code` - Unique human-readable code
- `name` - Display name
- `description` - Optional description
- `isActive` - Soft delete flag
- `createdAt` - Creation timestamp
- `updatedAt` - Last modification timestamp
- `createdBy` - User ID (optional)

### Naming Conventions

**Code Formats:**
- Colors: `COL-001`, `COL-002`
- Materials: `MAT-BTN-001`, `MAT-ZIP-001`
- Styles: `ST-2026-001`
- Orders: `ORD-202506-0001`
- Work Orders: `WO-202506-0001`

**API Endpoints:**
- Kebab-case: `/api/chart-of-accounts`
- Plural for collections: `/api/colors`, `/api/suppliers`
- Singular for single resource: `/api/colors/:id`

---

## Integration Notes

### With Frontend

All controllers return serialized responses (snake_case → camelCase).

**Example:**
```typescript
// Database: brand_categories (snake_case)
// API Response: brandCategories (camelCase)

const style = await getStyleById(id);
console.log(style.brandCategories);  // ✅ Correct
console.log(style.brand_categories); // ❌ Wrong
```

### With MCP Servers

- Prisma MCP: Schema analysis
- TypeScript MCP: Type checking
- Database MCP: Direct queries (read-only)
- Docs MCP: Documentation search

### Performance Tips

1. **Use Pagination** - Don't fetch all records
2. **Filter Early** - Use query parameters to reduce data
3. **Cache Lookups** - Color, size data rarely changes
4. **Batch Operations** - Use bulk import for large datasets
5. **Indexes** - Code, name fields are indexed for fast search

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [MATERIALS_MASTER_GUIDE.md](MATERIALS_MASTER_GUIDE.md) - Material details
- [SECURITY_GUIDE.md](SECURITY_GUIDE.md) - Authentication & permissions
- [TIER2_CONTROLLERS_REFERENCE.md](TIER2_CONTROLLERS_REFERENCE.md) - Medium-impact controllers

---

**Maintained By:** Kashaya Fabs Development Team
