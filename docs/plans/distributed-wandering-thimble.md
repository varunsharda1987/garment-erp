# Pre-Production Cost Sheet Enhancement Plan

## Overview
Transform the cost sheet system to intelligently handle multiple fabric sourcing scenarios (stock reuse, ready fabric purchase, greige + processing) with automatic cost calculation, processor rate cards, and auto-versioning.

## Critical Problem Identified
**`style_fabrics.fabricId` is NULL for all existing records** - fabrics are stored as text instead of being linked to `fabric_master`. This must be fixed first to enable automatic cost lookup.

---

## Phase 1: Foundation & Critical Fixes (Priority: HIGH)

### 1.1 Database Schema Changes

**File:** `backend/prisma/schema.prisma`

#### New Table: `processor_rate_card`
```prisma
model processor_rate_card {
  id                String   @id @default(uuid())
  processorId       String
  processor         suppliers @relation(fields: [processorId], references: [id])
  processingType    String   // DYEING, PRINTING, WASHING, FINISHING
  fabricCategory    String   // COTTON, POLYESTER, SILK, BLEND, etc.
  genericFabricName String?  // Optional: specific fabric like "Cambric"
  minQuantityMeters Decimal  @db.Decimal(10, 2)
  maxQuantityMeters Decimal  @db.Decimal(10, 2)
  ratePerMeter      Decimal  @db.Decimal(10, 2)
  setupCharge       Decimal? @db.Decimal(10, 2)
  minimumCharge     Decimal? @db.Decimal(10, 2)
  effectiveFrom     DateTime @default(now())
  effectiveTo       DateTime?
  conditions        String?  @db.Text
  turnaroundDays    Int?
  isActive          Boolean  @default(true)
  priority          Int      @default(0)
  createdById       String
  createdBy         users @relation(fields: [createdById], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([processorId, processingType, fabricCategory])
  @@unique([processorId, processingType, fabricCategory, minQuantityMeters, effectiveFrom])
}
```

#### Enhance `style_costing` (Add Versioning)
```prisma
// Add these fields to existing model:
version              Int      @default(1)
versionDate          DateTime @default(now())
versionReason        String?  @db.Text
costVariancePercent  Decimal? @db.Decimal(5, 2)
supersededById       String?
supersededBy         style_costing? @relation("Versions", fields: [supersededById], references: [id])
olderVersions        style_costing[] @relation("Versions")
lockedForOrders      Boolean  @default(false)

@@index([styleId, version])
@@unique([styleId, version])  // REMOVE existing @unique([styleId])
```

#### Enhance `style_costing_fabric_items` (Add Sourcing)
```prisma
// Add these fields:
sourcingStrategy String   // STOCK_REUSE, READY_FABRIC, GREIGE_PROCESSED
greigeCost       Decimal? @db.Decimal(10, 2)
processingCost   Decimal? @db.Decimal(10, 2)
readyFabricCost  Decimal? @db.Decimal(10, 2)
stockCost        Decimal? @db.Decimal(10, 2)
processorId      String?
processor        suppliers? @relation(fields: [processorId], references: [id])
rateCardId       String?
rateCard         processor_rate_card? @relation(fields: [rateCardId], references: [id])
stockLotId       String?
stockLot         fabric_stock? @relation(fields: [stockLotId], references: [id])
procurementId    String?
procurement      fabric_procurement? @relation(fields: [procurementId], references: [id])
isManualOverride Boolean  @default(false)
overrideReason   String?
costComparisonData Json?  // Audit trail of all options considered

@@index([processorId, rateCardId, stockLotId, sourcingStrategy])
```

#### Fix `style_fabrics.fabricId`
```prisma
// Change from:
fabricId String?

// To:
fabricId String  // REQUIRED field

// Add migration status field temporarily:
migrationStatus String? @default("LINKED")  // LINKED, PENDING, TEXT_ONLY
```

### 1.2 Fix fabricId NULL Issue

**Files to create:**
- `backend/src/services/fabric-matcher.service.ts`
- `backend/src/scripts/backfill-fabric-ids.ts`

**Migration Strategy:**

1. **Create Fabric Matcher Service** - Match text fabrics to `fabric_master`:
   - HIGH confidence: Exact fabricName match
   - MEDIUM confidence: genericFabricName + color + type match
   - LOW confidence: genericFabricName only
   - NONE: No match found

2. **Backfill Script**:
   - Run matcher on all NULL fabricIds
   - Update `style_fabrics` with matches
   - Mark unmatched as `migrationStatus: TEXT_ONLY`

