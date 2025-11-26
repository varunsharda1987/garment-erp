# Style Redesign Migration Guide

This directory contains migration scripts for the Style Redesign feature implementation.

## Overview

The Style Redesign introduces a new workflow:
- **Generic Fabric Names** instead of direct greige selection
- **CAD Planning** as intermediate step before cost sheet generation
- **Unified Material BOM** merging garment trims and packaging
- **Workflow Status Management** with CAD approval gates

## Migration Scripts

### 1. migrate-style-redesign.ts

**Purpose:** Migrate existing data to support the new Style Redesign workflow

**What it does:**
1. Migrates `style_garment_trims` → `style_material_bom` (with `usageCategory: 'GARMENT_TRIM'`)
2. Migrates `style_packaging` → `style_material_bom` (with `usageCategory: 'PACKAGING'`)
3. Backfills `cadStatus` field for existing styles (sets to `PENDING`)
4. Backfills `gender` field for existing styles (analyzes naming patterns or defaults to `UNISEX`)

**How to run:**
```bash
cd backend
npx ts-node scripts/migrate-style-redesign.ts
```

**Expected output:**
```
🚀 Starting Style Redesign Data Migration
============================================================

📦 Step 1: Migrating garment trims to material BOM...
   Found 150 garment trim records
   ✅ Migrated 150 garment trims

📦 Step 2: Migrating packaging to material BOM...
   Found 80 packaging records
   ✅ Migrated 80 packaging items

📝 Step 3: Backfilling CAD status for existing styles...
   Found 245 styles without CAD status
   ✅ Set CAD status to PENDING for 245 styles

👔 Step 4: Backfilling gender field for existing styles...
   Found 200 styles without gender
   ✅ Backfilled gender for 200 styles

============================================================
📊 Migration Summary:
============================================================
✅ Garment trims migrated: 150
✅ Packaging migrated: 80
✅ CAD status backfilled: 245
✅ Gender backfilled: 200

✅ Migration completed successfully!
```

**Safety features:**
- ✅ Checks for existing migrated data before creating duplicates
- ✅ Handles missing legacy tables gracefully
- ✅ Logs all errors and continues processing
- ✅ Transaction-safe (each record migrated independently)

---

### 2. rollback-style-redesign.ts

**Purpose:** Rollback the Style Redesign migration if needed

**What it does:**
1. Deletes all migrated `style_material_bom` entries with `usageCategory` of `GARMENT_TRIM` or `PACKAGING`
2. Resets `cadStatus` to `null` for all styles
3. Resets `gender` to `null` for all styles

**How to run:**
```bash
cd backend
npx ts-node scripts/rollback-style-redesign.ts
```

**⚠️  WARNING:** This script will **DELETE** migrated data! Use with caution.

**Safety features:**
- ⚠️  Requires explicit confirmation before proceeding
- ✅ Shows preview of what will be deleted
- ✅ Transaction-safe operations

**Example interaction:**
```
🔙 Starting Style Redesign Rollback
============================================================

⚠️  WARNING: This will delete migrated data and reset CAD status and gender fields!

Are you sure you want to proceed with rollback? (yes/no): yes

✅ Rollback confirmed. Starting...
```

---

## Pre-Migration Checklist

Before running the migration, ensure:

- [ ] **Backup database:** Create a full database backup
  ```bash
  pg_dump -U postgres garment_erp > backup_before_migration.sql
  ```

- [ ] **Check Prisma schema:** Ensure the following fields exist in `schema.prisma`:
  - `Style.cadStatus` (enum: PENDING, IN_PROGRESS, APPROVED)
  - `Style.cadApprovedAt` (DateTime, nullable)
  - `Style.gender` (enum: MALE, FEMALE, UNISEX)
  - `style_material_bom` table with `usageCategory` field

- [ ] **Run Prisma migrations:** Apply any pending schema changes
  ```bash
  cd backend
  npx prisma migrate dev
  ```

- [ ] **Check legacy tables:** Verify the existence of legacy tables (if any):
  - `style_garment_trims`
  - `style_packaging`

---

## Post-Migration Verification

After running the migration, verify:

### 1. Check migrated material BOM:
```sql
SELECT
  usageCategory,
  COUNT(*) as count
FROM style_material_bom
GROUP BY usageCategory;
```

Expected results:
```
 usageCategory  | count
----------------+-------
 GARMENT_TRIM   | 150
 PACKAGING      | 80
 VALUE_ADDITION | 20
```

### 2. Check CAD status:
```sql
SELECT
  cadStatus,
  COUNT(*) as count
FROM style
GROUP BY cadStatus;
```

Expected results:
```
 cadStatus | count
-----------+-------
 PENDING   | 245
```

### 3. Check gender distribution:
```sql
SELECT
  gender,
  COUNT(*) as count
FROM style
GROUP BY gender;
```

Expected results:
```
  gender  | count
----------+-------
 MALE     | 80
 FEMALE   | 95
 UNISEX   | 70
```

### 4. Verify no data loss:
```sql
-- Check total material count before and after
SELECT COUNT(*) FROM style_garment_trims;  -- Legacy table
SELECT COUNT(*) FROM style_packaging;       -- Legacy table
SELECT COUNT(*) FROM style_material_bom WHERE usageCategory IN ('GARMENT_TRIM', 'PACKAGING');
```

The sum from legacy tables should match the migrated count.

---

## Rollback Procedure

If issues are discovered after migration:

### Option 1: Automated Rollback (Recommended)
```bash
cd backend
npx ts-node scripts/rollback-style-redesign.ts
```

### Option 2: Manual Database Restore
```bash
# Restore from backup
psql -U postgres garment_erp < backup_before_migration.sql
```

---

## Troubleshooting

### Issue: "Table 'style_garment_trims' does not exist"
**Solution:** This is expected if you never had legacy tables. The script will skip gracefully.

### Issue: Migration fails midway
**Solution:**
1. Check the error logs printed by the script
2. Fix the underlying issue (e.g., missing foreign keys)
3. Re-run the migration script (it will skip already-migrated records)

### Issue: Duplicate entries created
**Solution:**
1. Run rollback script
2. Investigate the duplicate detection logic
3. Re-run migration

---

## Support

For issues or questions:
1. Check the migration logs for detailed error messages
2. Review the `stats.errors` array printed at the end
3. Contact the development team with:
   - Full migration log output
   - Database version and Prisma client version
   - Error stack traces

---

## Migration Timeline Estimate

For a database with 250 styles and 230 material records:

| Step                      | Estimated Time |
|---------------------------|----------------|
| Backup database           | 30 seconds     |
| Run migration script      | 2-5 minutes    |
| Verification queries      | 1 minute       |
| **Total**                 | **4-7 minutes**|

For larger databases (1000+ styles), allow 10-15 minutes.

---

## Version History

| Version | Date       | Changes                                    |
|---------|------------|--------------------------------------------|
| 1.0     | 2025-01-25 | Initial migration scripts created          |

---

## Next Steps After Migration

After successful migration:

1. ✅ **Test the new workflow:**
   - Create a new style using `StyleFormRedesigned`
   - Complete CAD Planning
   - Generate cost sheet from approved CAD

2. ✅ **Update existing styles:**
   - Review styles with `PENDING` CAD status
   - Complete CAD planning for active styles
   - Archive old/inactive styles

3. ✅ **Train users:**
   - Demonstrate the new workflow
   - Explain CAD Planning importance
   - Show auto-generation benefits

4. ✅ **Monitor for issues:**
   - Check error logs daily for first week
   - Gather user feedback
   - Address any edge cases discovered
