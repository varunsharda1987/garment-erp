# Migration Summary: cad_averages → fabric_width_cad

## Quick Start

### Prerequisites
- ✅ Database backup completed
- ✅ Development environment ready
- ✅ Prisma schema updated
- ✅ Migration scripts ready

### Execution Steps

```bash
# 1. Backup database
pg_dump -U postgres -d garment_erp > backup_$(date +%Y%m%d).sql

# 2. Run data migration
cd backend
npx ts-node src/scripts/migrate-cad-averages-to-fabric-width-cad.ts

# 3. Verify migration
# Check migration logs in backend/migration-logs/

# 4. Generate Prisma client
npx prisma generate

# 5. Test application
npm run dev

# 6. Drop old table (after testing)
psql -U postgres -d garment_erp -f prisma/migrations/20250123_drop_cad_averages_table/migration.sql
```

---

## What Was Fixed

### ❌ Before: Inconsistent Naming

**cad_averages table used snake_case:**
- `style_fabric_id` ❌
- `fabric_width` ❌
- `cad_average_meters` ❌
- `cad_average_yards` ❌
- `cad_wastage_percent` ❌
- `marker_efficiency` ❌
- `marker_plan_file` ❌
- `is_preferred` ❌
- `created_at` ❌
- `updated_at` ❌

### ✅ After: Consistent Naming

**fabric_width_cad table uses camelCase:**
- `fabricId` ✅
- `availableWidth` ✅
- `cadMeters` ✅
- `cadYards` ✅
- `cadWastagePercent` ✅
- `markerEfficiency` ✅
- `markerPlanFile` ✅
- `isPreferred` ✅
- `createdAt` ✅
- `updatedAt` ✅

---

## Files Changed

### Backend
- ✅ [backend/src/controllers/style.controller.ts](backend/src/controllers/style.controller.ts)
  - Removed `cad_averages` nested creation
  - Changed includes to use `fabricCAD`
- ✅ [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
  - Commented out `cad_averages` model
  - Removed `cad_averages` relation from `style_fabrics`
- ✅ [backend/src/scripts/migrate-cad-averages-to-fabric-width-cad.ts](backend/src/scripts/migrate-cad-averages-to-fabric-width-cad.ts) (NEW)
  - Data migration script

### Frontend
- ✅ [frontend/src/types/style.types.ts](frontend/src/types/style.types.ts)
  - Added `FabricWidthCAD` interface
  - Marked `CadAverage` as DEPRECATED
  - Updated `StyleFabric` interface
  - Updated form data interfaces

### Migrations
- ✅ [backend/prisma/migrations/20250123_drop_cad_averages_table/migration.sql](backend/prisma/migrations/20250123_drop_cad_averages_table/migration.sql)
  - SQL script to drop old table

### Documentation
- ✅ [backend/MIGRATION_GUIDE_CAD_AVERAGES.md](backend/MIGRATION_GUIDE_CAD_AVERAGES.md)
  - Comprehensive migration guide

---

## Naming Convention Rules

### ✅ CORRECT: camelCase
```
createdAt
updatedAt
fabricId
isActive
isPreferred
cadMeters
cadYards
markerPlanFile
```

### ❌ INCORRECT: snake_case
```
created_at
updated_at
fabric_id
is_active
is_preferred
cad_meters
cad_yards
marker_plan_file
```

### ✅ CORRECT: Table names use snake_case
```
style_fabrics
fabric_master
fabric_width_cad
style_components
```

### Summary
- **Table/Model Names:** `snake_case` ✅
- **Field Names:** `camelCase` ✅
- **TypeScript Properties:** `camelCase` ✅
- **API Responses:** `camelCase` ✅ (via serializer)

---

## Impact Analysis

### Breaking Changes
- ❌ `cad_averages` table structure changed
- ❌ Controller endpoints now return `fabricCAD` instead of `cadAverages`
- ❌ Database migration required

### Non-Breaking Changes
- ✅ API responses auto-converted to camelCase (serializer)
- ✅ Backward compatible TypeScript types (DEPRECATED interfaces kept)
- ✅ Frontend components will continue to work during transition

### Zero Impact
- ✅ Table names (still snake_case)
- ✅ Existing data preserved (migrated)
- ✅ API endpoint URLs unchanged

---

## Testing Checklist

### Pre-Migration
- [ ] Database backup created
- [ ] Migration script reviewed
- [ ] Test environment available

### During Migration
- [ ] Migration script runs without errors
- [ ] Log file shows 100% success rate
- [ ] No skipped records (or acceptable skipped count)

### Post-Migration
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] View existing styles
- [ ] Create new style
- [ ] Edit existing style
- [ ] View BOM report
- [ ] Generate cost sheet
- [ ] All CAD data displays correctly

### Final Steps
- [ ] Drop old `cad_averages` table
- [ ] Verify application still works
- [ ] Document migration completion
- [ ] Archive migration logs

---

## Rollback Plan

If issues are discovered:

1. **Stop services**
   ```bash
   # Stop backend and frontend
   ```

2. **Restore database**
   ```bash
   psql -U postgres -d garment_erp < backup_YYYYMMDD.sql
   ```

3. **Revert code changes**
   ```bash
   git checkout HEAD~1
   npm install
   npx prisma generate
   ```

4. **Restart services**
   ```bash
   npm run dev
   ```

---

## Next Steps After Migration

1. **Monitor for 1-2 weeks**
   - Watch for errors in logs
   - Collect user feedback
   - Test all CAD-related features

2. **Update frontend components** (Phase 2)
   - Refactor to use `fabricCAD` directly
   - Remove DEPRECATED interface usage
   - Update forms and displays

3. **Clean up code** (Phase 3)
   - Remove DEPRECATED interfaces
   - Delete migration scripts (archive logs)
   - Update documentation

4. **Performance review**
   - Measure query performance
   - Optimize if needed
   - Review database indexes

---

## Support & Resources

**Documentation:**
- Full guide: [backend/MIGRATION_GUIDE_CAD_AVERAGES.md](backend/MIGRATION_GUIDE_CAD_AVERAGES.md)
- Schema: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

**Migration Script:**
- Data migration: [backend/src/scripts/migrate-cad-averages-to-fabric-width-cad.ts](backend/src/scripts/migrate-cad-averages-to-fabric-width-cad.ts)
- SQL migration: [backend/prisma/migrations/20250123_drop_cad_averages_table/migration.sql](backend/prisma/migrations/20250123_drop_cad_averages_table/migration.sql)

**Logs:**
- Migration logs: `backend/migration-logs/cad-averages-migration-*.json`

---

**Migration Prepared:** 2025-01-23
**Status:** Ready to Execute
**Estimated Time:** 15-30 minutes
**Risk Level:** Medium (requires data migration)
