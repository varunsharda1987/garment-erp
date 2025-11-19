# Prisma Seed Scripts

This directory contains seed scripts for populating the database with initial and sample data.

## Available Seeds

### 1. Phase 2 Fabric Migration (`phase2-fabric-migration.ts`)

**Purpose**: Migrate existing `style_fabrics` data to the new fabric master system.

**What it does**:
- Extracts unique fabric specifications from existing `style_fabrics` table
- Creates `greige_master` records for base fabrics
- Creates `fabric_master` records for finished fabrics
- Migrates `cad_averages` data to `fabric_width_cad` table
- Links `style_fabrics` to `fabric_master` via `fabricId`
- Creates `materials` entries for all fabrics

**When to run**: After Phase 1 schema migration is complete and before starting Phase 3 backend development.

**Usage**:
```bash
cd backend
npx ts-node prisma/seeds/phase2-fabric-migration.ts
```

**Important Notes**:
- Review migrated data after running
- Update default values (costs, suppliers, specifications)
- This script is idempotent - safe to run multiple times
- Creates a migration user if no admin exists

### 2. Sample Fabric Workflow (`sample-fabric-workflow.ts`)

**Purpose**: Create a complete example workflow demonstrating all fabric lifecycle features.

**What it does**:
- Creates sample supplier and processing mill
- Creates greige master (100% Cotton Poplin)
- Creates sample style and order
- Demonstrates:
  - Greige procurement (800m for order + 200m MOQ excess)
  - Processing (greige → navy blue finished)
  - Quality inspection (A-grade + defects)
  - Stock management with quality grading
  - Stock allocation
  - Transaction tracking

**When to run**: After Phase 2 migration, for testing and demonstration purposes.

**Usage**:
```bash
cd backend
npx ts-node prisma/seeds/sample-fabric-workflow.ts
```

**Important Notes**:
- Requires at least one customer in the database
- Creates demonstration data for testing
- Shows complete workflow from procurement to allocation

## Running Seeds in Order

For a fresh database setup:

```bash
# 1. Run Prisma migrations
cd backend
npx prisma db push

# 2. Run Phase 2 migration (if you have existing style_fabrics data)
npx ts-node prisma/seeds/phase2-fabric-migration.ts

# 3. Run sample workflow (for testing/demonstration)
npx ts-node prisma/seeds/sample-fabric-workflow.ts
```

## Seed Script Structure

All seed scripts follow this pattern:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed logic here
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Creating New Seed Scripts

1. Create a new `.ts` file in this directory
2. Follow the pattern above
3. Use descriptive console logging for progress tracking
4. Make scripts idempotent (safe to run multiple times)
5. Add error handling for edge cases
6. Document the script in this README

## Troubleshooting

### "No admin user found"
- Create an admin user first using the application
- Or modify the seed script to create a temporary user

### "Module not found" errors
- Ensure you're in the `backend` directory
- Run `npm install` if dependencies are missing
- Check TypeScript configuration

### Foreign key constraint errors
- Ensure required data exists (users, customers, etc.)
- Run seeds in the correct order
- Check database state before running

### Permission errors on Windows
- Close any running backend servers
- Run command prompt as administrator if needed
- Check file locks on Prisma client

## Data Validation

After running seeds, validate with these queries:

```sql
-- Check greige masters
SELECT * FROM greige_master;

-- Check fabric masters with greige relationship
SELECT fm.*, gm.greige_name
FROM fabric_master fm
LEFT JOIN greige_master gm ON fm.greige_id = gm.id;

-- Check fabric stock with origin tracking
SELECT
  fs.*,
  fm.fabric_name,
  s.style_code,
  o.order_number
FROM fabric_stock fs
LEFT JOIN fabric_master fm ON fs.fabric_id = fm.id
LEFT JOIN styles s ON fs.origin_style_id = s.id
LEFT JOIN orders o ON fs.origin_order_id = o.id;

-- Check weighted average costing
SELECT
  fabric_id,
  SUM(quantity_available) as total_qty,
  AVG(weighted_avg_cost) as avg_cost
FROM fabric_stock
GROUP BY fabric_id;
```

## Next Steps After Seeding

1. **Review Data Quality**
   - Check all created records
   - Update default values (costs, specifications)
   - Assign proper suppliers

2. **Test Workflows**
   - Create procurement orders
   - Process greige to finished
   - Perform quality inspections
   - Allocate stock to orders

3. **Implement Backend Services**
   - WeightedAverageCostService
   - StockAgingService
   - CrossStyleAllocationService
   - Quality grading logic

4. **Build Frontend UI**
   - Procurement planning screen
   - Stock dashboard
   - Quality inspection forms
   - Processing workflow tracker

## References

- [PHASE_1_MIGRATION_COMPLETE.md](../../../PHASE_1_MIGRATION_COMPLETE.md) - Phase 1 completion details
- [FABRIC_MATERIALS_INTEGRATION_STATUS.md](../../../FABRIC_MATERIALS_INTEGRATION_STATUS.md) - Integration status
- [COMPLETE_FABRIC_INTEGRATION_PLAN.md](../../../COMPLETE_FABRIC_INTEGRATION_PLAN.md) - Master plan
