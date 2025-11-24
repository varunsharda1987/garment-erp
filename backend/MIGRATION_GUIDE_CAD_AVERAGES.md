# Migration Guide: cad_averages → fabric_width_cad

## Overview

This guide provides step-by-step instructions for migrating from the deprecated `cad_averages` table to the new `fabric_width_cad` table structure.

**Migration Date:** 2025-01-23
**Status:** Ready to execute
**Breaking Changes:** Yes - requires data migration and code updates

---

## What Changed

### Schema Changes

#### BEFORE (cad_averages - DEPRECATED)
```prisma
model cad_averages {
  id                  String   @id
  style_fabric_id     String   // ❌ Tied to style_fabrics
  fabric_width        Decimal  // ❌ snake_case
  cad_average_meters  Decimal? // ❌ snake_case
  cad_average_yards   Decimal? // ❌ snake_case
  cad_wastage_percent Decimal? // ❌ snake_case
  marker_efficiency   Decimal? // ❌ snake_case
  marker_plan_file    String?  // ❌ snake_case
  is_preferred        Boolean  // ❌ snake_case
  created_at          DateTime // ❌ snake_case
  updated_at          DateTime // ❌ snake_case
}
```

**Problems:**
- ❌ Uses **snake_case** (inconsistent with rest of schema)
- ❌ Tied to `style_fabrics` (duplicates CAD data per style)
- ❌ No centralized fabric management
- ❌ Limited fields for production tracking

#### AFTER (fabric_width_cad - NEW)
```prisma
model fabric_width_cad {
  id                   String   @id
  fabricId             String   // ✅ Tied to fabric_master (centralized)
  availableWidth       Decimal  // ✅ camelCase
  cadMeters            Decimal? // ✅ camelCase
  cadYards             Decimal? // ✅ camelCase
  cadWastagePercent    Decimal  // ✅ camelCase
  markerEfficiency     Decimal? // ✅ camelCase
  markerPlanFile       String?  // ✅ camelCase
  isPreferred          Boolean  // ✅ camelCase
  actualCad            Decimal? // ✅ NEW: Production tracking
  cadVariancePercent   Decimal? // ✅ NEW: Variance analysis
  supplierAvailability String?  // ✅ NEW: Procurement info
  priceDifferential    Decimal? // ✅ NEW: Costing
  createdById          String   // ✅ NEW: Audit trail
  createdAt            DateTime // ✅ camelCase
  updatedAt            DateTime // ✅ camelCase
}
```

**Benefits:**
- ✅ **Consistent camelCase** naming
- ✅ **Centralized CAD management** (one record per fabric+width)
- ✅ **Enhanced tracking** (actual vs planned CAD)
- ✅ **Better procurement** planning fields
- ✅ **Audit trail** with createdById

---

## Migration Steps

### Step 1: Backup Database

```bash
# PostgreSQL backup
pg_dump -U postgres -d garment_erp > backup_before_cad_migration_$(date +%Y%m%d).sql

# Or using psql
psql -U postgres -d garment_erp -c "SELECT * FROM cad_averages;" > cad_averages_backup.csv
```

### Step 2: Verify Current State

```bash
cd backend

# Check for cad_averages records
psql -U postgres -d garment_erp -c "SELECT COUNT(*) FROM cad_averages;"

# Check style_fabrics with cad_averages
psql -U postgres -d garment_erp -c "
  SELECT sf.id, sf.\"fabricId\", COUNT(ca.id) as cad_count
  FROM style_fabrics sf
  LEFT JOIN cad_averages ca ON ca.style_fabric_id = sf.id
  GROUP BY sf.id, sf.\"fabricId\";
"
```

### Step 3: Run Data Migration Script

```bash
cd backend

# Install dependencies if needed
npm install

# Run the migration script
npx ts-node src/scripts/migrate-cad-averages-to-fabric-width-cad.ts
```

**Expected Output:**
```
🔄 Starting migration from cad_averages to fabric_width_cad...
📊 Found X cad_averages records to migrate

📝 Processing cad_averages record: xxx-xxx-xxx
   Style Fabric ID: yyy-yyy-yyy
   Fabric Width: 44
   ✅ Created fabric_width_cad record: zzz-zzz-zzz
   ✅ Updated style_fabrics.fabricCADId to zzz-zzz-zzz

============================================================
📊 MIGRATION SUMMARY
============================================================
Total records processed: X
✅ Successfully migrated: X
⚠️  Skipped: 0
❌ Errors: 0
============================================================

📄 Detailed log saved to: ./migration-logs/cad-averages-migration-TIMESTAMP.json
```

### Step 4: Review Migration Log

```bash
# Check the migration log
cat backend/migration-logs/cad-averages-migration-*.json
```

The log contains:
- Summary (total, migrated, skipped, errors)
- Details for each record (success/skipped/error with reasons)

### Step 5: Verify Migration Success

```bash
# Connect to database
psql -U postgres -d garment_erp

-- Check fabric_width_cad records were created
SELECT COUNT(*) FROM fabric_width_cad;

-- Check style_fabrics now reference fabric_width_cad
SELECT
  COUNT(*) as total_style_fabrics,
  COUNT("fabricCADId") as linked_to_cad
FROM style_fabrics;

-- View sample migrated data
SELECT
  fwc.id,
  fwc."fabricId",
  fwc."availableWidth",
  fwc."cadMeters",
  fwc."isPreferred",
  sf.id as style_fabric_id
FROM fabric_width_cad fwc
JOIN style_fabrics sf ON sf."fabricCADId" = fwc.id
LIMIT 10;
```