3. **Create Missing Fabrics**:
   - For TEXT_ONLY records, create placeholder `fabric_master` entries
   - Auto-generate fabricCode: `AUTO-{timestamp}-{random}`
   - Link back to `style_fabrics`

4. **Manual Review UI** (later):
   - Admin interface to review low-confidence matches
   - Allow re-linking to correct fabrics

---

## Phase 2: Core Cost Calculation Logic

### 2.1 Fabric Cost Calculation Service

**File:** `backend/src/services/fabric-cost-calculation.service.ts` (NEW)

**Priority-Based Sourcing Algorithm:**

```
1. CHECK STOCK AVAILABILITY
   - Query fabric_stock for matching fabricId, width, quality
   - Filter: status=AVAILABLE, quantityAvailable >= needed
   - Prioritize: originStyleId match, then lowest weightedAvgCost
   - Return: stockCost (WAC), stockLotId

2. CHECK READY FABRIC COST
   - Get latest fabric_procurement (type: FINISHED)
   - Use ratePerUnit from procurement
   - Fallback: fabric_master.costPerMeter
   - Return: readyFabricCost, procurementId

3. CALCULATE GREIGE + PROCESSING
   - Get greige cost from fabric_stock WAC or greige_master.costPerMeter
   - Lookup processor rate from processor_rate_card:
     * Match: processingType, fabricCategory, quantity range
     * Apply quantity slab pricing
   - Manual override allowed for greige price
   - Return: greigeCost, processingCost, processorId, rateCardId

4. COMPARE & RECOMMEND
   - Build comparison table with all options
   - Recommend lowest total cost
   - Return all alternatives for user choice
```

**Key Functions:**
- `calculateFabricCost(fabricId, cadMeters, width, orderQty, styleId)`
- `checkStockAvailability(fabricId, width, quantity, styleId)`
- `getReadyFabricCost(fabricId)`
- `calculateGreigeProcessingCost(fabricId, quantity)`
- `getProcessorRate(processingType, fabricCategory, quantity)`

### 2.2 Processor Rate Service

**File:** `backend/src/services/processor-rate.service.ts` (NEW)

**Quantity Slab Lookup:**
```
Search processor_rate_card WHERE:
- processorId, processingType, fabricCategory match
- minQuantityMeters <= orderQty <= maxQuantityMeters
- effectiveFrom <= now <= effectiveTo (or null)
- isActive = true

Order by: priority DESC, ratePerMeter ASC
Return: First match (best rate)
```

**Functions:**
- `getProcessorRate(query: ProcessorRateQuery)`
- `searchRateCards(filters)`
- `createRateCard(data)`
- `bulkImportRateCards(csvFile)`

### 2.3 Versioning Service

**File:** `backend/src/services/cost-sheet-versioning.service.ts` (NEW)

**Auto-Version Trigger:**
```
WHEN: Creating/updating cost sheet
IF: Latest approved version exists
AND: New total cost differs by > 5% from latest
THEN: Auto-create new version
  - Increment version number
  - Set versionReason (auto-generated or user-provided)
  - Calculate costVariancePercent
  - Link supersededById to previous version
  - Set isApproved = false (requires approval)
```

**Functions:**
- `shouldCreateNewVersion(styleId, newCostData)`
- `createCostSheetVersion(styleId, costData, versionReason?)`
- `lockCostSheetForOrder(costSheetId, orderId)`
- `canEditCostSheet(costSheetId)`
- `compareCostSheetVersions(v1Id, v2Id)`

---

## Phase 3: API Endpoints

**Files to create/modify:**
- `backend/src/controllers/fabric-costing.controller.ts` (NEW)
- `backend/src/controllers/processor-rate-card.controller.ts` (NEW)
- `backend/src/controllers/cost-sheet.controller.ts` (MODIFY)

**New Routes:**

```typescript
// Fabric Costing
POST   /api/fabric-costing/calculate           // Single fabric cost calc
POST   /api/fabric-costing/batch-calculate     // Multiple fabrics
GET    /api/fabric-stock/availability/:fabricId // Stock check

// Processor Rate Cards
POST   /api/processor-rate-cards               // Create rate card
GET    /api/processor-rate-cards/search        // Search with filters
PUT    /api/processor-rate-cards/:id           // Update (creates new with effectiveFrom)
POST   /api/processor-rate-cards/bulk-import   // CSV import

// Cost Sheet Enhanced
POST   /api/cost-sheets/generate               // Auto-generate with sourcing
GET    /api/cost-sheets/:id/versions           // Version history
POST   /api/cost-sheets/:id/approve            // Approve version
GET    /api/cost-sheets/:id/comparison/:compareId // Compare versions
```

