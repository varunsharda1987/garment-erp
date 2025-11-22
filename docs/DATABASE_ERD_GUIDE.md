# Database ERD Guide - Kashaya Fabs Garment ERP

**Last Updated:** November 22, 2025
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Generating ERD from Prisma Schema](#generating-erd-from-prisma-schema)
3. [Using Prisma Studio](#using-prisma-studio)
4. [Using Third-Party Tools](#using-third-party-tools)
5. [Database Statistics](#database-statistics)
6. [Maintenance](#maintenance)

---

## Overview

The Kashaya Fabs ERP database consists of **48 Prisma models** representing a comprehensive garment manufacturing system. The database schema includes:

- **User Management** - Users, roles, permissions
- **Inventory** - Materials, fabrics, greige, finished goods
- **Orders** - Customer orders, work orders
- **Production** - BOM, style costing, production planning
- **Financial** - Chart of accounts, taxes, payments
- **Warehouse** - Stock levels, movements, counts
- **Import/Export** - Data templates, bulk operations

---

## Generating ERD from Prisma Schema

### Method 1: Using Prisma ERD Generator (Recommended)

**Install:**

```bash
cd backend
npm install -D prisma-erd-generator @mermaid-js/mermaid-cli
```

**Configure in `schema.prisma`:**

```prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "../docs/database-erd.svg"
  theme    = "forest"
}
```

**Generate ERD:**

```bash
npx prisma generate
```

This creates an SVG diagram at `docs/database-erd.svg`.

**Options:**

```prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "../docs/database-erd.svg"
  theme    = "forest"  // forest, dark, neutral, default
  includeRelationFromFields = true
}
```

---

### Method 2: Using dbdiagram.io

**Install dbml generator:**

```bash
npm install -D prisma-dbml-generator
```

**Configure in `schema.prisma`:**

```prisma
generator dbml {
  provider = "prisma-dbml-generator"
  output   = "../docs/database-schema.dbml"
}
```

**Generate DBML:**

```bash
npx prisma generate
```

**Import to dbdiagram.io:**

1. Go to [dbdiagram.io](https://dbdiagram.io/)
2. Create new diagram
3. Paste contents of `database-schema.dbml`
4. Export as PNG/PDF/SVG

---

### Method 3: Using Prisma Studio (Visual Browser)

Prisma Studio provides an interactive database browser:

```bash
cd backend
npx prisma studio
```

Opens at: `http://localhost:5555`

**Features:**
- View all tables
- Browse relationships
- Edit data directly
- Filter and search
- Export data

**Note:** Studio doesn't generate ERD diagrams, but useful for exploring schema visually.

---

### Method 4: Using SchemaSpy

Generate comprehensive database documentation with ERD:

**Requirements:**
- Java 8+
- PostgreSQL JDBC driver

**Run SchemaSpy:**

```bash
# Download SchemaSpy JAR
wget https://github.com/schemaspy/schemaspy/releases/download/v6.1.0/schemaspy-6.1.0.jar

# Download PostgreSQL driver
wget https://jdbc.postgresql.org/download/postgresql-42.6.0.jar

# Generate documentation
java -jar schemaspy-6.1.0.jar \
  -t pgsql \
  -dp postgresql-42.6.0.jar \
  -db garment_erp \
  -host localhost \
  -port 5432 \
  -u postgres \
  -p your_password \
  -o docs/database-schema
```

Opens: `docs/database-schema/index.html`

**Includes:**
- Interactive ERD diagrams
- Table details
- Relationships
- Constraints
- Indexes

---

## Using Prisma Studio

### Basic Usage

```bash
cd backend
npx prisma studio
```

### Features

**1. Browse Tables:**
- Click any model to view records
- Paginated views (100 records per page)
- Real-time data

**2. View Relationships:**
- Click related fields
- Navigate between tables
- Visualize connections

**3. Edit Data:**
- Double-click any cell
- Add/delete records
- Save changes directly

**4. Filter and Search:**
- Use filter bar
- Search across columns
- Sort by any field

**5. Export Data:**
- Right-click table
- Export as JSON
- Copy to clipboard

---

## Using Third-Party Tools

### pgAdmin 4 (Free)

**Install:** [Download pgAdmin](https://www.pgadmin.org/download/)

**Generate ERD:**
1. Connect to database
2. Right-click schema
3. Generate ERD
4. Export as PNG/SVG

**Features:**
- Full PostgreSQL admin
- Query tool
- Backup/restore
- Performance monitoring

---

### DBeaver (Free)

**Install:** [Download DBeaver](https://dbeaver.io/download/)

**Generate ERD:**
1. Connect to database
2. Right-click database
3. View Diagram
4. Export image

**Features:**
- Multi-database support
- SQL editor
- Data import/export
- ERD generation

---

### DataGrip (Paid - JetBrains)

**Install:** [Download DataGrip](https://www.jetbrains.com/datagrip/)

**Generate ERD:**
1. Open database
2. Diagrams → Show Visualization
3. Customize layout
4. Export as PNG/SVG

**Features:**
- Smart SQL editor
- Refactoring tools
- Version control
- Advanced ERD customization

---

## Database Statistics

### Current Schema (as of Nov 2025)

```
Total Models: 48
Total Relations: 95+
Total Indexes: 20+
```

### Key Models by Category

**User Management (5 models):**
- Users
- UserRoles
- RolePermissions
- Permissions
- Sessions

**Inventory (12 models):**
- Materials
- FabricMasters
- GreigeMasters
- FabricCADs
- FinishedGoods
- Warehouses
- StockLevels
- StockMovements
- StockCounts
- Suppliers
- Categories
- UnitOfMeasures

**Orders (8 models):**
- Orders
- OrderItems
- OrderStyles
- Customers
- PurchaseOrders
- PurchaseOrderItems
- Shipments
- ShipmentItems

**Production (10 models):**
- Styles
- StyleVariants
- StyleComponents
- BillOfMaterials
- BOMItems
- StyleCosting
- CostingItems
- WorkOrders
- ProductionPlans
- QualityChecks

**Financial (8 models):**
- ChartOfAccounts
- TaxMasters
- PaymentTerms
- Currencies
- CostCenters
- ExpenseTypes
- BankAccounts
- Transactions

**Import/Export (5 models):**
- ImportTemplates
- ImportJobs
- ExportJobs
- DataMappings
- BulkOperations

---

## Recommended ERD Generation Workflow

### Step 1: Install prisma-erd-generator

```bash
cd backend
npm install -D prisma-erd-generator @mermaid-js/mermaid-cli
```

### Step 2: Update schema.prisma

Add to `backend/prisma/schema.prisma`:

```prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "../docs/database-erd.svg"
  theme    = "forest"
  includeRelationFromFields = true
}
```

### Step 3: Generate ERD

```bash
cd backend
npx prisma generate
```

### Step 4: View ERD

Open `backend/docs/database-erd.svg` in browser or image viewer.

### Step 5: Documentation

Commit ERD to repository:

```bash
git add docs/database-erd.svg
git commit -m "docs: Add database ERD diagram"
```

---

## Maintenance

### Updating ERD

Whenever schema changes:

```bash
# 1. Update schema.prisma
# 2. Create migration
npx prisma migrate dev --name your_change

# 3. Regenerate ERD
npx prisma generate

# 4. Commit changes
git add prisma/schema.prisma prisma/migrations docs/database-erd.svg
git commit -m "feat: Update database schema"
```

### Documentation Best Practices

1. **Keep ERD Updated:**
   - Regenerate after every migration
   - Include in PR reviews
   - Version in git

2. **Multiple Formats:**
   - SVG for web viewing
   - PNG for presentations
   - DBML for dbdiagram.io
   - PDF for documentation

3. **Separate Diagrams:**
   - Full ERD (all tables)
   - Module ERDs (by feature)
   - Simplified ERDs (key relationships)

4. **Add Descriptions:**
   - Document complex relationships
   - Explain business rules
   - Note constraints

---

## Example: Generated ERD Structure

```
Kashaya Fabs ERP Database
├── User Management
│   ├── Users
│   ├── Roles
│   └── Permissions
├── Inventory Management
│   ├── Materials
│   ├── Fabrics
│   ├── Greige
│   └── Stock
├── Order Management
│   ├── Orders
│   ├── Customers
│   └── Shipments
├── Production Planning
│   ├── Styles
│   ├── BOM
│   └── Work Orders
└── Financial Management
    ├── Accounts
    ├── Taxes
    └── Transactions
```

---

## Troubleshooting

### Issue: ERD generation fails

**Solution:**
```bash
# Clear Prisma cache
rm -rf node_modules/.prisma
npx prisma generate
```

### Issue: Missing relationships in ERD

**Solution:**
```prisma
// Ensure relations are properly defined
model Fabric {
  id         String   @id @default(uuid())
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  supplierId String
}
```

### Issue: ERD too large to view

**Solution:**
- Generate separate ERDs per module
- Use dbdiagram.io for interactive viewing
- Export as high-resolution PDF

---

## Resources

- [Prisma ERD Generator](https://github.com/keonik/prisma-erd-generator)
- [dbdiagram.io](https://dbdiagram.io/)
- [SchemaSpy](https://schemaspy.org/)
- [Prisma Studio](https://www.prisma.io/studio)

---

**Maintained By:** Kashaya Fabs Development Team
**Last Review:** November 22, 2025