### Step 6: Update Prisma Schema

The schema has already been updated in `backend/prisma/schema.prisma`:
- ✅ `cad_averages` model is commented out
- ✅ `style_fabrics.cad_averages` relation removed
- ✅ `style_fabrics.fabricCAD` relation exists

Generate Prisma client:
```bash
cd backend
npx prisma generate
```

### Step 7: Drop cad_averages Table (DESTRUCTIVE)

⚠️ **WARNING:** This is irreversible. Only proceed after verifying migration success.

```bash
cd backend

# Run the SQL migration
psql -U postgres -d garment_erp -f prisma/migrations/20250123_drop_cad_averages_table/migration.sql
```

Or manually:
```sql
DROP TABLE IF EXISTS "cad_averages" CASCADE;
```

### Step 8: Test Application

```bash
# Start backend server
cd backend
npm run dev

# Start frontend server (in another terminal)
cd frontend
npm run dev
```

Test these features:
1. ✅ View existing styles with fabric CAD data
2. ✅ Create new styles (should use fabric_width_cad)
3. ✅ Edit existing styles
4. ✅ View BOM reports
5. ✅ Generate cost sheets

---

## Code Changes Summary

### Backend Changes

#### ✅ Controllers Updated
- `backend/src/controllers/style.controller.ts`
  - Line 91-102: Removed `cad_averages` creation logic
  - Line 158-159: Changed include from `cad_averages` to `fabricCAD`
  - Line 394-395: Changed include in update endpoint
  - Line 734-735: Changed include in draft endpoint

#### ✅ Services
- No service files were using `cad_averages` directly ✅

#### ✅ Schema
- `backend/prisma/schema.prisma`
  - Line 932: Removed `cad_averages` relation from `style_fabrics`
  - Line 939-957: Commented out `cad_averages` model

### Frontend Changes

#### ✅ Types Updated
- `frontend/src/types/style.types.ts`
  - Line 73-88: Marked `CadAverage` interface as DEPRECATED
  - Line 91-112: Added new `FabricWidthCAD` interface
  - Line 114-143: Updated `StyleFabric` interface
  - Line 260-270: Marked `CadAverageFormData` as DEPRECATED
  - Line 273-284: Added new `FabricWidthCADFormData` interface
  - Line 286-307: Updated `FabricFormData` interface

#### ⚠️ Components (Backward Compatible)
The following components still use the DEPRECATED interfaces but will continue to work:
- `frontend/src/pages/StyleForm.tsx`
- `frontend/src/pages/CadAverageManagement.tsx`
- `frontend/src/pages/BOMForm.tsx`
- `frontend/src/pages/CostSheetForm.tsx`
- `frontend/src/components/FabricWidthComparison.tsx`

**Note:** These components should be updated to use `fabricCAD` instead of `cadAverages` in a future update.

---

## Rollback Plan

If issues are discovered after migration:

### Option 1: Restore from Backup (RECOMMENDED)

```bash
# Restore entire database
psql -U postgres -d garment_erp < backup_before_cad_migration_YYYYMMDD.sql

# Or restore just the table
# (only if you haven't dropped the table yet)
```

### Option 2: Reverse Migration Script

A reverse migration script can be created if needed:

```typescript
// backend/src/scripts/rollback-cad-migration.ts
// This would:
// 1. Recreate cad_averages table
// 2. Copy data from fabric_width_cad back to cad_averages
// 3. Update style_fabrics references
```

---

## Post-Migration Cleanup

After successful migration and testing (1-2 weeks):

1. **Remove deprecated TypeScript interfaces:**
   - Delete `CadAverage` interface
   - Delete `CadAverageFormData` interface
   - Remove deprecated fields from `StyleFabric`

2. **Update frontend components:**
   - Refactor to use `fabricCAD` instead of `cadAverages`
   - Update forms to reference fabric_width_cad

3. **Remove migration scripts:**
   - Archive `migrate-cad-averages-to-fabric-width-cad.ts`
   - Keep migration logs for audit trail

---

## Troubleshooting

### Issue: "style_fabrics.fabricId is null"

**Cause:** Some style_fabrics haven't been migrated to fabric_master yet.

**Solution:**
```sql
-- Find affected records
SELECT id, "fabricName", "fabricType"
FROM style_fabrics
WHERE "fabricId" IS NULL;

-- These records will be skipped during CAD migration
-- They can be manually linked to fabric_master later
```

### Issue: "Migration skipped many records"

**Cause:** style_fabrics records don't have fabricId references.

**Solution:**
1. Run fabric migration first
2. Re-run CAD migration script

### Issue: "Duplicate fabric_width_cad records"

**Cause:** Multiple cad_averages for same fabric+width combination.

**Solution:**
The migration script handles this by:
1. Checking for existing fabric_width_cad record
2. Linking style_fabrics to existing record instead of creating duplicate

---

## Success Criteria

✅ All cad_averages data migrated to fabric_width_cad
✅ All style_fabrics.fabricCADId references set
✅ Zero errors in migration log
✅ Application runs without errors
✅ Existing styles display correctly
✅ New styles can be created
✅ cad_averages table dropped
✅ Consistent camelCase naming achieved

---

## Support

**Migration Issues:** Check `backend/migration-logs/` for detailed logs
**Schema Questions:** Review `backend/prisma/schema.prisma` comments
**Code Questions:** Search for `DEPRECATED` comments in codebase

---

**Last Updated:** 2025-01-23
**Next Review:** After successful production migration