---

## Phase 4: Frontend UI Enhancement

### 4.1 Enhanced Cost Sheet Form

**File:** `frontend/src/pages/CostSheetForm.tsx` (MAJOR REFACTOR)

**Changes:**

1. **Replace auto-population logic** with new fabric costing API
2. **Add sourcing strategy display** for each fabric
3. **Add cost comparison panel** showing all sourcing options
4. **Add version management section** at top of form

### 4.2 New Components

**Files to create:**

1. **`frontend/src/components/cost-sheet/FabricCostingRow.tsx`**
   - Display fabric details (name, width, CAD)
   - Show selected sourcing strategy with breakdown
   - Button to open sourcing selector modal
   - Cost comparison tooltip

2. **`frontend/src/components/cost-sheet/SourcingStrategySelector.tsx`**
   - Modal/drawer with 3 tabs: Stock Reuse, Ready Fabric, Greige+Processing
   - Each tab shows:
     * Availability status
     * Cost breakdown
     * Lead time
     * Total cost
     * Savings vs alternatives
   - "Select This Option" button per tab
   - Manual override option for greige price

3. **`frontend/src/components/cost-sheet/ProcessorSelector.tsx`**
   - Dropdown of processors filtered by processingType
   - Show rate preview based on quantity
   - Manual rate override checkbox
   - Justification field for overrides

4. **`frontend/src/components/cost-sheet/VersionManagement.tsx`**
   - Current version indicator
   - Variance from previous version (color-coded)
   - Version history table
   - "Create New Version" button
   - "Compare Versions" button
   - Lock indicator for versions used in orders

5. **`frontend/src/components/cost-sheet/CostComparisonTable.tsx`**
   - Side-by-side comparison of sourcing options
   - Columns: Strategy, Cost/m, Total, Lead Time, Savings
   - Highlight recommended option
   - Responsive design

### 4.3 Service Updates

**File:** `frontend/src/services/fabricStock.service.ts` (MODIFY)

Add methods:
- `checkAvailability(fabricId, width, quantity, styleId)`
- `getReusableStock(fabricId, width)`

**File:** `frontend/src/services/costSheet.service.ts` (MODIFY)

Add methods:
- `generateCostSheet(styleId, forceNewVersion?)`
- `calculateFabricCost(fabricId, cadMeters, width, orderQty, styleId)`
- `getCostSheetVersions(costSheetId)`
- `compareCostSheetVersions(v1Id, v2Id)`

**File:** `frontend/src/services/processorRateCard.service.ts` (NEW)

Methods:
- `searchRateCards(filters)`
- `getRateForQuantity(processorId, processingType, fabricCategory, quantity)`

---

## Phase 5: Data Migration & Setup

### 5.1 Migration Scripts to Run

**Order of execution:**

1. **Run Prisma migration** for schema changes
2. **Backfill fabricId** for existing style_fabrics
3. **Create processor rate cards** from historical data
4. **Validate cost sheet integrity**

**Files:**
- `backend/src/scripts/migrate-fabric-ids.ts`
- `backend/src/scripts/setup-processor-rate-cards.ts`
- `backend/src/scripts/validate-cost-sheets.ts`

### 5.2 Initial Data Setup

1. **Identify active processors** from `suppliers` table (category: DYEING_PRINTING)
2. **Extract historical processing rates** from `fabric_processing` table
3. **Create rate card template CSV** with quantity slabs:
   ```csv
   Processor,ProcessingType,FabricCategory,MinQty,MaxQty,Rate,TurnaroundDays
   ABC Dyers,DYEING,COTTON,0,500,65,30
   ABC Dyers,DYEING,COTTON,500,1000,60,30
   ABC Dyers,DYEING,COTTON,1000,5000,55,30
   ```
4. **Import via bulk API** endpoint

---

## Implementation Checklist

### Week 1-2: Foundation
- [ ] Create database migrations
- [ ] Run fabric matcher service
- [ ] Backfill fabricId for all style_fabrics
- [ ] Create missing fabric_master entries
- [ ] Validate all fabricIds are populated
- [ ] Setup processor rate cards (initial data)

### Week 3-4: Backend Logic
- [ ] Implement FabricCostCalculationService
- [ ] Implement ProcessorRateService
- [ ] Implement CostSheetVersioningService
- [ ] Create API endpoints (fabric costing, rate cards, versioning)
- [ ] Write unit tests (target: >80% coverage)
- [ ] API documentation (Swagger)

