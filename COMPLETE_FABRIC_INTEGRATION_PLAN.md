# Complete Fabric/Greige/Materials Integration Plan
## Master Implementation Document

**Last Updated:** 2025-11-19
**Status:** In Progress - Phase 1A (Schema Foundation)
**Approved By:** User

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [What Has Been Completed](#what-has-been-completed)
3. [Current Architecture Issues](#current-architecture-issues)
4. [Complete Solution Architecture](#complete-solution-architecture)
5. [Detailed Implementation Phases](#detailed-implementation-phases)
6. [Business Rules & Workflows](#business-rules--workflows)
7. [Next Steps](#next-steps)

---

## Executive Summary

### The Problem
The system currently has **three disconnected fabric management approaches**:
1. **Generic Materials Module** - Cannot distinguish fabric types
2. **Separate Fabric/Greige Masters** - Isolated from other modules
3. **Hardcoded Style Fabrics** - Duplicate data, manual entry

This causes:
- ❌ BOM cannot reference fabric masters
- ❌ Cost sheets use manual string parsing
- ❌ Duplicate CAD data entry per style
- ❌ No stock management for fabrics
- ❌ No greige-to-fabric lifecycle tracking
- ❌ No weighted average costing

### The Solution
**Unified Polymorphic Architecture** combining:
- Materials as universal container (with type discrimination)
- Fabric/Greige lifecycle management
- Stock management with weighted average costing
- CAD variance tracking
- Quality grading system
- Mill-specific shrinkage patterns

---

## What Has Been Completed

### ✅ Phase 1A: Schema Foundation (COMPLETED)

#### 1. MaterialType Enum Created
**File:** `backend/prisma/schema.prisma` (Line ~1485)
**Status:** ✅ COMPLETED

```prisma
enum MaterialType {
  GENERIC          // Regular materials (trims, threads, accessories, etc.)
  GREIGE_FABRIC    // Raw/unfinished fabric - references greige_master
  FINISHED_FABRIC  // Dyed/printed/finished fabric - references fabric_master
  TRIMS            // Buttons, zippers, labels, etc.
  THREAD           // Sewing thread, embroidery thread
  ACCESSORIES      // Tags, hangers, poly bags
  PACKAGING        // Boxes, cartons
  SERVICE          // Subcontracting services
}
```

**Purpose:** Enables materials table to discriminate between different material types and route to appropriate specialized tables.

---

#### 2. Materials Model Extended
**File:** `backend/prisma/schema.prisma` (Line ~329)
**Status:** ✅ COMPLETED

**New Fields Added:**
```prisma
model materials {
  // ... existing fields ...

  // Polymorphic Material Type Support
  materialType    MaterialType  @default(GENERIC)
  greigeId        String?       // For GREIGE_FABRIC type
  fabricId        String?       // For FINISHED_FABRIC type

  // Polymorphic fabric/greige references
  greige_master   greige_master?  @relation(fields: [greigeId], references: [id])
  fabric_master   fabric_master?  @relation(fields: [fabricId], references: [id])

  @@index([materialType])
  @@index([greigeId])
  @@index([fabricId])
}
```

**Benefits:**
- Single materials table acts as universal container
- Type-based routing to specialized fabric/greige data
- BOM can now reference fabric materials
- Inventory tracking unified

---

#### 3. Greige Master Extended
**File:** `backend/prisma/schema.prisma` (Line ~1852)
**Status:** ✅ COMPLETED

**New Relation Added:**
```prisma
model greige_master {
  // ... existing fields ...

  materials  materials[]  // Reverse relation
}
```

**Purpose:** Enables querying which materials reference this greige master.

---

#### 4. Fabric Master Extended
**File:** `backend/prisma/schema.prisma` (Line ~1901)
**Status:** ✅ COMPLETED

**New Relation Added:**
```prisma
model fabric_master {
  // ... existing fields ...

  materials  materials[]  // Reverse relation
}
```

**Purpose:** Enables querying which materials reference this fabric master.

---

#### 5. BOM Items Enhanced for CAD Integration
**File:** `backend/prisma/schema.prisma` (Line ~47)
**Status:** ✅ COMPLETED

**New Fields Added:**
```prisma
model bom_items {
  // ... existing fields ...

  // Fabric CAD Integration - Optional reference to specific CAD width
  fabricCADId  String?             // References fabric_width_cad
  fabricCAD    fabric_width_cad?   @relation(fields: [fabricCADId], references: [id])

  @@index([fabricCADId])
}
```

**Benefits:**
- BOM items can specify exact fabric width
- Automatic cost calculation from CAD data
- Width-specific material requirements
- Eliminates manual CAD entry per style

---

#### 6. Fabric Width CAD Extended
**File:** `backend/prisma/schema.prisma` (Line ~1961)
**Status:** ✅ COMPLETED

**New Relation Added:**
```prisma
model fabric_width_cad {
  // ... existing fields ...

  bom_items  bom_items[]  // Reverse relation
}
```

**Purpose:** Track which BOM items are using this specific CAD configuration.

---

#### 7. Frontend Pages Created (COMPLETED)
**Status:** ✅ COMPLETED

| Page | File | Status | Purpose |
|------|------|--------|---------|
| Greige List | `frontend/src/pages/GreigeList.tsx` | ✅ | View/manage greige masters |
| Greige Form | `frontend/src/pages/GreigeForm.tsx` | ✅ | Create/edit greige |
| Fabric List | `frontend/src/pages/FabricList.tsx` | ✅ | View/manage fabrics |
| Fabric Form | `frontend/src/pages/FabricForm.tsx` | ✅ | Create/edit fabrics |
| CAD Management | `frontend/src/pages/CadAverageManagement.tsx` | ✅ | Manage CAD widths |

**Navigation Added:**
- Sidebar → Masters → Greige Fabric
- Sidebar → Masters → Finished Fabric

**Issues Fixed:**
- ✅ Authentication token retrieval (Zustand store)
- ✅ Layout wrapper removed (nested routes)
- ✅ PageHeader TypeScript import
- ✅ Numeric value rendering (React object error)

---

## Current Architecture Issues

### ❌ NOT YET FIXED

#### 1. Style Fabrics - Hardcoded Architecture
**File:** `backend/prisma/schema.prisma` (Line ~762)
**Status:** ❌ BROKEN - Needs complete refactor

**Current Problems:**
```prisma
model style_fabrics {
  // HARDCODED STRINGS (should be lookups):
  fabricName       String  // ❌ Should reference fabric_master
  fabricType       String  // ❌ Should come from fabric_master
  fabricColor      String  // ❌ Should come from fabric_master.colorName
  fabricGSM        String  // ❌ Should come from fabric_master.actualGSM
  greigeName       String  // ❌ Should come from fabric_master.greige.greigeName
  supplierName     String  // ❌ Should come from supplier relation

  // DUPLICATE CAD TABLE:
  cad_averages  cad_averages[]  // ❌ Duplicates fabric_width_cad
}
```

**Impact:**
- Changes to fabric_master don't propagate to styles
- Duplicate CAD data entry per style
- Manual updates required when fabric details change
- Data inconsistency

---

#### 2. Cost Sheet - Manual Parsing
**File:** `backend/src/controllers/styleCosting.controller.ts`
**File:** `frontend/src/pages/CostSheetForm.tsx` (Line 310-329)
**Status:** ❌ BROKEN

**Current Approach:**
```typescript
// FRAGILE STRING PARSING:
const materialName = item.material?.name || 'Unknown Material';
const extractedWidth = parseFloat(materialName.match(/\d+/)?.[0] || '0');
```

**Problems:**
- Breaks if material name format changes
- Cannot validate against actual fabric masters
- No real-time CAD updates
- Error-prone calculations

---

#### 3. Stock Management - Missing
**Status:** ❌ DOES NOT EXIST

**Critical Gaps:**
- No fabric stock tracking
- No weighted average costing
- No aging alerts
- No quality grading
- No cross-style allocation
- No mill-specific shrinkage tracking

---

## Complete Solution Architecture

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     MATERIALS (Universal Container)          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ materialType = GREIGE_FABRIC   → greigeId → greige_master│
│  │ materialType = FINISHED_FABRIC → fabricId → fabric_master│
│  │ materialType = GENERIC         → (standalone)          │  │
│  │ materialType = TRIMS           → (standalone)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────────┐
        │              BOM ITEMS                    │
        │  - materialId → materials                 │
        │  - fabricCADId → fabric_width_cad (if fabric)│
        │  - Auto-calculate cost from CAD           │
        └──────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────────┐
        │         FABRIC PROCUREMENT                │
        │  - Buy GREIGE or FINISHED                 │
        │  - MOQ excess tracking                    │
        │  - Origin style/order reference           │
        │  - Creates fabric_stock entries           │
        └──────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────────┐
        │          FABRIC PROCESSING                │
        │  - Greige → Finished lifecycle            │
        │  - Mill-specific shrinkage tracking       │
        │  - Width variance recording               │
        │  - Cost accumulation                      │
        └──────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────────┐
        │           FABRIC STOCK                    │
        │  - Weighted average costing               │
        │  - Quality grading (A/B/Defect)           │
        │  - Aging alerts (6+ months)               │
        │  - Origin tracking                        │
        │  - Cross-style allocation                 │
        └──────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────────┐
        │      FABRIC STOCK ALLOCATION              │
        │  - Reserve for orders                     │
        │  - CAD variance tracking                  │
        │  - Consumption vs plan                    │
        └──────────────────────────────────────────┘
```

---

## Detailed Implementation Phases

### PHASE 1: Database Schema (Week 1)

#### Phase 1B: Remaining Core Tables (PENDING)

##### 7. fabric_procurement Table
**Status:** ⏳ PENDING
**Priority:** HIGH

```prisma
model fabric_procurement {
  id                    String   @id @default(uuid())

  // Procurement Details
  procurement_type      String   // "GREIGE", "FINISHED"
  purchase_order_number String?
  supplier_id           String

  // Fabric Reference
  greige_id             String?  // If bought as greige
  fabric_id             String?  // If bought as finished

  // Quantity
  quantity_purchased    Decimal  @db.Decimal(10, 2)
  unit                  String   @default("meters")
  width                 Decimal  @db.Decimal(10, 2)

  // Financial
  rate_per_unit         Decimal  @db.Decimal(10, 2)
  total_cost            Decimal  @db.Decimal(10, 2)

  // Origin Context - WHY was this purchased?
  ordered_for_style_id  String?  // Style that triggered purchase
  ordered_for_order_id  String?  // Specific order reference
  is_stock_purchase     Boolean  @default(false)  // Stock vs order

  // Processing (if greige)
  processing_required   Boolean  @default(false)
  processing_type       String?  // "DYEING", "PRINTING", "BOTH"
  processing_color      String?
  processing_design     String?  // For prints
  processed_fabric_id   String?  // → fabric_master after processing
  processing_moq        Decimal? @db.Decimal(10, 2)  // MOQ causing excess

  // Dates
  purchase_date         DateTime
  expected_delivery     DateTime?
  received_date         DateTime?

  // Relations
  greige_master         greige_master?    @relation(fields: [greige_id], references: [id])
  fabric_master         fabric_master?    @relation(fields: [fabric_id], references: [id])
  processed_fabric      fabric_master?    @relation("ProcessedFabric", fields: [processed_fabric_id], references: [id])
  supplier              suppliers         @relation(fields: [supplier_id], references: [id])
  style_origin          styles?           @relation(fields: [ordered_for_style_id], references: [id])
  fabric_stock          fabric_stock[]    // Creates stock entries

  @@index([ordered_for_style_id])
  @@index([supplier_id])
  @@index([procurement_type])
}
```

**Purpose:** Track WHY fabric was purchased (order vs stock) and enable MOQ excess tracking.

---

##### 8. fabric_stock Table
**Status:** ⏳ PENDING
**Priority:** HIGH

```prisma
model fabric_stock {
  id                     String   @id @default(uuid())

  // Fabric Identity
  fabric_id              String
  width                  Decimal  @db.Decimal(10, 2)

  // Quantity Tracking
  quantity_available     Decimal  @db.Decimal(10, 2)
  quantity_reserved      Decimal  @default(0) @db.Decimal(10, 2)
  quantity_consumed      Decimal  @default(0) @db.Decimal(10, 2)
  unit                   String   @default("meters")

  // Origin Tracking - WHY does this stock exist?
  procurement_id         String   // → fabric_procurement
  origin_style_id        String?  // Style that caused purchase
  origin_order_id        String?  // Order that caused purchase

  // Stock Status
  status                 String   @default("AVAILABLE")
  // "AVAILABLE", "RESERVED", "DEPLETED", "QUARANTINED"

  stock_type             String   @default("EXCESS")
  // "EXCESS_MOQ", "PLANNED_STOCK", "RETURNED", "VARIANCE_UNUSED"

  // Variance Tracking (CAD changes)
  planned_cad            Decimal? @db.Decimal(10, 4)  // Original CAD
  actual_cad             Decimal? @db.Decimal(10, 4)  // Actual consumption
  variance_reason        String?
  // "CAD_IMPROVED", "PATTERN_CHANGED", "WASTAGE_REDUCED"

  // Weighted Average Costing
  weighted_avg_cost      Decimal  @db.Decimal(10, 2)  // Cost/meter
  purchase_cost          Decimal  @db.Decimal(10, 2)  // Original cost

  // Quality Management
  quality_grade          String   @default("A")  // "A", "B", "DEFECT"
  defect_meters          Decimal? @db.Decimal(10, 2)
  defect_value           Decimal? @db.Decimal(10, 2)  // = greige cost

  // Warehouse
  warehouse_location     String?
  rack_number            String?
  roll_numbers           String?  @db.Text  // Comma-separated

  // Aging Management
  received_date          DateTime
  last_consumed_date     DateTime?
  aging_alert_sent       Boolean  @default(false)
  aging_days             Int      @default(0)  // Auto-calculated

  // Relations
  fabric_master          fabric_master              @relation(fields: [fabric_id], references: [id])
  procurement            fabric_procurement         @relation(fields: [procurement_id], references: [id])
  origin_style           styles?                    @relation(fields: [origin_style_id], references: [id])
  stock_allocations      fabric_stock_allocation[]
  stock_transactions     fabric_stock_transaction[]

  @@unique([fabric_id, procurement_id, width, quality_grade])
  @@index([fabric_id, width, status])
  @@index([origin_style_id])
  @@index([status])
  @@index([aging_days])
  @@index([quality_grade])
}
```

**Key Features:**
- ✅ Weighted average costing
- ✅ Aging tracking (6+ months alert)
- ✅ Quality grading (A/B/Defect)
- ✅ Origin tracking (style/order reference)
- ✅ Stock type classification

---

##### 9. fabric_processing Table
**Status:** ⏳ PENDING
**Priority:** HIGH

```prisma
model fabric_processing {
  id                      String   @id @default(uuid())

  // Procurement Reference
  procurement_id          String   // → fabric_procurement

  // Processing Details
  processing_mill_id      String   // → suppliers (processing vendor)
  processing_type         String   // "DYEING", "PRINTING", "CALENDERING", "SANFORIZING"
  batch_number            String?

  // Greige Input
  greige_id               String
  greige_quantity_sent    Decimal  @db.Decimal(10, 2)
  greige_width            Decimal  @db.Decimal(10, 2)

  // Expected Output
  expected_finished_width_min  Decimal  @db.Decimal(10, 2)
  expected_finished_width_max  Decimal  @db.Decimal(10, 2)
  expected_shrinkage_percent   Decimal  @db.Decimal(5, 2)

  // Actual Output
  actual_finished_width        Decimal? @db.Decimal(10, 2)
  actual_quantity_received     Decimal? @db.Decimal(10, 2)
  actual_shrinkage_percent     Decimal? @db.Decimal(5, 2)
  processing_loss_meters       Decimal? @db.Decimal(10, 2)

  // Variance Analysis
  width_variance_inches        Decimal? @db.Decimal(10, 2)
  shrinkage_variance_percent   Decimal? @db.Decimal(5, 2)

  // Mill Performance Tracking
  mill_avg_shrinkage           Decimal? @db.Decimal(5, 2)  // Historical avg
  variance_from_mill_avg       Decimal? @db.Decimal(5, 2)

  // Costing
  greige_cost                  Decimal  @db.Decimal(10, 2)
  processing_cost              Decimal  @db.Decimal(10, 2)
  total_finished_cost          Decimal  @db.Decimal(10, 2)
  cost_per_meter               Decimal  @db.Decimal(10, 2)

  // Finished Fabric Created
  finished_fabric_id           String?  // → fabric_master

  // Dates
  sent_date                    DateTime
  expected_return_date         DateTime?
  actual_return_date           DateTime?

  // Status
  processing_status            String   @default("SENT")
  // "SENT", "IN_PROCESS", "COMPLETED", "REJECTED"

  // Relations
  procurement          fabric_procurement  @relation(fields: [procurement_id], references: [id])
  greige_master        greige_master       @relation(fields: [greige_id], references: [id])
  processing_mill      suppliers           @relation("ProcessingMill", fields: [processing_mill_id], references: [id])
  finished_fabric      fabric_master?      @relation("ProcessedFabric", fields: [finished_fabric_id], references: [id])

  @@index([processing_mill_id, greige_id])  // Mill performance queries
  @@index([processing_status])
  @@index([sent_date])
}
```

**Purpose:** Track greige→finished lifecycle and mill-specific shrinkage patterns.

---

##### 10. fabric_stock_allocation Table
**Status:** ⏳ PENDING
**Priority:** MEDIUM

```prisma
model fabric_stock_allocation {
  id                  String   @id @default(uuid())

  // Stock Reference
  stock_id            String

  // Order Reference
  order_id            String
  style_id            String

  // Allocation Details
  quantity_allocated  Decimal  @db.Decimal(10, 2)
  unit                String   @default("meters")

  // Consumption Tracking
  quantity_consumed   Decimal  @default(0) @db.Decimal(10, 2)
  quantity_returned   Decimal  @default(0) @db.Decimal(10, 2)

  // CAD Variance
  planned_cad         Decimal  @db.Decimal(10, 4)
  actual_cad          Decimal? @db.Decimal(10, 4)
  cad_variance        Decimal? @db.Decimal(10, 4)
  variance_reason     String?

  // Cross-Style Allocation Support
  original_style_id   String?  // If stock from Style A used for Style B
  allocation_type     String   @default("SAME_STYLE")
  // "SAME_STYLE", "CROSS_STYLE", "STOCK_UTILIZATION"

  // Status
  allocation_status   String   @default("RESERVED")
  // "RESERVED", "IN_PRODUCTION", "CONSUMED", "PARTIAL_RETURNED"

  // Dates
  allocated_date      DateTime @default(now())
  consumption_date    DateTime?

  // Relations
  fabric_stock        fabric_stock @relation(fields: [stock_id], references: [id])
  order               orders       @relation(fields: [order_id], references: [id])
  style               styles       @relation(fields: [style_id], references: [id])
  original_style      styles?      @relation("OriginalStyle", fields: [original_style_id], references: [id])

  @@index([stock_id])
  @@index([order_id])
  @@index([style_id])
  @@index([allocation_type])
}
```

**Key Features:**
- ✅ Cross-style allocation tracking
- ✅ CAD variance monitoring
- ✅ Consumption vs plan analysis

---

##### 11. fabric_stock_transaction Table
**Status:** ⏳ PENDING
**Priority:** MEDIUM

```prisma
model fabric_stock_transaction {
  id                  String   @id @default(uuid())

  stock_id            String

  // Transaction Details
  transaction_type    String
  // "RECEIPT", "CONSUMPTION", "RETURN", "ADJUSTMENT",
  // "TRANSFER", "GRADE_DOWN", "AGING_ALERT"

  quantity            Decimal  @db.Decimal(10, 2)
  unit                String   @default("meters")

  // Context
  reference_type      String?
  // "ORDER", "PROCUREMENT", "WASTAGE", "QUALITY_REJECTION",
  // "CROSS_STYLE_ALLOCATION"
  reference_id        String?

  // Costing (Weighted Average at transaction time)
  cost_per_unit       Decimal  @db.Decimal(10, 2)
  weighted_avg_cost   Decimal  @db.Decimal(10, 2)
  total_value         Decimal  @db.Decimal(10, 2)

  // Variance Context (if consumption)
  planned_cad         Decimal? @db.Decimal(10, 4)
  actual_cad          Decimal? @db.Decimal(10, 4)
  pieces_produced     Int?

  // Quality Context (if grade-down)
  quality_grade_from  String?  // "A", "B", "DEFECT"
  quality_grade_to    String?
  defect_type         String?

  // Stock Balance After Transaction
  balance_after       Decimal  @db.Decimal(10, 2)
  value_after         Decimal  @db.Decimal(10, 2)

  // Audit
  notes               String?  @db.Text
  created_by_id       String?
  transaction_date    DateTime @default(now())

  // Relations
  fabric_stock        fabric_stock @relation(fields: [stock_id], references: [id])
  created_by          users?       @relation(fields: [created_by_id], references: [id])

  @@index([stock_id])
  @@index([transaction_type])
  @@index([transaction_date])
  @@index([reference_type, reference_id])
}
```

**Purpose:** Complete audit trail with weighted average cost tracking.

---

##### 12. quality_inspection Table
**Status:** ⏳ PENDING
**Priority:** MEDIUM

```prisma
model quality_inspection {
  id                    String   @id @default(uuid())

  // Inspection Context
  inspection_type       String   // "INCOMING", "IN_PROCESS", "FINAL"
  fabric_procurement_id String?  // For incoming inspection
  fabric_stock_id       String?  // For stock inspection

  // Fabric Details
  fabric_id             String
  width                 Decimal  @db.Decimal(10, 2)
  quantity_inspected    Decimal  @db.Decimal(10, 2)

  // Inspection Results
  inspector_id          String
  inspection_date       DateTime @default(now())

  // Defects Tracking
  defect_types          String?  @db.Text  // JSON array
  // ["COLOR_VARIATION", "WEAVING_DEFECT", "PRINTING_MISALIGNMENT", ...]

  defect_points         Int      @default(0)  // 4-point system
  defect_meters         Decimal  @default(0) @db.Decimal(10, 2)
  defect_percentage     Decimal  @default(0) @db.Decimal(5, 2)

  // Grade Assignment
  quality_grade         String   // "A", "B", "DEFECT"
  grade_reason          String?  @db.Text

  // Grade Breakdown
  a_grade_quantity      Decimal  @default(0) @db.Decimal(10, 2)
  b_grade_quantity      Decimal  @default(0) @db.Decimal(10, 2)
  defect_quantity       Decimal  @default(0) @db.Decimal(10, 2)

  // Financial Impact
  a_grade_value         Decimal  @default(0) @db.Decimal(10, 2)
  b_grade_value         Decimal  @default(0) @db.Decimal(10, 2)
  defect_value          Decimal  @default(0) @db.Decimal(10, 2)  // = greige cost
  total_loss            Decimal  @default(0) @db.Decimal(10, 2)

  // Action Taken
  action                String?
  // "ACCEPTED", "PARTIAL_REJECTION", "FULL_REJECTION",
  // "GRADE_DOWN", "CLAIM_SUPPLIER"

  supplier_claim_amount Decimal? @db.Decimal(10, 2)
  claim_status          String?  // "PENDING", "APPROVED", "REJECTED"

  // Attachments
  inspection_photos     String?  @db.Text  // JSON array of URLs
  inspection_report_url String?

  // Relations
  fabric_master         fabric_master       @relation(fields: [fabric_id], references: [id])
  procurement           fabric_procurement? @relation(fields: [fabric_procurement_id], references: [id])
  stock                 fabric_stock?       @relation(fields: [fabric_stock_id], references: [id])
  inspector             users               @relation("Inspector", fields: [inspector_id], references: [id])

  @@index([fabric_id])
  @@index([quality_grade])
  @@index([inspection_date])
  @@index([inspector_id])
}
```

**Key Features:**
- ✅ Defect value = greige cost (business rule)
- ✅ Split stock by grade
- ✅ Supplier claim tracking

---

#### Phase 1C: Update Existing Tables (PENDING)

##### 13. Update style_fabrics (CRITICAL)
**Status:** ⏳ PENDING
**Priority:** CRITICAL

**Required Changes:**
```prisma
model style_fabrics {
  id           String @id @default(uuid())
  componentId  String

  // REMOVE ALL HARDCODED FIELDS:
  // ❌ fabricName
  // ❌ fabricType
  // ❌ fabricColor
  // ❌ fabricGSM
  // ❌ greigeName
  // ❌ supplierName
  // ❌ cadAverageMeters
  // ❌ cadAverageYards

  // ADD PROPER REFERENCES:
  fabricId        String                // ✅ Link to fabric_master
  fabricCADId     String?               // ✅ Specific CAD width
  quantityNeeded  Decimal?              // ✅ For calculations

  // KEEP OVERRIDES:
  unitPrice       Decimal?              // Override fabric master price
  notes           String?

  // Relations
  style_components  style_components
  fabric            fabric_master        @relation(fields: [fabricId], references: [id])
  fabricCAD         fabric_width_cad?    @relation(fields: [fabricCADId], references: [id])

  // ❌ REMOVE: cad_averages relation

  @@index([fabricId])
  @@index([fabricCADId])
}
```

**Migration Strategy:**
1. Match `fabricName` with `fabric_master.fabricName`
2. Where match found → populate `fabricId`
3. Where no match → create new `fabric_master`
4. Migrate `cad_averages` → `fabric_width_cad`
5. Drop `cad_averages` table

---

##### 14. Update stock_levels (for inventory)
**Status:** ⏳ PENDING
**Priority:** MEDIUM

```prisma
model stock_levels {
  // ... existing fields ...

  // ADD FABRIC TRACKING:
  fabricId       String?
  fabricCADId    String?
  quality_grade  String?  // "A", "B", "DEFECT"

  // Relations
  fabric         fabric_master?    @relation(fields: [fabricId], references: [id])
  fabricCAD      fabric_width_cad? @relation(fields: [fabricCADId], references: [id])

  @@index([fabricId])
  @@index([quality_grade])
}
```

---

##### 15. Create style_costing_fabric_items (NEW)
**Status:** ⏳ PENDING
**Priority:** HIGH

```prisma
model style_costing_fabric_items {
  id              String @id @default(uuid())
  costingId       String

  // Fabric Reference
  fabricId        String
  fabricCADId     String

  // Quantity & Cost
  quantityNeeded  Decimal  @db.Decimal(10, 4)
  costPerMeter    Decimal  @db.Decimal(10, 2)
  cadConsumption  Decimal  @db.Decimal(10, 4)
  totalCost       Decimal  @db.Decimal(10, 2)

  // Relations
  costing         style_costing     @relation(fields: [costingId], references: [id])
  fabric          fabric_master     @relation(fields: [fabricId], references: [id])
  fabricCAD       fabric_width_cad  @relation(fields: [fabricCADId], references: [id])

  @@index([costingId])
  @@index([fabricId])
}
```

**Update style_costing:**
```prisma
model style_costing {
  // ... existing fields ...

  // DEPRECATE:
  fabricDetails  Json?  // ⚠️ Keep for transition, mark deprecated

  // ADD:
  fabricItems  style_costing_fabric_items[]  // ✅ Proper relations
}
```

---

### PHASE 2: Backend Implementation (Week 2)

#### Controllers to Create/Update

| Controller | Status | Priority | Purpose |
|------------|--------|----------|---------|
| `fabric-procurement.controller.ts` | ⏳ PENDING | HIGH | Handle greige/finished purchases, MOQ logic |
| `fabric-stock.controller.ts` | ⏳ PENDING | HIGH | Stock inquiry, allocation, aging alerts |
| `fabric-processing.controller.ts` | ⏳ PENDING | HIGH | Greige→finished workflow, shrinkage tracking |
| `quality-inspection.controller.ts` | ⏳ PENDING | MEDIUM | Quality grading, defect tracking |
| `material.controller.ts` (UPDATE) | ⏳ PENDING | HIGH | Add materialType filtering |
| `bom.controller.ts` (UPDATE) | ⏳ PENDING | HIGH | Fabric CAD integration, auto-cost |
| `styleCosting.controller.ts` (UPDATE) | ⏳ PENDING | HIGH | Remove parsing, use fabric lookups |
| `style.controller.ts` (UPDATE) | ⏳ PENDING | HIGH | Link style_fabrics to fabric_master |

---

#### Business Logic Services

##### WeightedAverageCostService
**File:** `backend/src/services/weightedAverageCost.service.ts`
**Status:** ⏳ PENDING

```typescript
export class WeightedAverageCostService {
  /**
   * Calculate weighted average when new stock arrives
   */
  calculateWeightedAverage(
    existingStock: { quantity: number; cost: number }[],
    newStock: { quantity: number; cost: number }
  ): number {
    const totalQty = existingStock.reduce((sum, s) => sum + s.quantity, 0) + newStock.quantity;
    const totalValue = existingStock.reduce((sum, s) => sum + (s.quantity * s.cost), 0)
                     + (newStock.quantity * newStock.cost);
    return totalValue / totalQty;
  }

  /**
   * Get stock cost at specific date (for variance analysis)
   */
  async getStockCostAtDate(fabricId: string, date: Date): Promise<number> {
    // Query transactions up to date, calculate weighted average
  }
}
```

---

##### StockAgingService
**File:** `backend/src/services/stockAging.service.ts`
**Status:** ⏳ PENDING

```typescript
export class StockAgingService {
  /**
   * Alert stocks older than 6 months
   */
  async getAgingStocks(ageThresholdDays: number = 180): Promise<FabricStock[]> {
    return prisma.fabric_stock.findMany({
      where: {
        aging_days: { gte: ageThresholdDays },
        status: 'AVAILABLE',
        aging_alert_sent: false
      }
    });
  }

  /**
   * Prioritize oldest stock in allocation (FIFO for aging)
   */
  async prioritizeOldestStock(fabricId: string, width: number): Promise<FabricStock[]> {
    return prisma.fabric_stock.findMany({
      where: { fabricId, width, status: 'AVAILABLE' },
      orderBy: { received_date: 'asc' }
    });
  }

  /**
   * Send aging alerts
   */
  async sendAgingAlerts(): Promise<void> {
    const agingStocks = await this.getAgingStocks();
    // Send notifications, mark alert_sent = true
  }
}
```

---

##### CrossStyleAllocationService
**File:** `backend/src/services/crossStyleAllocation.service.ts`
**Status:** ⏳ PENDING

```typescript
export class CrossStyleAllocationService {
  /**
   * Allocate stock from Style A to Style B
   */
  async allocateStockCrossStyle(
    stockId: string,
    fromStyleId: string,
    toStyleId: string,
    toOrderId: string,
    quantity: number
  ): Promise<FabricStockAllocation> {
    // Validate fabric compatibility
    // Create allocation with allocation_type = "CROSS_STYLE"
    // Update stock quantities
    // Create transaction record
  }

  /**
   * Find compatible excess stock for style
   */
  async findCompatibleStock(
    fabricId: string,
    width: number,
    qualityGrade: string = 'A'
  ): Promise<FabricStock[]> {
    return prisma.fabric_stock.findMany({
      where: {
        fabricId,
        width,
        quality_grade: qualityGrade,
        status: 'AVAILABLE',
        quantity_available: { gt: 0 }
      },
      include: { origin_style: true },
      orderBy: { aging_days: 'desc' }  // Prioritize older stock
    });
  }
}
```

---

##### ShrinkageVarianceService
**File:** `backend/src/services/shrinkageVariance.service.ts`
**Status:** ⏳ PENDING

```typescript
export class ShrinkageVarianceService {
  /**
   * Record shrinkage variance after processing
   */
  async recordShrinkageVariance(
    processingId: string,
    actualWidth: number,
    actualQuantity: number
  ): Promise<void> {
    const processing = await prisma.fabric_processing.findUnique({
      where: { id: processingId },
      include: { greige_master: true, processing_mill: true }
    });

    const shrinkagePercent =
      ((processing.greige_width - actualWidth) / processing.greige_width) * 100;

    await prisma.fabric_processing.update({
      where: { id: processingId },
      data: {
        actual_finished_width: actualWidth,
        actual_shrinkage_percent: shrinkagePercent,
        width_variance_inches: processing.expected_finished_width_min - actualWidth,
        // Update mill average
        mill_avg_shrinkage: await this.getMillAverageShrinkage(
          processing.processing_mill_id,
          processing.greige_id
        )
      }
    });
  }

  /**
   * Predict shrinkage for procurement planning
   */
  async predictShrinkage(
    greigeId: string,
    processingMillId: string,
    processingType: string
  ): Promise<{ expected: number; variance: number }> {
    const historicalData = await prisma.fabric_processing.findMany({
      where: {
        greige_id: greigeId,
        processing_mill_id: processingMillId,
        processing_type: processingType,
        processing_status: 'COMPLETED'
      },
      select: { actual_shrinkage_percent: true }
    });

    // Calculate average and standard deviation
    const shrinkages = historicalData
      .map(d => d.actual_shrinkage_percent)
      .filter(s => s !== null) as number[];

    const avg = shrinkages.reduce((a, b) => a + b, 0) / shrinkages.length;
    const variance = Math.sqrt(
      shrinkages.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / shrinkages.length
    );

    return { expected: avg, variance };
  }
}
```

---

##### QualityGradingService
**File:** `backend/src/services/qualityGrading.service.ts`
**Status:** ⏳ PENDING

```typescript
export class QualityGradingService {
  /**
   * Grade stock after inspection
   */
  async gradeStock(
    stockId: string,
    grade: 'A' | 'B' | 'DEFECT',
    defectMeters: number,
    notes: string
  ): Promise<void> {
    const stock = await prisma.fabric_stock.findUnique({
      where: { id: stockId },
      include: { procurement: true, fabric_master: { include: { greige: true } } }
    });

    // Calculate defect value = greige cost
    const defectValue = stock.fabric_master.greige
      ? defectMeters * (stock.procurement.rate_per_unit / 2)  // Simplified
      : 0;

    await prisma.fabric_stock.update({
      where: { id: stockId },
      data: {
        quality_grade: grade,
        defect_meters: defectMeters,
        defect_value: defectValue
      }
    });
  }

  /**
   * Split stock into quality grades
   */
  async splitStockByGrade(
    stockId: string,
    gradeBreakdown: { grade: string; quantity: number }[]
  ): Promise<FabricStock[]> {
    const originalStock = await prisma.fabric_stock.findUnique({
      where: { id: stockId }
    });

    const newStocks: FabricStock[] = [];

    for (const breakdown of gradeBreakdown) {
      if (breakdown.quantity > 0) {
        const newStock = await prisma.fabric_stock.create({
          data: {
            ...originalStock,
            id: undefined,  // Generate new ID
            quality_grade: breakdown.grade,
            quantity_available: breakdown.quantity,
            defect_value: breakdown.grade === 'DEFECT'
              ? await this.calculateDefectValue(originalStock)
              : 0
          }
        });
        newStocks.push(newStock);
      }
    }

    // Mark original as depleted
    await prisma.fabric_stock.update({
      where: { id: stockId },
      data: { status: 'DEPLETED', quantity_available: 0 }
    });

    return newStocks;
  }

  /**
   * Calculate defect value = greige cost (business rule)
   */
  private async calculateDefectValue(stock: FabricStock): Promise<number> {
    // Defect fabric value = greige cost
    const greige = await prisma.greige_master.findFirst({
      where: { id: stock.fabric_master.greigeId }
    });

    return greige?.costPerMeter || stock.purchase_cost * 0.5;
  }
}
```

---

### PHASE 3: Frontend Implementation (Week 3)

#### Pages/Components Status

| Component | File | Status | Priority |
|-----------|------|--------|----------|
| Procurement Planning | `ProcurementPlanning.tsx` | ⏳ PENDING | HIGH |
| Stock Dashboard | `FabricStockDashboard.tsx` | ⏳ PENDING | HIGH |
| Stock Allocation | `StockAllocation.tsx` | ⏳ PENDING | HIGH |
| Quality Inspection | `QualityInspection.tsx` | ⏳ PENDING | MEDIUM |
| Processing Tracking | `ProcessingWorkflow.tsx` | ⏳ PENDING | MEDIUM |
| BOMForm (UPDATE) | `BOMForm.tsx` | ⏳ PENDING | HIGH |
| CostSheetForm (UPDATE) | `CostSheetForm.tsx` | ⏳ PENDING | HIGH |
| StyleForm (UPDATE) | `StyleForm.tsx` | ⏳ PENDING | HIGH |
| FabricSelector (NEW) | `FabricSelector.tsx` | ⏳ PENDING | HIGH |

---

## Business Rules & Workflows

### Workflow 1: Order with Greige Purchase & Processing

```
1. Create Order: 1000 pcs Style ABC
   └─ System calculates: Need 1400m Navy Poplin 54"

2. Procurement Decision:
   ┌─────────────────────────────────────────┐
   │ Option A: Buy Finished (₹95/m, MOQ 2000m)│
   │ Option B: Buy Greige + Dye (₹85/m total)│
   └─────────────────────────────────────────┘

3. Select Option B:
   ├─ Buy Greige: 2200m @ 60" (accounting for shrinkage)
   ├─ Create fabric_procurement:
   │   ├─ procurement_type = "GREIGE"
   │   ├─ greige_id = Cotton Poplin 60"
   │   ├─ quantity = 2200m
   │   ├─ ordered_for_style_id = Style ABC
   │   └─ processing_required = true
   │
   └─ Send for Dyeing:
       ├─ Create fabric_processing:
       │   ├─ processing_type = "DYEING"
       │   ├─ processing_mill_id = XYZ Dyers
       │   ├─ greige_quantity_sent = 2200m
       │   ├─ expected_finished_width = 54-56"
       │   └─ expected_shrinkage = 8-10%
       │
       └─ After Dyeing:
           ├─ Actual finished: 54.5" (9.2% shrinkage)
           ├─ Quantity received: 1980m (20m loss)
           ├─ Quality Inspection:
           │   ├─ A-grade: 1900m
           │   ├─ B-grade: 60m
           │   └─ Defect: 20m
           │
           └─ Create fabric_stock entries:
               ├─ Stock 1: A-grade, 1900m, ₹93.37/m (weighted avg)
               │   ├─ origin_style_id = Style ABC
               │   ├─ stock_type = "EXCESS_MOQ"
               │   └─ Reserved: 1400m (for order)
               │       Available: 500m
               │
               ├─ Stock 2: B-grade, 60m, ₹93.37/m
               │   └─ Available for sale/use
               │
               └─ Stock 3: Defect, 20m, ₹65/m (greige value)
                   └─ Scrapped or sold as defect

4. Production Allocation:
   ├─ Create fabric_stock_allocation:
   │   ├─ stock_id = Stock 1 (A-grade)
   │   ├─ order_id = Order ABC
   │   ├─ quantity_allocated = 1400m
   │   ├─ planned_cad = 1.4m
   │   └─ allocation_status = "RESERVED"
   │
   └─ Production completes:
       ├─ Actual consumption: 1450m (CAD variance)
       ├─ Update allocation:
       │   ├─ quantity_consumed = 1450m
       │   ├─ actual_cad = 1.45m
       │   ├─ cad_variance = +0.05m
       │   └─ variance_reason = "PATTERN_ADJUSTMENT"
       │
       └─ Update stock:
           ├─ A-grade stock: 450m available (instead of 500m)
           └─ Create transaction record
```

---

### Workflow 2: Reorder with Stock Availability

```
1. New Order: 500 pcs Style ABC (6 months later)
   └─ System calculates: Need 700m (CAD still 1.4m)

2. Check Stock:
   ├─ Found: 450m Navy Poplin 54" A-grade
   │   ├─ origin_style_id = Style ABC ✓
   │   ├─ aging_days = 180 (6 months) ⚠️ AGING ALERT
   │   └─ weighted_avg_cost = ₹93.37/m
   │
   └─ Decision:
       ├─ Use 450m from existing stock (PRIORITIZE OLD STOCK)
       ├─ Buy additional 300m (or nearest MOQ)
       └─ If MOQ = 500m:
           ├─ Buy 500m @ ₹95/m (price increased)
           ├─ New weighted avg =
           │   (450 × ₹93.37 + 500 × ₹95) / 950 = ₹94.23/m
           │
           └─ Stock breakdown:
               ├─ Use 450m from old stock
               ├─ Use 250m from new stock
               └─ Remaining 250m available (new stock)

3. Stock Allocation:
   ├─ Allocation 1: 450m from Stock 1 (old, 180 days)
   │   └─ allocation_type = "SAME_STYLE"
   │
   └─ Allocation 2: 250m from Stock 2 (new)
       └─ allocation_type = "SAME_STYLE"

4. Post-Production:
   ├─ Actual consumption: 720m (instead of 700m)
   ├─ Track variance: +20m (CAD increased slightly)
   └─ Remaining stock: 230m (from new procurement)
```

---

### Workflow 3: Cross-Style Allocation

```
1. Situation:
   ├─ Style ABC: 450m Navy Poplin 54" excess stock
   └─ New Style XYZ: Also uses Navy Poplin 54"

2. Order for Style XYZ: 300 pcs
   └─ Need: 420m Navy Poplin 54"

3. Stock Check:
   ├─ Available: 450m (from Style ABC excess)
   └─ Compatible: Same fabric, same width ✓

4. Manual Allocation (User decision):
   ├─ Allocate 420m from Style ABC stock to Style XYZ
   ├─ Create fabric_stock_allocation:
   │   ├─ stock_id = ABC excess stock
   │   ├─ style_id = Style XYZ
   │   ├─ original_style_id = Style ABC
   │   ├─ allocation_type = "CROSS_STYLE"
   │   └─ quantity = 420m
   │
   └─ Benefits:
       ├─ Utilize old stock (reduced aging)
       ├─ Save procurement cost
       └─ Track cross-style usage for analysis

5. Remaining Stock:
   └─ 30m still linked to Style ABC (for future ABC reorders)
```

---

### Workflow 4: Quality Grading Impact

```
1. Receive Fabric: 2000m Navy Poplin
   └─ Create fabric_procurement record

2. Quality Inspection:
   ├─ Inspector: User X
   ├─ Inspection finds defects:
   │   ├─ A-grade: 1850m (92.5%)
   │   ├─ B-grade: 120m (6%) - Minor defects
   │   └─ Defective: 30m (1.5%) - Major defects
   │
   └─ Create quality_inspection record

3. Stock Split by Grade:
   ├─ Stock 1: A-grade, 1850m @ ₹95/m
   │   └─ Available for regular orders
   │
   ├─ Stock 2: B-grade, 120m @ ₹95/m
   │   └─ Can be used for samples/internal use
   │
   └─ Stock 3: Defect, 30m @ ₹65/m (greige value)
       ├─ defect_value = 30 × ₹65 = ₹1,950
       └─ Financial loss = (₹95 - ₹65) × 30 = ₹900

4. Supplier Claim:
   ├─ If defect > threshold (e.g., 2%)
   ├─ Create claim for ₹900 loss
   └─ Track claim_status: PENDING → APPROVED

5. Stock Usage:
   ├─ Regular orders: Use A-grade stock
   ├─ Sample orders: Can use B-grade stock
   └─ Defect stock: Sold as scrap or greige equivalent
```

---

## Next Steps (Immediate Actions)

### Step 1: Complete Remaining Schema (Today)
- [ ] Add fabric_procurement table
- [ ] Add fabric_stock table
- [ ] Add fabric_processing table
- [ ] Add fabric_stock_allocation table
- [ ] Add fabric_stock_transaction table
- [ ] Add quality_inspection table
- [ ] Update style_fabrics (remove hardcoded fields)
- [ ] Create style_costing_fabric_items table

### Step 2: Generate Migration (Today)
```bash
cd backend
npx prisma migrate dev --name fabric_materials_integration
npx prisma generate
```

### Step 3: Create Seed Data (Today)
- [ ] Create sample greige masters
- [ ] Create sample fabric masters with CAD widths
- [ ] Create sample materials entries (polymorphic)
- [ ] Link sample BOM items to fabric CADs

### Step 4: Backend Services (Tomorrow)
- [ ] WeightedAverageCostService
- [ ] StockAgingService
- [ ] CrossStyleAllocationService
- [ ] ShrinkageVarianceService
- [ ] QualityGradingService

### Step 5: Controllers (Days 3-4)
- [ ] fabric-procurement.controller.ts
- [ ] fabric-stock.controller.ts
- [ ] fabric-processing.controller.ts
- [ ] quality-inspection.controller.ts
- [ ] Update material.controller.ts
- [ ] Update bom.controller.ts
- [ ] Update styleCosting.controller.ts
- [ ] Update style.controller.ts

### Step 6: Frontend (Days 5-10)
- [ ] Procurement Planning screen
- [ ] Stock Dashboard
- [ ] Stock Allocation interface
- [ ] Quality Inspection form
- [ ] Processing Workflow UI
- [ ] Update BOMForm (fabric selector)
- [ ] Update CostSheetForm (remove parsing)
- [ ] Update StyleForm (fabric selection)

---

## Success Metrics

### Technical Metrics
- ✅ Zero duplicate CAD entry (centralized repository)
- ✅ 100% fabric traceability (greige → finished → stock)
- ✅ Accurate weighted average costing (±2% variance)
- ✅ All BOM items can reference fabric CADs

### Business Metrics
- ✅ 90%+ excess stock utilization within 12 months
- ✅ Shrinkage prediction accuracy >85% (after 10 batches per mill)
- ✅ Quality defect value accuracy = greige cost
- ✅ Cross-style allocation tracking 100%
- ✅ Aging alerts prevent stock obsolescence

---

## Risk Mitigation

### Data Migration Risk
- **Mitigation:** Preserve original tables for 60 days
- **Mitigation:** Parallel run period with manual verification
- **Mitigation:** Rollback scripts ready

### User Adoption Risk
- **Mitigation:** Training videos for each module
- **Mitigation:** In-app help tooltips
- **Mitigation:** Gradual rollout (masters → procurement → production)

### Performance Risk
- **Mitigation:** Database indexing on all foreign keys
- **Mitigation:** Weighted average calculation optimization
- **Mitigation:** Stock query caching (5-minute TTL)

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1A: Schema Foundation | 2 days | ✅ COMPLETED |
| Phase 1B: Remaining Schema | 1 day | ⏳ IN PROGRESS |
| Phase 1C: Schema Migration | 1 day | ⏳ PENDING |
| Phase 2: Backend Services | 4 days | ⏳ PENDING |
| Phase 3: Frontend UI | 6 days | ⏳ PENDING |
| Phase 4: Testing & Refinement | 3 days | ⏳ PENDING |

**Total:** ~17 days (3.5 weeks)

---

## Conclusion

This integration plan combines **two critical initiatives**:

1. **Materials-Fabric Integration** (from first discussion)
   - Polymorphic materials architecture
   - Eliminates duplicate systems
   - Fixes BOM, Cost Sheet, Style workflows

2. **Complete Fabric Lifecycle Management** (from second discussion)
   - Greige → Processing → Finished
   - Stock management with weighted average costing
   - Quality grading, aging alerts
   - Mill performance tracking

Together, they create a **unified, production-ready fabric management system** that handles the complete garment manufacturing workflow from raw fabric procurement through quality inspection to final consumption.

**Current Status:** Phase 1A completed (schema foundation). Ready to proceed with remaining schema changes and begin backend implementation.
