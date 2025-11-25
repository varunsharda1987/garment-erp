# Phase 1: Material System Foundation - Implementation Documentation

**Date Started:** January 23, 2025
**Status:** In Progress
**Objective:** Implement specialized material tracking for Lace, Buttons, and Threads with auto-generated codes and bulk import capabilities.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Database Schema Changes](#database-schema-changes)
4. [Code Generation Strategy](#code-generation-strategy)
5. [Implementation Progress](#implementation-progress)
6. [API Endpoints](#api-endpoints)
7. [Testing Checklist](#testing-checklist)
8. [Next Phases](#next-phases)

---

## Overview

### Problem Statement
- Need specialized tracking for Lace, Buttons, and Threads materials
- Each type has unique attributes (width, color, size, holes, thread count, etc.)
- Bulk import capability required with minimal required fields
- Consistent code generation across all material types

### Solution
- Create dedicated master tables: `lace_master`, `button_master`, `thread_master`
- Implement auto-code generation utility (LACE-0001, BTN-0001, THR-0001)
- Polymorphic linking through `materials` table using `materialType` enum
- Bulk import with automatic material entry creation

---

## Architecture Decisions

### 1. Code Generation Strategy
**Decision:** All material codes are system-generated, not user-provided
**Rationale:**
- Ensures consistency across all material types
- Prevents duplicate codes
- Simplifies bulk import (only name required)
- Users can optionally provide `supplierCode` or `buyerCode` for external reference

**Code Pattern:**
```
LACE-0001, LACE-0002, ...
BTN-0001, BTN-0002, ...
THR-0001, THR-0002, ...
STY-0001 (for styles - future)
```

### 2. Polymorphic Material Design
**Decision:** Keep specialized master tables + unified materials table
**Rationale:**
- Master tables (lace_master, button_master, thread_master) store detailed specs
- Materials table acts as universal container for BOM usage
- MaterialType enum discriminates between types
- Allows both specialized queries and unified inventory tracking

**Data Flow:**
```
lace_master (LACE-0001, detailed specs)
    ↓
materials (materialType=LACE, laceId=lace_master.id)
    ↓
bom_items (uses materials.id)
```

### 3. Minimal Bulk Import Fields
**Decision:** Only `name` field required in Excel, all else optional
**Rationale:**
- Reduces data entry burden
- System handles code generation
- Optional fields can be filled later via UI
- Enables quick mass import of existing inventory

---

## Database Schema Changes

### New Tables Created

#### 1. lace_master
```sql
CREATE TABLE "lace_master" (
  "id" TEXT PRIMARY KEY,
  "laceCode" TEXT UNIQUE NOT NULL,  -- Auto-generated: LACE-0001
  "laceName" TEXT NOT NULL,          -- Required
  "supplierCode" TEXT,               -- Optional: Supplier's reference
  "buyerCode" TEXT,                  -- Optional: Buyer's reference
  "width" DECIMAL(10,2),             -- Optional: Width in inches
  "design" TEXT,                     -- Optional: Pattern description
  "color" TEXT,                      -- Optional
  "composition" TEXT,                -- Optional: Material composition
  "pricePerMeter" DECIMAL(10,2),    -- Optional
  "image" TEXT,                      -- Optional
  "supplierId" TEXT,                 -- Optional: FK to suppliers
  "description" TEXT,                -- Optional
  "isActive" BOOLEAN DEFAULT true,
  "createdById" TEXT,                -- FK to users
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);
```

#### 2. button_master
```sql
CREATE TABLE "button_master" (
  "id" TEXT PRIMARY KEY,
  "buttonCode" TEXT UNIQUE NOT NULL, -- Auto-generated: BTN-0001
  "buttonName" TEXT NOT NULL,        -- Required
  "supplierCode" TEXT,               -- Optional
  "buyerCode" TEXT,                  -- Optional
  "size" TEXT,                       -- Optional: e.g., "15mm", "18L"
  "holes" INTEGER,                   -- Optional: 2, 4, or NULL for shank
  "color" TEXT,                      -- Optional
  "material" TEXT,                   -- Optional: Plastic, Metal, Wood, Shell
  "shape" TEXT,                      -- Optional: Round, Square, Oval
  "pricePerPiece" DECIMAL(10,2),    -- Optional
  "pricePerGross" DECIMAL(10,2),    -- Optional
  "image" TEXT,                      -- Optional
  "supplierId" TEXT,                 -- Optional: FK to suppliers
  "description" TEXT,                -- Optional
  "isActive" BOOLEAN DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);
```

#### 3. thread_master
```sql
CREATE TABLE "thread_master" (
  "id" TEXT PRIMARY KEY,
  "threadCode" TEXT UNIQUE NOT NULL, -- Auto-generated: THR-0001
  "threadName" TEXT NOT NULL,        -- Required
  "supplierCode" TEXT,               -- Optional
  "buyerCode" TEXT,                  -- Optional
  "threadCount" TEXT,                -- Optional: e.g., "40s", "60s"
  "color" TEXT,                      -- Optional
  "colorCode" TEXT,                  -- Optional: Pantone code
  "composition" TEXT,                -- Optional: Polyester, Cotton
  "threadType" TEXT,                 -- Optional: Sewing, Embroidery
  "coneSize" TEXT,                   -- Optional: e.g., "5000m"
  "pricePerCone" DECIMAL(10,2),     -- Optional
  "image" TEXT,                      -- Optional
  "supplierId" TEXT,                 -- Optional: FK to suppliers
  "description" TEXT,                -- Optional
  "isActive" BOOLEAN DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);
```

### Enum Updates

#### MaterialType Enum
```sql
ALTER TYPE "MaterialType" ADD VALUE 'LACE';
ALTER TYPE "MaterialType" ADD VALUE 'BUTTON';
-- THREAD already existed
```

**Full MaterialType Values:**
- GENERIC
- GREIGE_FABRIC
- FINISHED_FABRIC
- TRIMS
- **LACE** (new)
- **BUTTON** (new)
- THREAD
- ACCESSORIES
- PACKAGING
- SERVICE

### Materials Table Updates

```sql
ALTER TABLE "materials" ADD COLUMN "laceId" TEXT;
ALTER TABLE "materials" ADD COLUMN "buttonId" TEXT;
ALTER TABLE "materials" ADD COLUMN "threadId" TEXT;

-- Foreign keys
ALTER TABLE "materials" ADD CONSTRAINT "materials_laceId_fkey"
  FOREIGN KEY ("laceId") REFERENCES "lace_master"("id");

ALTER TABLE "materials" ADD CONSTRAINT "materials_buttonId_fkey"
  FOREIGN KEY ("buttonId") REFERENCES "button_master"("id");

ALTER TABLE "materials" ADD CONSTRAINT "materials_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "thread_master"("id");
```

### Styles Table Update

```sql
ALTER TABLE "styles" ADD COLUMN "buyerStyleCode" TEXT;
```
- System-generated: `styleCode` (STY-0001)
- User-provided: `buyerStyleCode` (optional external reference)

### Material Categories Seeded

```
Trims (Level 1) - Parent category
  ├─ Lace (Level 2)
  ├─ Buttons (Level 2)
  └─ Threads (Level 2)
```

**Category IDs:**
- `cat-trims` - Trims parent
- `cat-lace` - Lace subcategory
- `cat-buttons` - Buttons subcategory
- `cat-threads` - Threads subcategory

---

## Code Generation Strategy

### Implementation Files

**Utility:** `backend/src/utils/code-generator.ts`

**Key Functions:**
```typescript
// Generate next sequential code
async function generateCode(
  prefix: string,     // 'LACE', 'BTN', 'THR'
  tableName: string,  // 'lace_master', 'button_master'
  codeField: string,  // 'laceCode', 'buttonCode'
  padding: number = 4 // Default 4 digits
): Promise<string>

// Batch generation for bulk imports
async function generateBatchCodes(
  prefix: string,
  tableName: string,
  codeField: string,
  count: number
): Promise<string[]>

// Validation
function validateCodeFormat(code: string, prefix: string): boolean
```

**Code Generation Logic:**
1. Query database for last code with matching prefix
2. Extract number from code (e.g., LACE-0005 → 5)
3. Increment by 1
4. Pad with leading zeros (4 digits)
5. Return formatted code (LACE-0006)

**Concurrency Safety:**
- Sequential execution in bulk imports
- Pre-generate batch of codes before creating records
- No duplicate codes possible

---

## Implementation Progress

### ✅ Completed Tasks

1. **Code Generation Utility** - `backend/src/utils/code-generator.ts`
   - generateCode() function
   - generateBatchCodes() for bulk imports
   - validateCodeFormat() helper
   - extractCodeNumber() helper

2. **Database Migration** - `backend/prisma/migrations/20250123_add_lace_button_thread_masters.sql`
   - Created 3 new master tables
   - Updated MaterialType enum
   - Added FK columns to materials table
   - Created indexes
   - Seeded material categories
   - Added buyerStyleCode to styles

3. **Migration Runner** - `backend/src/scripts/run-phase1-migration-stepbystep.ts`
   - Executes migration step-by-step
   - Handles enum updates
   - Creates tables with proper constraints
   - Seeds categories with validation
   - Verification checks

### 🚧 In Progress

4. **Lace Controller** - `backend/src/controllers/lace.controller.ts`
   - Status: Starting implementation
   - Features: CRUD + bulk import + material creation

### 📋 Pending Tasks

5. **Lace Routes** - `backend/src/routes/lace.routes.ts`
6. **Button Controller** - `backend/src/controllers/button.controller.ts`
7. **Button Routes** - `backend/src/routes/button.routes.ts`
8. **Thread Controller** - `backend/src/controllers/thread.controller.ts`
9. **Thread Routes** - `backend/src/routes/thread.routes.ts`
10. **Excel Templates** - Downloadable templates for bulk import
11. **Frontend - Lace UI** - `frontend/src/pages/LaceList.tsx`
12. **Frontend - Button UI** - `frontend/src/pages/ButtonList.tsx`
13. **Frontend - Thread UI** - `frontend/src/pages/ThreadList.tsx`
14. **End-to-End Testing** - Test complete flow from import to BOM usage

---

## API Endpoints

### Lace Management

#### POST /api/materials/lace
Create single lace item
```json
Request:
{
  "laceName": "White Floral Lace 2inch",
  "supplierCode": "LC-001",  // Optional
  "width": 2.0,              // Optional
  "color": "White",          // Optional
  "design": "Floral"         // Optional
}

Response:
{
  "lace": {
    "id": "uuid",
    "laceCode": "LACE-0001",  // Auto-generated
    "laceName": "White Floral Lace 2inch",
    "supplierCode": "LC-001",
    "width": 2.0,
    "color": "White",
    "design": "Floral"
  },
  "material": {
    "id": "uuid",
    "code": "LACE-0001",      // Same as laceCode
    "name": "White Floral Lace 2inch",
    "materialType": "LACE",
    "laceId": "lace-id",
    "categoryId": "cat-lace",
    "unit": "METER"
  }
}
```

#### GET /api/materials/lace
List lace items with pagination and search

#### GET /api/materials/lace/:id
Get single lace item with material details

#### PUT /api/materials/lace/:id
Update lace item

#### DELETE /api/materials/lace/:id
Delete lace (checks if used in BOM first)

#### POST /api/materials/lace/bulk-import
Bulk import from Excel
```json
Request:
{
  "data": [
    {
      "laceName": "White Lace 2in",
      "supplierCode": "LC-001",  // Optional
      "width": 2.0,              // Optional
      "color": "White",          // Optional
      "stockQuantity": 100,      // Optional
      "locationCode": "WH-01"    // Optional
    }
  ],
  "createStock": true  // Optional flag
}

Response:
{
  "results": [
    {
      "success": true,
      "laceCode": "LACE-0001",
      "materialCode": "LACE-0001",
      "stockCreated": true
    }
  ],
  "summary": {
    "total": 1,
    "success": 1,
    "failed": 0
  }
}
```

#### GET /api/materials/lace/export-template
Download Excel template for bulk import

### Button Management
(Same pattern as Lace, substitute "lace" → "button", "LACE" → "BTN")

### Thread Management
(Same pattern as Lace, substitute "lace" → "thread", "LACE" → "THR")

---

## Testing Checklist

### Unit Tests

- [ ] Code generation utility
  - [ ] Generates LACE-0001 for first lace
  - [ ] Increments to LACE-0002, LACE-0003
  - [ ] Handles gaps (deleted records)
  - [ ] Batch generation produces sequential codes
  - [ ] Validates code format correctly

### Integration Tests

#### Lace
- [ ] Create lace via API → auto-generates LACE-0001
- [ ] Create material entry automatically
- [ ] Link laceId correctly
- [ ] Bulk import 10 lace items → generates LACE-0001 to LACE-0010
- [ ] Bulk import with stock creates stock_levels entries
- [ ] Search lace by name/code
- [ ] Update lace preserves code
- [ ] Delete lace fails if used in BOM
- [ ] Delete lace succeeds if not used

#### Buttons
- [ ] Create button via API → auto-generates BTN-0001
- [ ] Create material entry automatically
- [ ] Bulk import 10 buttons
- [ ] All operations same as Lace

#### Threads
- [ ] Create thread via API → auto-generates THR-0001
- [ ] Create material entry automatically
- [ ] Bulk import 10 threads
- [ ] All operations same as Lace

### End-to-End Tests

- [ ] Import 100+ lace items via Excel
- [ ] Verify all have sequential codes
- [ ] Verify all have material entries
- [ ] Create test style
- [ ] Add imported lace to style BOM
- [ ] Verify BOM calculations work
- [ ] Verify stock tracking works

### Frontend Tests

- [ ] Lace list page loads
- [ ] Shows system-generated codes (read-only)
- [ ] Shows optional supplier/buyer codes
- [ ] Add lace form works (only name required)
- [ ] Edit lace form pre-fills data
- [ ] Bulk import uploads Excel
- [ ] Shows import results/errors
- [ ] Same tests for Buttons and Threads

---

## Migration Files

### Created Files
1. `backend/prisma/migrations/20250123_add_lace_button_thread_masters.sql`
2. `backend/src/scripts/run-phase1-migration-stepbystep.ts`
3. `backend/src/utils/code-generator.ts`

### Rollback Plan
If Phase 1 needs to be rolled back:

```sql
-- Drop tables
DROP TABLE IF EXISTS "lace_master" CASCADE;
DROP TABLE IF EXISTS "button_master" CASCADE;
DROP TABLE IF EXISTS "thread_master" CASCADE;

-- Remove columns from materials
ALTER TABLE "materials" DROP COLUMN IF EXISTS "laceId";
ALTER TABLE "materials" DROP COLUMN IF EXISTS "buttonId";
ALTER TABLE "materials" DROP COLUMN IF EXISTS "threadId";

-- Remove from styles
ALTER TABLE "styles" DROP COLUMN IF EXISTS "buyerStyleCode";

-- Delete categories
DELETE FROM "material_categories" WHERE id IN ('cat-lace', 'cat-buttons', 'cat-threads', 'cat-trims');

-- Note: Cannot remove enum values in PostgreSQL without recreating the enum
```

---

## Next Phases

### Phase 2: Greige & Fabric Integration
- Update greige.controller.ts to auto-generate codes (GRG-0001)
- Update fabric.controller.ts to auto-generate codes (FAB-0001)
- Add `buyerCode`/`supplierCode` fields to both
- Implement auto-material creation on bulk import
- Test fabric → material → BOM flow

### Phase 3: Stock System Consolidation
- Decide: Use `stock_levels` or `fabric_stock` or both
- Document which table for which material type
- Implement unified stock API
- Add stock import/export capabilities

### Phase 4: Supplier Integration
- Link suppliers to all material types
- Multi-supplier support via junction tables
- Preferred supplier designation
- Purchase order integration

### Phase 5: Advanced Features
- Image upload for materials
- Barcode/QR code generation
- Price history tracking
- Supplier price comparison
- Material substitution suggestions

---

## Key Decisions Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2025-01-23 | Auto-generate all material codes | Consistency, no duplicates | Users don't provide codes |
| 2025-01-23 | Only name required in bulk import | Minimize data entry | Optional fields added later |
| 2025-01-23 | Keep specialized master tables | Need detailed specs per type | Polymorphic materials table |
| 2025-01-23 | Add buyerStyleCode to styles | External reference tracking | Consistency across all entities |
| 2025-01-23 | Use 4-digit padding (0001-9999) | Supports up to 9999 items/type | Expandable if needed |

---

## Contact & Support

**Implementation Team:** Claude (AI Assistant)
**Project:** Garment ERP - Kashaya Fabs
**Phase:** 1 - Material System Foundation

For questions or issues, refer to:
- This document: `docs/PHASE_1_MATERIALS_IMPLEMENTATION.md`
- Code generation utility: `backend/src/utils/code-generator.ts`
- Migration script: `backend/src/scripts/run-phase1-migration-stepbystep.ts`
- Database schema: `backend/prisma/schema.prisma`

---

**Last Updated:** January 23, 2025
**Status:** Migration Complete, Controller Implementation Starting