### Week 5-6: Frontend UI
- [ ] Refactor CostSheetForm with new structure
- [ ] Create FabricCostingRow component
- [ ] Create SourcingStrategySelector modal
- [ ] Create ProcessorSelector component
- [ ] Create VersionManagement panel
- [ ] Create CostComparisonTable
- [ ] Integrate with backend APIs
- [ ] Add loading states and error handling

### Week 7: Versioning & Workflow
- [ ] Auto-versioning on cost change >5%
- [ ] Version comparison UI
- [ ] Version locking on order association
- [ ] Approval workflow (if needed)
- [ ] Cost variance reports

### Week 8: Testing & Training
- [ ] End-to-end testing
- [ ] User acceptance testing
- [ ] Create user documentation
- [ ] Training sessions for teams
- [ ] Performance optimization

### Week 9+: Deployment
- [ ] Deploy to staging
- [ ] Monitor and fix issues
- [ ] Deploy to production (gradual rollout)
- [ ] Post-deployment support

---

## Critical Files Summary

**Backend:**
- `backend/prisma/schema.prisma` - Schema changes
- `backend/src/services/fabric-cost-calculation.service.ts` - NEW
- `backend/src/services/processor-rate.service.ts` - NEW
- `backend/src/services/cost-sheet-versioning.service.ts` - NEW
- `backend/src/services/fabric-matcher.service.ts` - NEW (for migration)
- `backend/src/controllers/fabric-costing.controller.ts` - NEW
- `backend/src/controllers/processor-rate-card.controller.ts` - NEW
- `backend/src/controllers/cost-sheet.controller.ts` - MODIFY
- `backend/src/routes/fabric-costing.routes.ts` - NEW
- `backend/src/routes/processor-rate-card.routes.ts` - NEW

**Frontend:**
- `frontend/src/pages/CostSheetForm.tsx` - MAJOR REFACTOR
- `frontend/src/components/cost-sheet/FabricCostingRow.tsx` - NEW
- `frontend/src/components/cost-sheet/SourcingStrategySelector.tsx` - NEW
- `frontend/src/components/cost-sheet/ProcessorSelector.tsx` - NEW
- `frontend/src/components/cost-sheet/VersionManagement.tsx` - NEW
- `frontend/src/components/cost-sheet/CostComparisonTable.tsx` - NEW
- `frontend/src/services/fabricStock.service.ts` - MODIFY
- `frontend/src/services/costSheet.service.ts` - MODIFY
- `frontend/src/services/processorRateCard.service.ts` - NEW
- `frontend/src/types/fabricCosting.types.ts` - NEW
- `frontend/src/types/processorRateCard.types.ts` - NEW

**Migration Scripts:**
- `backend/src/scripts/migrate-fabric-ids.ts`
- `backend/src/scripts/setup-processor-rate-cards.ts`
- `backend/src/scripts/validate-cost-sheets.ts`

---

## Success Criteria

1. **All style_fabrics have valid fabricId** (migration complete)
2. **Cost sheet shows fabric sourcing options** (stock, ready, greige+processing)
3. **Automatic cost calculation** based on stock WAC, procurement rates, processor rates
4. **Processor rate cards** support quantity slabs and fabric categories
5. **Auto-versioning** triggers on >5% cost variance
6. **Version history** preserved and viewable
7. **User can select sourcing strategy** and see cost comparison
8. **Manual override** supported with justification tracking
9. **Orders lock cost sheet versions** (no retroactive changes)
10. **System performs well** (API response < 2s, UI responsive)

---

## Risk Mitigation

**Risk:** fabricId migration fails for many records
- **Mitigation:** Manual review UI for unmatched fabrics, admin can link or create new fabric_master

**Risk:** Processor rates not available for all fabric types
- **Mitigation:** Allow manual rate entry, system suggests based on similar fabrics

**Risk:** Auto-versioning creates too many versions
- **Mitigation:** Configurable threshold (default 5%), user can disable auto-versioning

**Risk:** Performance issues with large cost comparisons
- **Mitigation:** Cache rate cards, index database properly, use pagination for version history

**Risk:** User confusion with new multi-option sourcing UI
- **Mitigation:** Clear tooltips, training, video tutorials, smart defaults (recommend cheapest option)

---

## Notes

- This plan addresses the root cause (fabricId NULL issue) before building new features
- The system leverages existing infrastructure (fabric_stock, fabric_procurement, fabric_processing)
- Weighted average costing (WAC) is already implemented and will be utilized
- Processor rate cards enable quantity-based pricing as required
- Auto-versioning ensures cost history is preserved for repeat productions
- The UI prioritizes showing stock reuse first to minimize costs
- Manual overrides are supported but tracked for audit purposes
