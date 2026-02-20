# CAD Planning Module - Complete Documentation

**Last Updated**: 2026-01-29
**Version**: 3.3
**Status**: ✅ Complete (Backend + Frontend + Stock Integration + Module Separation + Width Variants After Approval)
**CAD Purpose Modes**: COSTING | RAW_MATERIAL_CALCULATION | PRODUCTION

> **⚠️ Mode Name Change (Jan 2026):**
> - Old "PLANNING" → Now "COSTING" 🔵 (rough estimates for quotations, supports versioning)
> - Old "COSTING" → Now "RAW_MATERIAL_CALCULATION" 🟠 (MRP for confirmed orders)
> - "PRODUCTION" 🟢 (unchanged - final locked production with stock integration)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Module Overview](#module-overview)
3. [Architecture](#architecture)
4. [File Locations](#file-locations)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [CAD Purposes Feature](#cad-purposes-feature)
9. [Stock Integration Feature](#stock-integration-feature)
10. [PRODUCTION Stock Requirement Feature](#production-stock-requirement-feature) *(v3.1)*
11. [Workflows](#workflows)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Full Module Separation](#full-module-separation-v32) *(v3.2)*
15. [Add Width Variant After Approval](#add-width-variant-after-approval-v33) *(v3.3 - New)*

---

## Executive Summary

The CAD (Consumption Average Data) Planning module calculates and manages fabric consumption per garment. It has evolved through three major phases:

| Phase | Date | Description | Status |
|-------|------|-------------|--------|
| **1.0** | 2024-12-29 | Group-based workflow | Deprecated |
| **2.0** | 2024-12-30 | Spreadsheet-style workflow | ✅ Active |
| **3.0** | 2025-01-01 | CAD Purposes + Stock Integration | ✅ Active |
| **3.1** | 2026-01-05 | PRODUCTION Stock Requirement | ✅ Active |
| **3.2** | 2026-01-05 | Full Module Separation | ✅ Active |
| **3.3** | 2026-01-05 | Add Width Variant After Approval | ✅ Active |

### Key Features (v3.3)

- **Three CAD Modes**: COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION
- **Approval Workflows**: Multi-stage approval with role-based authorization
- **Version Control**: COSTING mode supports versioning (v1, v2, v3...)
- **Locking Mechanism**: PRODUCTION mode locks when used in orders
- **Stock Integration**: Link PRODUCTION CAD to actual fabric stock
- **Variance Tracking**: Monitor differences between RAW_MATERIAL_CALCULATION vs actual PRODUCTION widths
- **Spreadsheet UI**: Inline editing with real-time calculations
- **PRODUCTION Stock Requirement** *(v3.1)*: PRODUCTION CAD can only be created if fabric stock is available. Width is taken from actual stock, not manually entered.
- **Module Separation** *(v3.2)*: Independent CAD Planning module with dedicated routes and list page.
- **Width Variants After Approval** *(v3.3)*: Add new CAD width variants even after style approval for different fabric batches. Approved rows locked; new rows can be added as PENDING.

---

## Module Overview

### Purpose

- Calculate fabric consumption per garment (CAD meters)
- Support multi-width options for cost comparison
- Enable component-level vs combined CAD (SEPARATE vs COMBINED averaging modes)
- Handle embroidery parts separately with dedicated CAD
- Track print direction (One-Way/Two-Way) for marker efficiency
- Provide size-based weighted average calculations

### Business Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    UPSTREAM DATA SOURCES                        │
├─────────────────────────────────────────────────────────────────┤
│  • Style Module (fabrics, components, sizes)                    │
│  • Greige Master (widths, costs)                                │
│  • Embroidery Master (designs, costs)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CAD PLANNING WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│  1. COSTING Mode (Quotation Stage) 🔵                           │
│     → Rough estimates for quotations                            │
│     → Greige master standard widths                             │
│     → Versioning supported (v1, v2, v3...)                      │
│                                                                 │
│  2. RAW_MATERIAL_CALCULATION Mode (Order Confirmed) 🟠          │
│     → Copy from COSTING or create new                           │
│     → MRP for confirmed orders                                  │
│     → Procurement planning estimates                            │
│                                                                 │
│  3. PRODUCTION Mode (Fabric in Stock) 🟢                        │
│     → Copy from RAW_MATERIAL_CALCULATION                        │
│     → Link to actual fabric stock                               │
│     → Variance tracking vs RAW_MATERIAL_CALCULATION             │
│     → Locks when used in orders                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DOWNSTREAM CONSUMERS                         │
├─────────────────────────────────────────────────────────────────┤
│  • Costing (fabric cost calculation)                            │
│  • Work Orders (component requirements)                         │
│  • Procurement (fabric quantity planning)                       │
│  • Cutting (layer planning)                                     │
│  • BOM (bill of materials)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Migration Timeline

| Aspect | Old (v1.0) | New (v2.0+) |
|--------|------------|-------------|
| UI Paradigm | Card per fabric group | Single flat table |
| Data Entry | Nested forms, dialogs | Inline cell editing |
| Row = | Multiple CAD widths per group | One CAD entry per row |
| Components | InlineCADTable, InlineCADRow | CADSpreadsheetTable |
| Main Endpoint | `GET /:styleId/cad-planning` | `GET /:styleId/cad-table` |

### Component Hierarchy

```
CADPlanningPage.tsx (Main)
│
├─ Header: Style info + Status badge
├─ Info Banner: Instructions
├─ Tabs: [CAD Spreadsheet] | [CAD History]
│
├─ Spreadsheet Tab
│  └─ CADSpreadsheetTable.tsx
│     ├─ Table Header (Purpose, Status, Ver, Component, Part, ...)
│     ├─ Table Rows (map over cadRows)
│     │  ├─ Purpose dropdown (PRODUCTION/PLANNING/COSTING)
│     │  ├─ Approval Status badge (PENDING/APPROVED/REJECTED)
│     │  ├─ Version/Lock indicator
│     │  ├─ Component name
│     │  ├─ Part dropdown
│     │  ├─ Greige dropdown
│     │  ├─ Width dropdown
│     │  ├─ Size Breakdown button → SizeBreakdownPopup
│     │  ├─ CAD calculations (auto)
│     │  └─ Action buttons (Approve/Reject/Version/Copy/Edit/Delete)
│     ├─ Totals Row
│     ├─ SizeBreakdownPopup
│     ├─ AddRowDialog
│     ├─ StockSelectionModal (PRODUCTION CAD)
│     └─ VarianceWarningDialog
│
└─ History Tab
   └─ CADHistoryView (historical CAD data)
```

---

## File Locations

### Backend Files

| File | Path | Purpose |
|------|------|---------|
| **Schema** | `backend/prisma/schema.prisma` | Database models (fabric_width_cad, cad_size_breakdown) |
| **Migration** | `backend/prisma/migrations/20250101000000_add_cad_purposes_approval_versioning/migration.sql` | CAD Purposes fields |
| **Controller** | `backend/src/controllers/style-cad-planning.controller.ts` | All CAD workflow handlers (4,500+ lines) |
| **Stock Controller** | `backend/src/controllers/fabric-stock.controller.ts` | Stock query endpoints |
| **Routes** | `backend/src/routes/style-cad-planning.routes.ts` | CAD API endpoint definitions |
| **Stock Routes** | `backend/src/routes/style.routes.ts` | Stock integration routes |
| **Types** | `backend/src/types/style-cad-planning.types.ts` | Type definitions (enums, interfaces) |

### Frontend Files

| File | Path | Purpose |
|------|------|---------|
| **Main Page** | `frontend/src/pages/CADPlanningPage.tsx` | Main planning workflow UI |
| **Spreadsheet** | `frontend/src/components/cad/CADSpreadsheetTable.tsx` | Spreadsheet table component (1,600+ lines) |
| **Service** | `frontend/src/services/style.service.ts` | CAD API methods |
| **Stock Service** | `frontend/src/services/fabricStockService.ts` | Stock API methods |
| **Types** | `frontend/src/types/style.types.ts` | Frontend CAD types |

### Removed/Deprecated Files

| File | Status | Replacement |
|------|--------|-------------|
| `CADEditPage.tsx` | **REMOVED** | Inline editing in CADSpreadsheetTable |
| `InlineCADTable.tsx` | **DEPRECATED** | CADSpreadsheetTable |
| `InlineCADRow.tsx` | **DEPRECATED** | Row logic in CADSpreadsheetTable |

---

## Database Schema

### Enums

```prisma
// CAD Purposes (Current Enum Values)
enum CadPurpose {
  COSTING                       // For costing purpose - rough estimates
  RAW_MATERIAL_CALCULATION      // Used once we have final order from buyer
  PRODUCTION                    // Used when fabric is inwarded; actual width determines usage
}

// OLD ENUM VALUES (DEPRECATED - For Historical Reference Only)
// PLANNING → renamed to COSTING
// Old COSTING → renamed to RAW_MATERIAL_CALCULATION
// PRODUCTION → unchanged

// CAD Status (legacy - still used at style level)
enum CADStatus {
  PENDING       // CAD planning not started
  IN_PROGRESS   // CAD planning in progress
  APPROVED      // CAD approved and locked
}

// Approval Status (new - row level)
enum CADApprovalStatus {
  PENDING    // Awaiting approval
  APPROVED   // Approved by authorized user
  REJECTED   // Rejected with notes
}

// Auto-approval Source
enum CADAutoApprovalSource {
  MANUAL           // Manually approved
  COSTING_SHEET    // Auto-approved from costing sheet
  DATA_MIGRATION   // Imported from legacy system
}

// Print Direction
enum PrintDirection {
  ONE_WAY   // All pieces face same direction
  TWO_WAY   // Pieces can face either direction
}
```

### Main Models

#### fabric_width_cad

Central CAD repository per fabric width.

**Core Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `fabricId` | UUID | FK to fabric_master |
| `purpose` | Enum | PRODUCTION / PLANNING / COSTING |
| `cutableWidth` | Decimal | Usable cutting width (inches) |
| `cadMeters` | Decimal | CAD consumption per garment |
| `cadYards` | Decimal | CAD in yards |
| `cadWastagePercent` | Decimal | Default 5% |
| `layerMarginMeters` | Decimal | Auto-calculated margin |
| `markerEfficiency` | Decimal | Marker efficiency % |
| `printDirection` | Enum | ONE_WAY / TWO_WAY |
| `piecesPerMarker` | Int | Total pieces |
| `markerLengthMeters` | Decimal | Marker length |
| `componentName` | String | For component-level CAD |
| `isPreferred` | Boolean | Recommended width |
| `greigeId` | UUID | FK to greige_master |
| `processorId` | UUID | FK to suppliers |
| `costingStyleId` | UUID | FK to styles (for costing) |

**Approval Fields (CAD Purposes v3.0):**
| Field | Type | Description |
|-------|------|-------------|
| `approvalStatus` | Enum | PENDING / APPROVED / REJECTED |
| `approvedBy` | UUID | FK to users (approver) |
| `approvedAt` | DateTime | Approval timestamp |
| `approvalNotes` | Text | Approval/rejection notes |

**Locking Fields (PRODUCTION Only):**
| Field | Type | Description |
|-------|------|-------------|
| `isLocked` | Boolean | Locked when used in orders |
| `lockedReason` | String | Why locked |
| `lockedAt` | DateTime | Lock timestamp |

**Versioning Fields (PLANNING Only):**
| Field | Type | Description |
|-------|------|-------------|
| `version` | Int | Version number (v1, v2, v3...) |
| `supersededById` | UUID | Self-FK to newer version |

**Stock Integration Fields (PRODUCTION Only):**
| Field | Type | Description |
|-------|------|-------------|
| `fabricStockId` | UUID | FK to fabric_stock |
| `procurementId` | UUID | FK to fabric_procurement |

**Variance Tracking Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `planningCadWidth` | Decimal | Original RAW_MATERIAL_CALCULATION width (stored for variance) |
| `widthVariance` | Decimal | Actual - Planning |
| `variancePercent` | Decimal | Percentage difference |

**Costing Fields (COSTING Only):**
| Field | Type | Description |
|-------|------|-------------|
| `styleCostingId` | UUID | FK to style_costing |
| `autoApprovedFrom` | Enum | COSTING_SHEET / MANUAL / DATA_MIGRATION |

**Unique Constraint:** `[fabricId, cutableWidth, componentName]`

**Relations:**
```prisma
fabric             fabric_master
createdBy          users (creator)
processor          suppliers
costingStyle       styles
approver           users (approver)
supersedes         fabric_width_cad (version history)
supersededBy       fabric_width_cad[]
fabricStock        fabric_stock
procurement        fabric_procurement
styleCosting       style_costing
bom_items          bom_items[]
styleFabrics       style_fabrics[]
costingFabricItems style_costing_fabric_items[]
sizeBreakdowns     cad_size_breakdown[]
order_items        order_items[]
```

**Indexes:** 15 indexes for performance optimization

#### cad_size_breakdown

Size-wise piece counts for weighted-average CAD calculation.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `cadId` | UUID | FK to fabric_width_cad |
| `sizeName` | String | "S", "M", "L", "XL", or custom |
| `sizeId` | UUID? | Optional FK to size_options |
| `quantity` | Int | Number of pieces |

**Unique Constraint:** `[cadId, sizeName]`

---

## API Endpoints

### CAD Spreadsheet Table Routes (v2.0+)

| Method | Endpoint | Handler | Purpose | Auth |
|--------|----------|---------|---------|------|
| GET | `/api/styles/:styleId/cad-table` | `getCADTableData` | Get spreadsheet data | All |
| POST | `/api/styles/:styleId/cad-table/row` | `addCADTableRow` | Add new CAD row | All |
| PUT | `/api/styles/:styleId/cad-table/row/:rowId` | `updateCADTableRow` | Update CAD row | All |
| DELETE | `/api/styles/:styleId/cad-table/row/:rowId` | `deleteCADTableRow` | Delete CAD row | All |
| GET | `/api/styles/cad-table/greige/:greigeId/widths` | `getGreigeWidths` | Get available widths | All |

### CAD Purposes Routes (v3.0)

| Method | Endpoint | Handler | Purpose | Auth |
|--------|----------|---------|---------|------|
| POST | `/api/styles/:styleId/cad-table/row/:rowId/approve` | `approveCADPurpose` | Approve CAD | Admin, Merchandiser |
| POST | `/api/styles/:styleId/cad-table/row/:rowId/reject` | `rejectCADPurpose` | Reject CAD | Admin, Merchandiser |
| POST | `/api/styles/:styleId/cad-table/planning/:rowId/create-version` | `createPlanningVersion` | Create new version | Admin, Merchandiser, Designer |
| POST | `/api/styles/:styleId/cad-table/copy` | `copyCADPurpose` | Copy between purposes | Admin, Merchandiser |
| POST | `/api/styles/:styleId/cad-table/link-stock` | `linkCADToStock` | Link to fabric stock | Admin, Merchandiser |

### Stock Integration Routes (v3.0)

| Method | Endpoint | Handler | Purpose | Auth |
|--------|----------|---------|---------|------|
| GET | `/api/styles/:styleId/fabric-stock` | `getStockForStyle` | Get available stock | All |

### Legacy CAD Planning Routes (v1.0 - Still Active)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| GET | `/api/styles/cad-planning/pending` | `getPendingCADStyles` | Get styles pending CAD |
| GET | `/api/styles/cad-planning/greige-options` | `getGreigeOptionsForGeneric` | Get greige options |
| GET | `/api/styles/:styleId/cad-planning` | `getEnhancedCADPlanning` | Get CAD planning (group-based) |
| GET | `/api/styles/:styleId/cad-planning/history` | `getStyleCADHistory` | Get CAD history |
| POST | `/api/styles/:styleId/cad-planning/select-greige` | `selectGreigeForGroup` | Select greige for group |
| POST | `/api/styles/cad-planning/approve` | `approveCAD` | Approve CAD plan |
| PUT | `/api/styles/cad-planning/cad/:cadId` | `updateCADValuesWithBreakdown` | Update CAD with breakdown |
| PUT | `/api/styles/cad-planning/cad/:cadId/set-preferred` | `setPreferredCAD` | Set preferred CAD |
| DELETE | `/api/styles/cad-planning/cad/:cadId` | `deleteCADWidth` | Delete CAD width |

---

## Frontend Components

### CADPlanningPage.tsx

Main page component managing tabs and data loading.

**State Variables:**

| Variable | Type | Purpose |
|----------|------|---------|
| `loading` | boolean | Initial loading |
| `saving` | boolean | Save/approve in progress |
| `style` | StyleInfo | Current style |
| `activeTab` | 'spreadsheet' \| 'history' | Active tab |
| `cadTableData` | CADTableData | Spreadsheet data |
| `loadingTableData` | boolean | Table loading |
| `tableDataError` | boolean | Table error |
| `cadHistory` | CADHistoryData | History data |
| `loadingHistory` | boolean | History loading |
| `historyError` | boolean | History error |

**Handlers:**

| Handler | Purpose |
|---------|---------|
| `loadCADTableData()` | Fetch CAD spreadsheet data |
| `loadCADHistory()` | Fetch CAD history |
| `handleSpreadsheetAddRow()` | Add new CAD row |
| `handleSpreadsheetUpdateRow()` | Update CAD row |
| `handleSpreadsheetDeleteRow()` | Delete CAD row |
| `handleApproveCAD()` | Approve entire plan |

### CADSpreadsheetTable.tsx

Core spreadsheet component with inline editing (1,600+ lines).

**State Variables:**

| Variable | Type | Purpose |
|----------|------|---------|
| `editingRow` | string \| null | Currently editing row |
| `savingRow` | string \| null | Row being saved |
| `deletingRow` | string \| null | Row being deleted |
| `sizeBreakdownOpen` | string \| null | Size popup open |
| `pendingChanges` | Record | Unsaved changes |
| `addRowDialogOpen` | boolean | Add dialog visibility |
| `addingRow` | boolean | Adding in progress |
| `stockSelectionOpen` | boolean | Stock modal open |
| `selectedRowForStock` | string \| null | Row for stock link |
| `loadingStock` | boolean | Stock loading |
| `availableStock` | Array | Available stock entries |
| `varianceWarningOpen` | boolean | Variance dialog open |
| `pendingStockSelection` | Object | Pending stock with variance |
| `approvingRow` | string \| null | Row being approved |
| `rejectingRow` | string \| null | Row being rejected |
| `creatingVersion` | string \| null | Creating version |
| `copyingRow` | string \| null | Row being copied |

**Handlers:**

| Handler | Purpose |
|---------|---------|
| `handleFieldChange()` | Track field changes |
| `handleSaveRow()` | Save pending changes |
| `handleCancelEdit()` | Cancel editing |
| `handleDeleteRow()` | Delete row |
| `handleSizeBreakdownOpen()` | Open size popup |
| `handleSizeBreakdownSave()` | Save size breakdown |
| `handleApproveCAD()` | Approve CAD row |
| `handleRejectCAD()` | Reject CAD row |
| `handleCreateVersion()` | Create new version |
| `handleCopyCAD()` | Copy to next purpose |
| `handleOpenStockSelection()` | Open stock modal |
| `handleSelectStock()` | Select stock & check variance |
| `confirmStockSelection()` | Confirm stock link |

### Spreadsheet Columns

| Column | Editable | Source | Notes |
|--------|----------|--------|-------|
| **Purpose** | Yes | Dropdown | PRODUCTION / PLANNING / COSTING |
| **Status** | No | Badge | PENDING / APPROVED / REJECTED |
| **Ver** | No | Badge/Icon | Version (PLANNING) or Lock (PRODUCTION) |
| **Component** | No | Display | From style component |
| **Part** | Yes | Dropdown | Pattern parts |
| **Finish** | No | Badge | Fabric finish type |
| **Emb.** | Yes | Switch | Embroidery flag |
| **Generic Greige** | No | Display | From style fabric |
| **Greige** | Yes | Dropdown | Filtered by generic |
| **Width** | Yes | Dropdown | From greige widths |
| **Print** | Yes | Dropdown | ONE_WAY / TWO_WAY |
| **Sizes** | Yes | Popup | Size breakdown |
| **Pcs** | No | Calculated | Sum of sizes |
| **Layer(M)** | Yes | Input | Layer length |
| **CAD Avg** | No | Calculated | (layer + margin) ÷ pieces |
| **Actions** | - | Buttons | Approve/Reject/Version/Copy/Edit/Delete/Stock |

---

## CAD Purposes Feature

### Three CAD Modes

#### 1. COSTING Mode 🔵 (Quotation Stage)

**Purpose**: Rough fabric consumption estimates for quotations

**When Created**: During quotation/costing sheet preparation

**Key Features**:
- Uses greige master standard widths (conservative estimates)
- Supports versioning (v1, v2, v3...)
- Cannot edit approved version - must create new version
- Can be auto-approved with costing sheet
- Linked to `style_costing` table
- Can be copied to RAW_MATERIAL_CALCULATION mode

**Authorization**: Admin, Merchandiser, Designer

**Workflow**:
```
1. Create COSTING CAD during quotation
2. Use greige master standard widths (e.g., 44″, 58″)
3. Enter rough consumption estimates
4. Auto-approve via costing sheet OR manual approval
5. Link to quotation via styleCostingId
6. If changes needed after approval:
   → Create new version (v1 → v2)
   → v1 marked as superseded
   → v2 becomes active
7. Copy to RAW_MATERIAL_CALCULATION mode after order confirmation
```

#### 2. RAW_MATERIAL_CALCULATION Mode 🟠 (Order Confirmed)

**Purpose**: Material Requirement Planning (MRP) for confirmed orders

**When Created**: After order confirmation from buyer, before fabric receipt

**Key Features**:
- More refined estimates for procurement planning
- Used for supplier coordination and material ordering
- Can still edit before fabric receipt
- Can be copied to PRODUCTION mode
- Version history tracked via `supersededById`

**Authorization**: Admin, Merchandiser

**Workflow**:
```
1. Create RAW_MATERIAL_CALCULATION CAD (copy from COSTING or new)
2. Refine estimates based on confirmed order details
3. Enter procurement-ready consumption data
4. Submit for approval
5. Use for fabric procurement and supplier coordination
6. Copy to PRODUCTION mode when fabric is inwarded
```

#### 3. PRODUCTION Mode 🟢 (Fabric in Stock)

**Purpose**: Actual fabric consumption for production orders

**When Created**: After fabric receipt (inwarded), before cutting

**Key Features**:
- Must link to fabric stock (actual widths received)
- Tracks variance from RAW_MATERIAL_CALCULATION mode
- Auto-locks when created (immutable)
- FIFO stock allocation
- Uses real fabric widths from stock

**Authorization**: Admin, Merchandiser

**Workflow**:
```
1. Create PRODUCTION CAD (copy from RAW_MATERIAL_CALCULATION)
2. Click "Link to Stock" button
3. Select actual fabric stock from modal
4. System calculates variance vs RAW_MATERIAL_CALCULATION
5. If variance > 5% or > 2 inches → warning dialog
6. Confirm variance and link stock
7. Submit for approval
8. Upon approval → ready for production
9. When used in orders → CAD locks automatically
```

### Approval Workflow

**Approval Statuses**:
- **PENDING**: Awaiting approval (yellow badge)
- **APPROVED**: Approved by authorized user (green badge)
- **REJECTED**: Rejected with notes (red badge)

**Approval Process**:
```
1. CAD row created → Status: PENDING
2. User fills all required fields
3. User or authorized personnel clicks "Approve" button
4. System records:
   - approvedBy (user ID)
   - approvedAt (timestamp)
   - approvalNotes (optional)
5. Status changes to APPROVED
6. CAD now available for downstream use
```

**Rejection Process**:
```
1. Authorized user clicks "Reject" button
2. Prompt for rejection reason (required)
3. System records rejection notes
4. Status changes to REJECTED
5. User can edit and resubmit
```

### Version Control (COSTING Mode Only)

**Why Versioning?**

COSTING mode estimates often need refinement based on:
- Pattern adjustments after sample feedback
- Fabric width changes from suppliers
- Marker efficiency improvements
- Component design changes

**How It Works**:
```
1. v1 APPROVED and in use
2. Need to make changes
3. Click "Create Version" button on v1
4. System creates v2:
   - Copies all fields from v1
   - Increments version number
   - Links v2.supersededById → v1.id
   - Sets v2.approvalStatus = PENDING
   - Copies size breakdowns
5. Edit v2 as needed
6. Approve v2
7. v1 remains visible (audit trail)
8. v2 becomes active version
```

**Version Indicators**:
- Version badge in "Ver" column (e.g., "v2")
- GitBranch icon
- Superseded versions show "Superseded by v2" tooltip

### Locking Mechanism (PRODUCTION Mode Only)

**Why Locking?**

Once PRODUCTION mode CAD is used in orders/cutting, it must remain immutable to maintain data integrity.

**Lock Triggers**:
- CAD used in work orders
- CAD used in cutting batches
- CAD referenced by BOMs
- Manual lock by admin

**Lock Indicators**:
- Lock icon (🔒) in "Ver" column
- Edit button disabled
- Delete button disabled
- Hover tooltip shows lock reason

**Unlocking**:
- Requires admin authorization
- Only if no downstream dependencies
- Records unlock reason

### Copy Between Modes

**Allowed Copy Paths**:
- COSTING → RAW_MATERIAL_CALCULATION (after order confirmation)
- RAW_MATERIAL_CALCULATION → PRODUCTION (after fabric inwarded)

**Not Allowed**:
- PRODUCTION → anywhere (use locked data for audit)
- RAW_MATERIAL_CALCULATION → COSTING (backwards flow)

**Copy Process**:
```
1. Click "Copy" button on APPROVED CAD
2. System determines target mode:
   - COSTING → RAW_MATERIAL_CALCULATION
   - RAW_MATERIAL_CALCULATION → PRODUCTION
3. Creates new CAD row:
   - Copies all fields
   - Changes purpose to target mode
   - Resets approvalStatus to PENDING
   - If target = PRODUCTION:
     → Stores rawMaterialCalcWidth for variance tracking
4. User can edit new CAD
5. Submit for approval
```

---

## Stock Integration Feature

### Overview

Stock Integration links PRODUCTION CAD to actual fabric stock entries, ensuring consumption calculations use real-world fabric widths.

### When to Use

- **PRODUCTION Mode Only**: Feature only available for PRODUCTION purpose
- **After Fabric Receipt**: Fabric must be received and inwarded into stock
- **Before Approval**: Link stock before approving PRODUCTION CAD

### Prerequisites

Before linking:
1. Fabric stock entry exists with:
   - `originStyleId` = current style ID, OR
   - Procurement with `orderedForStyleId` = current style ID
   - Status: `AVAILABLE`
   - Finished width and cutable width values
2. PRODUCTION CAD row created with status PENDING
3. User has Admin or Merchandiser role

### Linking Workflow

#### Step 1: Create PRODUCTION CAD

```
1. Navigate to CAD Planning page
2. Click "Add Row"
3. Select Purpose: PRODUCTION
4. Fill in component, part, greige
5. Save row (status: PENDING)
```

#### Step 2: Click "Link to Stock"

**Button Location**: Actions column (📦 table icon)

**Button Visibility**:
- Only appears for PRODUCTION CAD
- Only appears when status = PENDING
- Hidden for PLANNING and COSTING

#### Step 3: Stock Selection Modal

**Modal Contents**:

| Column | Description |
|--------|-------------|
| Fabric Name | Full fabric name |
| Fabric Code | Fabric reference code |
| Greige Name | Greige composition |
| Finished Width | Actual width received (inches) |
| Cutable Width | Usable width for cutting (inches) |
| Quantity | Meters available |
| Quality | A, B, or DEFECT |
| Roll Numbers | Physical roll IDs |
| Received Date | Stock receipt date |
| Actions | Select button |

**Sorting**: FIFO (First In, First Out) by received date

**Filtering**:
- By fabricId (optional)
- By status (default: AVAILABLE)
- By qualityGrade (optional)

#### Step 4: Variance Check

When stock selected, system:

1. Checks if RAW_MATERIAL_CALCULATION CAD exists for same component/part
2. Compares widths:
   - Planning width (estimated)
   - Stock width (actual)
3. Calculates variance:
   - Absolute: actual - planning (e.g., -1.5″)
   - Percentage: ((actual - planning) / planning) × 100

**Variance Thresholds**:
- If |variance| > 5% OR |variance| > 2 inches → Show warning
- Otherwise → Proceed silently

**Variance Warning Dialog**:

```
⚠️ Width Variance Detected

RAW_MATERIAL_CALCULATION:  44.0″ (estimated)
STOCK WIDTH:   42.5″ (actual from Roll R123)
Variance:      -1.5″ (-3.4%)

Impact Analysis:
✗ Narrower width requires more fabric
  Estimated impact: +15 meters for 1000 pieces

Stock Details:
- Roll Numbers: R123, R124
- Quality Grade: A
- Quantity Available: 500 meters

[Cancel]  [Use Actual Width]
```

**Color Coding**:
- Red text: Negative variance (narrower width)
- Green text: Positive variance (wider width)

#### Step 5: Confirm Selection

Click "Use Actual Width":

**Actions Performed**:
1. Updates CAD row:
   - `cutableWidth` = stock.cutableWidth
   - `greigeId` = stock.greigeId
   - `fabricStockId` = stock.id
   - `procurementId` = stock.procurementId
2. If RAW_MATERIAL_CALCULATION CAD exists:
   - `planningCadWidth` = rawMaterialCalcCAD.cutableWidth
   - `widthVariance` = actual - planning
   - `variancePercent` = percentage
3. Recalculates CAD average with new width
4. Saves to database
5. Shows success notification

#### Step 6: Stock Badge Display

**Badge Location**: Cutable Width cell

**Badge Format**: `📦 [Grade]`

**Badge Styles**:
- Small badge (9px font)
- Blue outline (`border-blue-200`)
- Blue background (`bg-blue-50`)

**Badge Tooltip**:
```
Stock: R123, R124
Grade: A
Quantity: 500m
```

### Stock Query API

**Endpoint**: `GET /api/styles/:styleId/fabric-stock`

**Query Parameters**:
```typescript
{
  fabricId?: string;      // Filter by specific fabric
  status?: string;        // Default: AVAILABLE
  qualityGrade?: string;  // A, B, DEFECT
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "stock-uuid",
      "fabricId": "fabric-uuid",
      "fabricName": "Cotton Voile",
      "fabricCode": "CV-001-BLUE",
      "colorName": "Sky Blue",
      "greigeId": "greige-uuid",
      "greigeName": "Cotton Plain 60x60",
      "finishedWidth": 45.0,
      "cutableWidth": 43.0,
      "quantityAvailable": 2400,
      "qualityGrade": "A",
      "rollNumbers": "R145, R146, R147",
      "receivedDate": "2025-12-15T00:00:00Z",
      "procurementId": "proc-uuid",
      "originStyleId": "style-uuid",
      "status": "AVAILABLE"
    }
  ],
  "count": 1
}
```

### Link CAD to Stock API

**Endpoint**: `POST /api/styles/:styleId/cad-table/link-stock`

**Request Body**:
```json
{
  "cadId": "cad-row-uuid",
  "fabricStockId": "stock-uuid",
  "procurementId": "proc-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "CAD linked to stock successfully",
  "data": {
    "cadId": "cad-row-uuid",
    "fabricStockId": "stock-uuid",
    "procurementId": "proc-uuid",
    "planningCadWidth": 44.0,
    "widthVariance": -1.0,
    "variancePercent": -2.27
  }
}
```

### Variance Tracking

**Purpose**: Monitor differences between estimated (PLANNING) and actual (PRODUCTION) fabric widths

**Fields Stored**:
- `planningCadWidth`: Original RAW_MATERIAL_CALCULATION width (inches)
- `widthVariance`: Actual - Planning (e.g., -1.5″)
- `variancePercent`: Percentage difference (e.g., -3.4%)

**Use Cases**:
1. **Quality Control**: Identify supplier consistency issues
2. **Procurement Refinement**: Adjust future estimates
3. **Cost Variance**: Explain fabric cost differences
4. **Supplier Performance**: Track width accuracy by supplier

**Variance Reports** (Future):
- Variance summary dashboard
- Alerts when variance exceeds threshold
- Supplier variance scorecards
- Historical variance trends

---

## PRODUCTION Stock Requirement Feature

*(Added in v3.1 - 2026-01-05)*

### Overview

**Business Rule**: PRODUCTION CAD can only be created if fabric stock is available and has been GRN'd (Goods Receipt Note). The cutable width is automatically taken from the actual stock, not manually entered.

This ensures:
- PRODUCTION CAD always uses real fabric dimensions
- No PRODUCTION CAD can be created without available stock
- Width comes from actual received fabric, preventing estimation errors

### Purpose-Specific Behavior

| Purpose | Stock Required? | Width Source | Use Case |
|---------|-----------------|--------------|----------|
| **COSTING** | ❌ No | Manual entry / Greige master | Quotation estimates |
| **PLANNING** | ❌ No | Manual entry / Greige master | Sample/pre-production planning |
| **PRODUCTION** | ✅ Yes | From actual stock | Bulk production (real widths) |

### Add CAD Rows Dialog Changes

The "Add CAD Rows" dialog now includes:

1. **Purpose Selector** (dropdown at top):
   - PLANNING - For estimation (no stock required) *(default)*
   - COSTING - For cost analysis (no stock required)
   - PRODUCTION - For actual cutting (stock required)

2. **Stock Selection** (shown only when PRODUCTION selected):
   - Dropdown populated with available stock
   - Shows fabric code, width, quantity, quality grade
   - Required field - cannot proceed without selection

3. **Warning Message** (when PRODUCTION selected):
   > ⚠️ PRODUCTION CAD requires available fabric stock. Width will be taken from actual stock.

### Frontend Implementation

#### New State Variables (CADSpreadsheetTable.tsx)

```typescript
// Purpose selection for new CAD rows
const [selectedPurpose, setSelectedPurpose] = useState<CADPurpose>('PLANNING');

// Stock selection for PRODUCTION CAD rows (required)
const [selectedStockForProduction, setSelectedStockForProduction] = useState<string | null>(null);
const [productionStockOptions, setProductionStockOptions] = useState<FabricStockForCAD[]>([]);
const [loadingProductionStock, setLoadingProductionStock] = useState(false);
```

#### Updated Callback Signatures

```typescript
// Props interface updated to include purpose and fabricStockId
onAddRow: (
  styleFabricId: string,
  partId?: string,
  purpose?: CADPurpose,
  fabricStockId?: string
) => Promise<void>;

onAddCombinedRow?: (
  styleFabricIds: string[],
  purpose?: CADPurpose,
  fabricStockId?: string
) => Promise<void>;
```

#### Load Stock Function

```typescript
const loadProductionStock = async () => {
  setLoadingProductionStock(true);
  try {
    const firstFabric = styleFabrics.find(sf => selectedStyleFabrics.includes(sf.id));
    const embroideryFilter = firstFabric?.hasEmbroidery ? undefined : null;

    const stock = await fabricStockService.getStockForStyle(styleId, {
      status: 'AVAILABLE',
      embroideryId: embroideryFilter,
    });
    setProductionStockOptions(stock);
  } catch (error) {
    notify.error(`Failed to load stock: ${error.message}`);
    setProductionStockOptions([]);
  } finally {
    setLoadingProductionStock(false);
  }
};
```

#### Button Disabling Logic

```typescript
// Add button disabled when:
disabled={
  addingRow ||
  selectedStyleFabrics.length === 0 ||
  (selectedPurpose === 'PRODUCTION' && !selectedStockForProduction)
}
```

### Backend Implementation

#### Controller Validation (style-cad-planning.controller.ts)

**addCADTableRow function:**

```typescript
const { purpose = 'PRODUCTION', fabricStockId, ...otherFields } = req.body;

// PRODUCTION PURPOSE: Require fabric stock selection
let stockCutableWidth: number | null = null;
let validatedStock: any = null;

if (purpose === 'PRODUCTION') {
  if (!fabricStockId) {
    return res.status(400).json({
      success: false,
      message: 'PRODUCTION CAD requires fabric stock. Please select available stock or use PLANNING/COSTING purpose.',
      hint: 'For planning purposes, create a PLANNING or COSTING row first. Once stock is available, create a PRODUCTION row.',
    });
  }

  // Validate stock exists and has available quantity
  validatedStock = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockId },
    include: { fabricMaster: { include: { greige: true } }, embroidery: true },
  });

  if (!validatedStock) {
    return res.status(404).json({ success: false, message: 'Selected fabric stock not found.' });
  }

  if (Number(validatedStock.quantityAvailable) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Selected stock has no available quantity. Please select a different stock or wait for GRN.',
    });
  }

  if (validatedStock.status !== 'AVAILABLE') {
    return res.status(400).json({
      success: false,
      message: `Selected stock is not available (status: ${validatedStock.status}). Please select an AVAILABLE stock.`,
    });
  }

  // Use width from stock - this is the key business rule
  stockCutableWidth = Number(validatedStock.cutableWidth);
}
```

**CAD Creation with Stock Values:**

```typescript
const newCad = await prisma.fabric_width_cad.create({
  data: {
    // ... other fields
    // For PRODUCTION: use fabric from stock
    fabricId: purpose === 'PRODUCTION' && validatedStock
      ? validatedStock.fabricId
      : styleFabric.fabricId || undefined,
    // For PRODUCTION: use width from stock
    cutableWidth: purpose === 'PRODUCTION' && stockCutableWidth !== null
      ? stockCutableWidth
      : 0,
    purpose,
    // PRODUCTION: Link to stock
    fabricStockId: purpose === 'PRODUCTION' ? fabricStockId : undefined,
    greigeId: purpose === 'PRODUCTION' && validatedStock?.fabricMaster?.greigeId
      ? validatedStock.fabricMaster.greigeId
      : undefined,
  },
});
```

### API Request/Response

#### Request (POST /api/styles/:styleId/cad-table/row)

```json
{
  "styleFabricId": "sf-uuid",
  "componentId": "",
  "purpose": "PRODUCTION",
  "fabricStockId": "stock-uuid"
}
```

#### Response (Success - 201)

```json
{
  "success": true,
  "data": {
    "id": "cad-uuid",
    "purpose": "PRODUCTION",
    "cutableWidth": 43.5,
    "fabricStockId": "stock-uuid",
    "stockInfo": {
      "id": "stock-uuid",
      "rollNumbers": "R101, R102",
      "quantityAvailable": 250.5,
      "qualityGrade": "A",
      "cutableWidth": 43.5
    }
  },
  "message": "PRODUCTION CAD row created with stock (Width: 43.5\")"
}
```

#### Response (Error - 400 No Stock)

```json
{
  "success": false,
  "message": "PRODUCTION CAD requires fabric stock. Please select available stock or use PLANNING/COSTING purpose.",
  "hint": "For planning purposes, create a PLANNING or COSTING row first. Once stock is available, create a PRODUCTION row."
}
```

### UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADD CAD ROWS DIALOG                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CAD Purpose                                             │    │
│  │ ┌─────────────────────────────────────────────────────┐ │    │
│  │ │ PLANNING - For estimation (no stock required) ▼     │ │    │
│  │ └─────────────────────────────────────────────────────┘ │    │
│  │ Options:                                                │    │
│  │   🕐 PLANNING - For estimation (no stock required)      │    │
│  │   💰 COSTING - For cost analysis (no stock required)    │    │
│  │   📦 PRODUCTION - For actual cutting (stock required)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [If PRODUCTION selected:]                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ⚠️ PRODUCTION CAD requires available fabric stock.      │    │
│  │    Width will be taken from actual stock.               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Select component-fabric pairs:                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ☑ Body - Cotton Voile (CV-001)                          │    │
│  │ ☑ Sleeve - Cotton Voile (CV-001)                        │    │
│  │ ☐ Collar - Poplin (POP-002)                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [If PRODUCTION selected:]                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Select Available Stock (Required)          [Refresh]    │    │
│  │ ┌─────────────────────────────────────────────────────┐ │    │
│  │ │ CV-001 • 43.5" width • 250m avail • Grade A        │ │    │
│  │ │ Cotton Plain 60x60 • Rolls: R101, R102             │ │    │
│  │ └─────────────────────────────────────────────────────┘ │    │
│  │                                                         │    │
│  │ ✓ Stock selected. Width will be auto-set from stock.   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Cancel]  [Combine as 1 PRODUCTION Row]  [Add 2 PRODUCTION Rows]│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Testing Checklist

#### Backend Tests

- [ ] PRODUCTION CAD creation fails without fabricStockId (400 error)
- [ ] PRODUCTION CAD creation fails with non-existent stock (404 error)
- [ ] PRODUCTION CAD creation fails with zero-quantity stock (400 error)
- [ ] PRODUCTION CAD creation fails with non-AVAILABLE status stock (400 error)
- [ ] PRODUCTION CAD creation succeeds with valid stock
- [ ] Width is correctly taken from stock.cutableWidth
- [ ] fabricStockId is saved to CAD record
- [ ] greigeId is taken from stock's fabric master
- [ ] PLANNING CAD creation succeeds without stock
- [ ] COSTING CAD creation succeeds without stock
- [ ] Combined row creation follows same rules

#### Frontend Tests

- [ ] Purpose selector shows all three options
- [ ] Default purpose is PLANNING
- [ ] Stock selector only appears for PRODUCTION
- [ ] Warning message appears for PRODUCTION
- [ ] Stock options load when PRODUCTION selected
- [ ] Stock dropdown shows fabric code, width, quantity, grade
- [ ] Add button disabled when PRODUCTION + no stock selected
- [ ] Combine button disabled when PRODUCTION + no stock selected
- [ ] Button text includes purpose (e.g., "Add 2 PRODUCTION Rows")
- [ ] State resets when dialog closes
- [ ] Success message includes purpose

### Troubleshooting

#### Issue: "PRODUCTION CAD requires fabric stock" error

**Cause**: Trying to create PRODUCTION CAD without selecting stock

**Solution**:
1. Select a purpose of PLANNING or COSTING if no stock available
2. Or wait for fabric GRN and select from available stock

#### Issue: Stock dropdown empty for PRODUCTION

**Cause**: No available stock for the selected style/fabric

**Solution**:
1. Verify fabric has been received (GRN'd)
2. Check stock status is AVAILABLE
3. Check stock quantity > 0
4. For embroidery fabrics, ensure embroidered stock exists

#### Issue: Cannot change purpose after CAD created

**Cause**: Purpose is set at creation time

**Solution**:
1. Delete the CAD row
2. Create new CAD row with correct purpose

---

## Workflows

### Complete CAD Planning Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUOTATION STAGE                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Create COSTING CAD                                          │
│     - Purpose: COSTING                                          │
│     - Width: Greige master standard (44″, 58″)                  │
│     - Consumption: Conservative estimate                        │
│     - Link to style_costing                                     │
│     - Approve via costing sheet                                 │
│                                                                 │
│  2. Quotation Sent                                              │
│     - Fabric cost calculated from COSTING CAD                   │
│     - Customer receives quote                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Order Received
┌─────────────────────────────────────────────────────────────────┐
│                    SAMPLE STAGE                                 │
├─────────────────────────────────────────────────────────────────┤
│  3. Copy COSTING → PLANNING CAD                                 │
│     - Click "Copy" on APPROVED COSTING CAD                      │
│     - New PLANNING CAD created (v1)                             │
│     - Status: PENDING                                           │
│                                                                 │
│  4. Refine PLANNING CAD v1                                      │
│     - Update widths based on sample                             │
│     - Adjust consumption                                        │
│     - Approve v1                                                │
│                                                                 │
│  5. Sample Feedback (if needed)                                 │
│     - Create v2 from v1 ("Create Version")                      │
│     - Make adjustments                                          │
│     - Approve v2                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Sample Approved
┌─────────────────────────────────────────────────────────────────┐
│                    FABRIC PROCUREMENT                           │
├─────────────────────────────────────────────────────────────────┤
│  6. Order Fabric                                                │
│     - Use PLANNING CAD for quantity calculation                 │
│     - Expected width from PLANNING CAD                          │
│                                                                 │
│  7. Fabric Received                                             │
│     - Actual width may differ                                   │
│     - Create fabric stock entry                                 │
│     - Record finishedWidth, cutableWidth                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Fabric in Stock
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION STAGE                             │
├─────────────────────────────────────────────────────────────────┤
│  8. Copy PLANNING → PRODUCTION CAD                              │
│     - Click "Copy" on APPROVED PLANNING CAD                     │
│     - New PRODUCTION CAD created                                │
│     - Status: PENDING                                           │
│                                                                 │
│  9. Link to Stock                                               │
│     - Click "📦 Link to Stock" button                           │
│     - Select actual stock entry (FIFO)                          │
│     - Variance check vs PLANNING CAD                            │
│     - Confirm variance (if > 5% or > 2″)                        │
│     - CAD updated with actual width                             │
│                                                                 │
│ 10. Approve PRODUCTION CAD                                      │
│     - Review all details                                        │
│     - Click "Approve"                                           │
│     - Status: APPROVED                                          │
│                                                                 │
│ 11. Create Work Order                                           │
│     - Uses APPROVED PRODUCTION CAD                              │
│     - CAD automatically locks (isLocked = true)                 │
│     - Edit/Delete disabled                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Production Complete
┌─────────────────────────────────────────────────────────────────┐
│                    POST-PRODUCTION                              │
├─────────────────────────────────────────────────────────────────┤
│ 12. Variance Analysis                                           │
│     - Compare PLANNING vs PRODUCTION widths                     │
│     - Identify cost variance                                    │
│     - Update future estimates                                   │
│     - Rate supplier consistency                                 │
└─────────────────────────────────────────────────────────────────┘
```

### CAD Calculation

**Formula**:
```
CAD Average = (Layer Length + Layer Margin) ÷ Pieces Per Marker

Where:
- Layer Length = User-entered (meters)
- Layer Margin = Auto-calculated based on layer length
- Pieces Per Marker = Sum of size breakdown quantities
```

**Layer Margin Defaults**:

| Layer Length (m) | Margin (m) | Reason |
|------------------|------------|--------|
| ≤ 0 | 0.02 | Minimum 2cm |
| ≤ 1 | 0.02 | Small layers |
| ≤ 5 | 0.05 | Medium layers |
| ≤ 10 | 0.10 | Large layers |
| ≤ 20 | 0.20 | Very large layers |
| > 20 | 0.30 | Huge layers |

**Example**:
```
Style: Cotton Dress
Component: Body
Part: Front + Back
Sizes: S=10, M=20, L=15, XL=5 (total 50 pieces)
Layer Length: 45 meters
Layer Margin: 0.10 meters (auto)

CAD Average = (45 + 0.10) ÷ 50 = 0.902 meters/piece
```

### Cost Calculation

**Effective Consumption**:
```
Effective = CAD × (1 + wastage%)
         = 0.902 × (1 + 0.05)
         = 0.947 meters/piece
```

**Total Fabric Cost**:
```
Cost = Effective × Fabric Rate
     = 0.947 × $5.00/meter
     = $4.74/piece
```

---

## Testing

### Backend Testing Checklist

- [ ] **Approval Endpoints**
  - [ ] Approve PENDING CAD
  - [ ] Reject PENDING CAD with notes
  - [ ] Prevent approve if already APPROVED
  - [ ] Prevent approve if REJECTED (must re-edit first)

- [ ] **Versioning**
  - [ ] Create version from APPROVED PLANNING CAD
  - [ ] Increment version number (v1 → v2)
  - [ ] Copy size breakdowns
  - [ ] Link supersededById correctly

- [ ] **Copy Between Purposes**
  - [ ] Copy COSTING → PLANNING
  - [ ] Copy PLANNING → PRODUCTION
  - [ ] Block invalid copy paths
  - [ ] Track planning width when copying to PRODUCTION

- [ ] **Stock Integration**
  - [ ] Query stock for style
  - [ ] Filter by fabricId, status, qualityGrade
  - [ ] Link CAD to stock
  - [ ] Calculate variance vs PLANNING CAD
  - [ ] Update cutable width from stock

- [ ] **Authorization**
  - [ ] Admin can approve all
  - [ ] Merchandiser can approve all
  - [ ] Designer can only approve PLANNING
  - [ ] Block unauthorized users

- [ ] **Locking**
  - [ ] Lock CAD when used in order
  - [ ] Prevent edit on locked CAD
  - [ ] Prevent delete on locked CAD

### Frontend Testing Checklist

- [ ] **UI Components**
  - [ ] Purpose badges show correct colors
  - [ ] Approval status badges display
  - [ ] Version badges for PLANNING CAD
  - [ ] Lock icon for locked PRODUCTION CAD
  - [ ] Stock badge after linking

- [ ] **Action Buttons**
  - [ ] Approve button (only PENDING)
  - [ ] Reject button (only PENDING)
  - [ ] Create Version (only APPROVED PLANNING)
  - [ ] Copy button (not for PRODUCTION)
  - [ ] Link to Stock (only PENDING PRODUCTION)
  - [ ] Edit disabled when locked
  - [ ] Delete disabled when locked

- [ ] **Stock Integration UI**
  - [ ] Stock modal opens
  - [ ] Stock table displays correct data
  - [ ] FIFO sorting by received date
  - [ ] Variance warning appears (> 5% or > 2″)
  - [ ] Variance dialog shows impact
  - [ ] Stock badge appears after link

- [ ] **Workflows**
  - [ ] Create COSTING → Approve → Copy to PLANNING
  - [ ] Create PLANNING → Approve → Version → Approve v2
  - [ ] Copy PLANNING → PRODUCTION → Link Stock → Approve
  - [ ] Use in order → Verify lock

### Integration Testing

- [ ] **End-to-End Flow**
  1. Create COSTING CAD
  2. Approve COSTING CAD
  3. Copy to PLANNING CAD (v1)
  4. Approve v1
  5. Create v2 from v1
  6. Approve v2
  7. Copy v2 to PRODUCTION CAD
  8. Create fabric stock entry
  9. Link PRODUCTION CAD to stock
  10. Verify variance calculated
  11. Approve PRODUCTION CAD
  12. Create work order using CAD
  13. Verify CAD locked

- [ ] **Variance Scenarios**
  - [ ] No PLANNING CAD → No variance
  - [ ] Exact match → No warning
  - [ ] 3% variance → Warning shown
  - [ ] 8% variance → Warning shown
  - [ ] -2.5″ variance → Warning shown
  - [ ] User confirms → CAD updated

---

## Architecture Decisions & Design Rationale

### Why Fabric Master Has NO Embroidery Field (By Design)

#### The Architecture Decision

Looking at the Fabric Master form, there is **intentionally no embroidery field** because:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EMBROIDERY IS A VALUE-ADDITION PROCESS               │
│                    NOT A FABRIC DEFINITION PROPERTY                     │
└─────────────────────────────────────────────────────────────────────────┘

FABRIC MASTER defines:              FABRIC STOCK tracks:
├── What the fabric IS              ├── Same base fabric
├── Greige base                     ├── Same properties
├── Finish type                     ├── PLUS: embroideryId (if embroidered)
├── Color                           ├── Reduced cutable width
├── Width specifications            └── Embroidery cost added
└── GSM, construction, etc.

WHY?
- Same fabric (e.g., "Navy Viscose Shantoon 56") can exist in stock as:
  - Plain (embroideryId: null)
  - Embroidered with Design A (embroideryId: EMB-001)
  - Embroidered with Design B (embroideryId: EMB-002)
- All share the SAME fabric master entry!
- Embroidery is applied TO existing fabric stock, creating new stock entries
```

#### The Correct Flow

```
Fabric Master (FAB-001)          Embroidery Master (EMB-001)
"Navy Viscose Shantoon"          "Floral Pattern A"
         │                                │
         ▼                                │
   Fabric Stock Entry                     │
   (Plain, 500m)                          │
         │                                │
         ├── 300m stays plain ────────────┼──▶ Used for Pallazo & Blouse (plain)
         │                                │
         └── 200m sent for embroidery ────┼──▶ Embroidery Send Out
                                          │           │
                                          ▼           ▼
                                   New Fabric Stock Entry
                                   (Embroidered, 195m)
                                   embroideryId: EMB-001
                                          │
                                          ▼
                                   Used for Blouse (embroidered parts)
```

#### What This Means for CAD Planning

| Module | Embroidery Field? | Purpose |
|--------|-------------------|---------|
| Fabric Master | ❌ NO | Defines base fabric properties |
| Fabric Stock | ✅ YES (`embroideryId`) | Tracks whether stock is embroidered |
| Style Fabrics | ✅ YES (`hasEmbroidery`, `embroideryId`) | Defines component needs |
| CAD Planning | ✅ YES (`isEmbroidery`) | Groups by embroidery for consumption |

### Bug Fixes Documented

#### Bug: Embroidery Data Loss in CAD Row Creation

**Status:** ✅ FIXED

**Location:** `backend/src/controllers/style-cad-planning.controller.ts:3606`

**Problem:** When creating CAD rows, embroidery flag was not copied from styleFabric, causing data loss.

**Fix Applied:**
```typescript
// Fixed at line 3606:
isEmbroidery: styleFabric.hasEmbroidery || false,  // Use from styleFabric, not request body
```

**Impact:** CAD rows now correctly preserve embroidery status from style fabrics.

### Complete Fabric Flow (Greige to CAD Planning)

#### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MASTER DATA                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GREIGE MASTER                    EMBROIDERY MASTER                          │
│  ┌────────────────────┐           ┌────────────────────┐                     │
│  │ Viscose Shantoon   │           │ EMB-001: Floral    │                     │
│  │ - greigeWidth: 60" │           │ - costPerMeter: ₹50│                     │
│  │ - genericName:     │           │ - designName       │                     │
│  │   "Viscose Shantoon"│          └────────────────────┘                     │
│  ├────────────────────┤                                                      │
│  │ Georgette          │                                                      │
│  │ - greigeWidth: 54" │                                                      │
│  │ - genericName:     │                                                      │
│  │   "Georgette"      │                                                      │
│  └────────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                    ↓ (After Processing/Dyeing)
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FABRIC MASTER (Finished Fabric)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FAB-001: Navy Viscose Shantoon      FAB-002: Navy Georgette                │
│  ┌────────────────────────────┐      ┌────────────────────────────┐          │
│  │ greigeId: Viscose Shantoon │      │ greigeId: Georgette        │          │
│  │ genericGreigeName:         │      │ genericGreigeName:         │          │
│  │   "Viscose Shantoon"       │      │   "Georgette"              │          │
│  │ finishType: DYED           │      │ finishType: DYED           │          │
│  │ colorName: Navy Blue       │      │ colorName: Navy Blue       │          │
│  │ actualWidth: 58"           │      │ actualWidth: 52"           │          │
│  │ cutableWidth: 56"          │      │ cutableWidth: 50"          │          │
│  └────────────────────────────┘      └────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                    ↓ (When Stock Received)
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FABRIC STOCK                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Stock Entry 1: Plain Dyed            Stock Entry 2: After Embroidery        │
│  ┌────────────────────────────┐      ┌────────────────────────────┐          │
│  │ fabricId: FAB-001          │      │ fabricId: FAB-001          │          │
│  │ finishedWidth: 58"         │  →   │ finishedWidth: 58"         │          │
│  │ cutableWidth: 56"          │  →   │ cutableWidth: 54" (reduced)│          │
│  │ embroideryId: null         │      │ embroideryId: EMB-001      │          │
│  │ quantityAvailable: 500m    │      │ quantityAvailable: 200m    │          │
│  │ qualityGrade: A            │      │ qualityGrade: A            │          │
│  └────────────────────────────┘      └────────────────────────────┘          │
│                                                                              │
│  Note: Embroidered stock is created via embroidery_send_out workflow        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                    ↓ (CAD Planning)
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAD PLANNING MODULE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRODUCTION CAD linked to actual stock                                       │
│  ┌────────────────────────────┐      ┌────────────────────────────┐          │
│  │ Purpose: PRODUCTION        │      │ Purpose: PRODUCTION        │          │
│  │ fabricStockId: Stock-1     │      │ fabricStockId: Stock-2     │          │
│  │ cutableWidth: 56" (actual) │      │ cutableWidth: 54" (actual) │          │
│  │ CAD Average: 0.902 m/pc    │      │ CAD Average: 0.401 m/pc    │          │
│  └────────────────────────────┘      └────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Summary: Complete Flow

```
GREIGE MASTER                    EMBROIDERY MASTER
     │                                   │
     ▼                                   │
FABRIC MASTER (after dyeing)             │
     │                                   │
     ▼                                   │
FABRIC STOCK (plain dyed) ─────────────────┼───────────▶ EMBROIDERY SEND OUT
     │                                   │                      │
     │                                   ▼                      ▼
     │                           FABRIC STOCK (embroidered) ◄───┘
     │                                   │
     ▼                                   ▼
STYLE MASTER ◄───────────────────────────────────────────────────
(style_fabrics: defines what each component needs)
     │
     ▼
CAD GROUPS (auto-generated from style_fabrics)
     │
     ▼
CAD PLANNING (consumption calculation)
     │
     ├── Link to plain dyed stock
     └── Link to embroidered stock
     │
     ▼
PRODUCTION (cutting, stitching, etc.)
```

### Multi-Component Selection Enhancement

#### User Request Context

**Problem:** "Now if a style has multiple components and if those need to be planned together how do I select multiple components?"

#### Architecture Clarification

The system does NOT have a simple "components" concept. The actual architecture is:

```
styles
  └─ style_components (e.g., "Blouse", "Skirt", "Belt")
      └─ style_fabrics (junction table: component × fabric pairing)
          └─ fabric_width_cad (CAD rows linked to style_fabrics)
```

**What User Actually Selects:**
- NOT components directly
- Instead: `style_fabrics` (component-fabric pairs)
- Example: "Blouse + Cotton Voile (PRINTED)" is ONE style_fabric

#### Solution: Multi-Select Style Fabrics

The "Add CAD Rows" dialog allows users to select multiple `style_fabrics` at once and batch-create CAD rows.

**Features:**
- Checkbox selection for multiple component-fabric pairs
- "Select All" toggle
- Selected count display
- Button text shows count: "Add 3 Rows"
- Batch creation (calls API N times for N selections)

**Benefits:**
- **Time Saved:** 60-70% fewer clicks for multi-component styles
- **Consistency:** All selected fabrics get same purpose at once
- **Simple:** Reuses existing API, no backend changes needed

### Complete Module Integration Map

#### Upstream Data Sources (INTO CAD Planning)

| Data | Source Table | Usage in CAD |
|------|--------------|--------------|
| Style fabrics | `style_fabrics` | Groups fabrics for CAD planning |
| Generic fabric name | `style_fabrics.genericGreigeName` | Grouping key |
| Fabric finish type | `style_fabrics.fabricFinishType` | Grouping key (PLAIN/DYED/PRINTED) |
| Components | `style_components` | Component-level CAD (SEPARATE mode) |
| Variants/Sizes | `style_variants` | Pre-populates size breakdown rows |
| Embroidery flag | `style_fabrics.hasEmbroidery` | Creates separate CAD groups |
| Greige width | `greige_master.greigeWidth` | Calculates cutable widths |
| Cost per meter | `greige_master.costPerMeter` | Fabric rate calculations |
| Embroidery design | `embroidery` | Separate CAD groups for embroidered fabrics |
| Cost per meter | `embroidery.costPerMeter` | Additional costing |

#### Downstream Data Consumers (FROM CAD Planning)

**1. Costing Module**

| Consumer | FK Column | Data Used |
|----------|-----------|-----------|
| `order_items` | `selectedCadId` | Order-specific CAD selection |
| `order_item_costing` | `selectedCadId` | Fabric cost = cadMeters × fabricRate |
| `style_costing_fabric_items` | `fabricCADId` | Style-level costing |
| `cost_sheet_items` | `selectedCadId` | Cost sheet generation |

**2. Work Orders Module**

| Consumer | FK Column | Data Used |
|----------|-----------|-----------|
| `work_order_components` | `fabricCADId` | Component fabric requirements |

**3. Cutting Module**

| Consumer | Field | Data Used |
|----------|-------|-----------|
| Cutting Batch | `cadAverageUsed` | Planned consumption |
| Cutting Batch | `cadWidthUsed` | Planned width |
| Variance Report | calculated | Actual vs. planned efficiency |

**4. Procurement Module**

| Consumer | Data Used |
|----------|-----------|
| Fabric requirements | `cadMeters × orderQuantity` |
| Shortfall calculation | Available stock vs. required |

**5. BOM (Bill of Materials)**

| Consumer | Data Used |
|----------|-----------|
| Component breakdown | `cadMeters`, `cutableWidth` per component |

#### Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UPSTREAM (Data Sources)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Style Module │    │ Greige Master│    │  Embroidery  │                  │
│  │              │    │              │    │    Master    │                  │
│  │ • Fabrics    │    │ • Width      │    │ • Design ID  │                  │
│  │ • Components │    │ • Cost/meter │    │ • Cost/meter │                  │
│  │ • Variants   │    │ • Composition│    │              │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                          │
│         └───────────────────┼───────────────────┘                          │
│                             ▼                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAD PLANNING MODULE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Group fabrics by: genericGreigeName + fabricFinishType + embroidery    │
│                                                                             │
│  2. Select Greige → Creates fabric_master → Generates CAD width options    │
│                                                                             │
│  3. Enter CAD values:                                                      │
│     • cadMeters (consumption per garment)                                  │
│     • cadWastagePercent (typically 5%)                                     │
│     • layerMarginMeters                                                    │
│     • piecesPerMarker                                                      │
│     • Size breakdown (S:2, M:4, L:3, XL:1)                                 │
│                                                                             │
│  4. Calculate effective consumption = cadMeters × (1 + wastage%)           │
│                                                                             │
│  5. Approve CAD → Links style_fabrics to fabric_width_cad                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     fabric_width_cad (Central Table)                │   │
│  │  • cadMeters, cadYards, cadWastagePercent                          │   │
│  │  • cutableWidth, layerMarginMeters                                 │   │
│  │  • piecesPerMarker, markerEfficiency                               │   │
│  │  • isPreferred, componentName, notes                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOWNSTREAM (Data Consumers)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Costing    │    │ Work Orders  │    │   Cutting    │                  │
│  │              │    │              │    │              │                  │
│  │ selectedCadId│    │ fabricCADId  │    │cadAverageUsed│                  │
│  │ cadMeters    │    │ component    │    │ cadWidthUsed │                  │
│  │ fabricRate   │    │ requirements │    │ variance     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Procurement  │    │ Order Items  │    │     BOM      │                  │
│  │              │    │              │    │              │                  │
│  │ fabric qty   │    │ selectedCadId│    │ cadMeters    │                  │
│  │ calculations │    │ order-level  │    │ component    │                  │
│  │              │    │ override     │    │ breakdown    │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Common Issues

#### Issue: CAD row shows "Product" purpose instead of PRODUCTION

**Cause**: Legacy data from before CAD Purposes implementation

**Solution**:
1. Click row to edit
2. Change Purpose dropdown to "PRODUCTION"
3. Save row

#### Issue: "Link to Stock" button not visible

**Possible Causes**:
- CAD row is not PRODUCTION purpose
- CAD row is already APPROVED
- CAD row is LOCKED
- Frontend not rebuilt after code changes

**Solution**:
1. Verify purpose = PRODUCTION
2. Verify status = PENDING
3. Hard refresh browser (Ctrl+Shift+R)
4. Check browser console for errors

#### Issue: Stock modal shows "No stock available"

**Cause**: No fabric stock entries for this style

**Solution**:
1. Navigate to Fabric Stock Entry page
2. Create stock entry with:
   - `originStyleId` = current style ID
   - Status: AVAILABLE
   - Finished width and cutable width values
3. Return to CAD Planning
4. Click "Link to Stock" again

#### Issue: Variance warning appears for small difference

**Cause**: Threshold set to 5% OR 2 inches (absolute)

**Solution**: This is expected behavior. Small percentage on large width can exceed 2 inches.

Example: 44″ → 42″ = 4.5% (OK) but 2″ absolute (triggers warning)

#### Issue: CAD locked and cannot edit

**Cause**: CAD used in work orders, cutting batches, or BOMs

**Solution**:
1. This is by design for data integrity
2. Create new CAD row if changes needed
3. Contact admin to unlock (only if no dependencies)

#### Issue: Approval button missing

**Possible Causes**:
- User lacks Admin/Merchandiser role
- CAD already APPROVED
- CAD already REJECTED (must edit first)

**Solution**:
1. Check user role
2. Verify CAD status = PENDING
3. If rejected, edit and save to reset to PENDING

#### Issue: Size breakdown not saving

**Cause**: Component has no size variants

**Solution**:
1. Navigate to Style Variants page
2. Add size variants for the style
3. Return to CAD Planning
4. Size breakdown popup will now show sizes

#### Issue: CAD average not calculating

**Possible Causes**:
- Size breakdown empty (piecesPerMarker = 0)
- Layer length not entered
- Division by zero

**Solution**:
1. Click size breakdown button
2. Enter quantities for sizes
3. Enter layer length
4. CAD will auto-calculate

#### Issue: Page doesn't refresh after approve/reject

**Cause**: Simple implementation uses `window.location.reload()`

**Solution**:
1. Wait for page to reload
2. If stuck, manually refresh browser

#### Issue: Cannot find greige in dropdown

**Possible Causes**:
- No greige entries in master
- Generic fabric name mismatch
- Greige inactive

**Solution**:
1. Check Greige Master has entries
2. Verify `genericGreigeName` matches
3. Verify greige `isActive = true`

---

## Related Documentation

- **Fabric Stock Management**: [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md)
- **Procurement Workflow**: [ORDER_PROCUREMENT_GUIDE.md](ORDER_PROCUREMENT_GUIDE.md)
- **Costing Module**: [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md)
- **Work Orders**: [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md)
- **Project Overview**: [PROJECT_BIBLE.md](PROJECT_BIBLE.md)

---

## Appendix: Type Definitions

### Frontend Types

```typescript
// CAD Purposes
export enum CADPurpose {
  PRODUCTION = 'PRODUCTION',
  PLANNING = 'PLANNING',
  COSTING = 'COSTING',
}

// Approval Status
export enum CADApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Print Direction
export enum PrintDirection {
  ONE_WAY = 'ONE_WAY',
  TWO_WAY = 'TWO_WAY',
}

// Size Breakdown
export interface CADSizeBreakdown {
  sizeName: string;
  sizeId: string | null;
  quantity: number;
}

// CAD Spreadsheet Row
export interface CADSpreadsheetRow {
  id: string;
  purpose: CADPurpose | null;
  componentId: string;
  componentName: string;
  styleFabricId: string;
  partName: string | null;
  partId: string | null;
  fabricFinishType: string | null;
  isEmbroidery: boolean;
  genericGreigeName: string | null;
  greigeId: string | null;
  greigeName: string | null;
  cutableWidth: number | null;
  availableWidths: number[];
  printDirection: PrintDirection;
  sizeBreakdowns: CADSizeBreakdown[];
  piecesPerMarker: number | null;
  layerMarginMeters: number | null;
  layerLengthMeters: number | null;
  cadAverage: number | null;
}

// Extended Row (with CAD Purposes fields)
export interface CADSpreadsheetRowExtended extends CADSpreadsheetRow {
  approvalStatus?: CADApprovalStatus | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
  isLocked: boolean;
  lockedReason?: string | null;
  lockedAt?: string | null;
  version: number;
  supersededById?: string | null;
  fabricStockId?: string | null;
  fabricStockDetails?: {
    finishedWidth: number;
    cutableWidth: number;
    rollNumbers?: string | null;
    qualityGrade: string;
  } | null;
  procurementId?: string | null;
  planningCadWidth?: number | null;
  widthVariance?: number | null;
  variancePercent?: number | null;
  styleCostingId?: string | null;
  autoApprovedFrom?: string | null;
}

// Full CAD Table Data
export interface CADTableData {
  style: CADStyleSummary;
  components: CADComponentOption[];
  availableGreiges: CADGreigeOption[];
  sizeOptions: CADSizeOption[];
  cadRows: CADSpreadsheetRow[];
}
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-29 | 1.0 | Initial group-based workflow |
| 2024-12-30 | 2.0 | Migrated to spreadsheet workflow |
| 2025-01-01 | 3.0 | Added CAD Purposes + Stock Integration |
| 2026-01-05 | 3.1 | Added PRODUCTION Stock Requirement - stock selection mandatory for PRODUCTION CAD rows |
| 2026-01-05 | 3.2 | Full Module Separation - CAD Planning as independent module with own routes |
| 2026-01-05 | 3.3 | Add Width Variant After Approval - allows adding new CAD widths after style approval, approved rows locked |

---

## Full Module Separation (v3.2)

*(Added 2026-01-05)*

### Overview

CAD Planning has been separated from the Styles module into a fully independent module with:
- ✅ Own list page at `/cad-planning`
- ✅ Own API routes at `/api/cad-planning/...`
- ✅ Own service file
- ✅ Clean separation from Styles module

### Problem Solved

**Before:** CAD Planning was a "sub-feature" of Styles:
- Sidebar linked to `/styles?cadStatus=PENDING` (StyleList with filter)
- Routes were under `/api/styles/cad-planning/...`
- Components were mixed in styles folder
- Caused UI confusion (style buttons showing in CAD context)

**After:** CAD Planning is a standalone module:
- Clean navigation: `/cad-planning`
- Dedicated list page: `CADPlanningList.tsx`
- Independent API: `/api/cad-planning/...`
- No style management UI elements

### Backend Changes

#### New Controller: `backend/src/controllers/cad-planning.controller.ts`

**Key Functions:**
- Re-exports all CAD functions from `style-cad-planning.controller.ts` for backward compatibility
- `getCADStatusCounts()` - Returns counts for PENDING/IN_PROGRESS/APPROVED tabs
- `getStylesForCADPlanning()` - Paginated styles with fabric summary for list view

**Prisma Query Structure:**
```typescript
prisma.styles.findMany({
  where,
  select: {
    id: true,
    styleCode: true,
    styleName: true,
    cadStatus: true,
    customerName: true,  // Direct field (no buyer relation)
    brand_categories: {
      select: {
        id: true,
        brandName: true,    // Direct field
        category: true,     // Direct field (string)
        customer: { select: { id: true, name: true } }
      }
    },
    style_components: {
      select: {
        id: true,
        componentName: true,
        componentType: true,
        style_fabrics: {
          select: {
            id: true,
            fabric: { select: { id: true, fabricName: true, genericGreigeName: true } }
          }
        }
      }
    }
  }
})
```

#### New Routes: `backend/src/routes/cad-planning.routes.ts`

**Endpoints at `/api/cad-planning/`:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/styles` | Get styles for CAD planning list |
| GET | `/status-counts` | Get PENDING/IN_PROGRESS/APPROVED counts |
| GET | `/:styleId` | Get enhanced CAD planning data |
| GET | `/:styleId/summary` | Get CAD summary |
| GET | `/:styleId/history` | Get CAD history |
| GET | `/:styleId/table` | Get CAD table data |
| GET | `/:styleId/order-history` | Get order history |
| POST | `/:styleId/row` | Add CAD row |
| POST | `/:styleId/combined-row` | Add combined CAD row |
| PUT | `/:styleId/row/:rowId` | Update CAD row |
| DELETE | `/:styleId/row/:rowId` | Delete CAD row |
| POST | `/:styleId/row/:rowId/approve` | Approve CAD |
| POST | `/:styleId/row/:rowId/reject` | Reject CAD |
| POST | `/:styleId/production-from-stock` | Create production CAD from stock |
| GET | `/greige-options` | Get greige options |
| GET | `/greige/:greigeId/widths` | Get greige widths |

#### Route Registration: `backend/src/index.ts`

```typescript
import cadPlanningRoutes from './routes/cad-planning.routes';
app.use('/api/cad-planning', cadPlanningRoutes);
```

### Frontend Changes

#### New List Page: `frontend/src/pages/CADPlanningList.tsx`

**Features:**
- Status tabs with counts: PENDING | IN_PROGRESS | APPROVED
- Table columns: Style Code, Style Name, Buyer, Brand, Category, Fabrics, Status, Actions
- Search by style code, name, buyer, brand
- Pagination
- Click row → Navigate to `/cad-planning/:id`
- Clean UI with no style management buttons

#### New Service: `frontend/src/services/cad-planning.service.ts`

**API Calls:**
```typescript
export const cadPlanningService = {
  getStylesForCADPlanning(params),  // List with filters
  getCADStatusCounts(),             // Tab counts
  // All other CAD operations...
};
```

#### Updated Routes: `frontend/src/App.tsx`

```tsx
{/* CAD Planning Module (Independent) */}
<Route path="/cad-planning" element={<CADPlanningList />} />
<Route path="/cad-planning/:id" element={<CADPlanningPage />} />
{/* Backward compatibility: old route still works */}
<Route path="/styles/:id/cad-planning" element={<CADPlanningPage />} />
```

#### Updated Sidebar: `frontend/src/components/Sidebar.tsx`

```tsx
// Changed from: '/styles?cadStatus=PENDING'
// Changed to:   '/cad-planning'
{ title: 'CAD Planning', path: '/cad-planning', icon: <Ruler />, permission: 'cadPlanning' }
```

#### Updated CADPlanningPage: `frontend/src/pages/CADPlanningPage.tsx`

- Back button navigates to `/cad-planning` (not `/styles`)
- After approval navigates to `/cad-planning`
- "Style not found" button navigates to `/cad-planning`

#### Cleaned StyleList: `frontend/src/pages/StyleList.tsx`

**Removed:**
- `isCADPlanningMode` state and logic
- `cadStatusTab`, `cadPendingCount`, `cadInProgressCount`, `cadApprovedCount` states
- `fetchCADStatusCounts()` function
- CAD Planning mode tabs UI
- `effectiveCadStatus` variable
- Conditional navigation based on CAD mode
- Unused imports: `Clock`, `AlertCircle`, `CheckCircle2`

**Now:** StyleList is purely for Style management with no CAD-related code.

### Files Changed Summary

#### Created

| File | Purpose |
|------|---------|
| `frontend/src/pages/CADPlanningList.tsx` | New dedicated list page |
| `frontend/src/services/cad-planning.service.ts` | CAD-specific API service |
| `backend/src/routes/cad-planning.routes.ts` | New API routes |
| `backend/src/controllers/cad-planning.controller.ts` | CAD controller with new endpoints |

#### Modified

| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | Added `/cad-planning` routes, imports |
| `frontend/src/routes/lazy-routes.tsx` | Added CADPlanningList export |
| `frontend/src/components/Sidebar.tsx` | Updated path to `/cad-planning` |
| `frontend/src/pages/CADPlanningPage.tsx` | Updated navigation to `/cad-planning` |
| `frontend/src/pages/StyleList.tsx` | Removed all CAD mode logic |
| `backend/src/index.ts` | Registered `/api/cad-planning` routes |

#### Kept for Backward Compatibility

| File | Status |
|------|--------|
| `backend/src/routes/style-cad-planning.routes.ts` | Still active (old routes work) |
| `backend/src/controllers/style-cad-planning.controller.ts` | Functions re-exported in new controller |

### Benefits Achieved

| Aspect | Before | After |
|--------|--------|-------|
| Navigation | `/styles?cadStatus=PENDING` (confusing) | `/cad-planning` (clear) |
| UI | Style buttons showing in CAD context | Clean CAD-only interface |
| Code | Mixed concerns in StyleList | Single responsibility |
| Maintenance | CAD logic scattered | Centralized in CAD module |
| User Experience | "Why am I on Styles page?" | "This is CAD Planning" |
| TypeScript | N/A | Both frontend & backend compile clean |

### Module Separation Testing Checklist

- [x] TypeScript compilation passes (frontend & backend)
- [ ] CAD Planning list at `/cad-planning` loads correctly
- [ ] Status tabs show correct counts
- [ ] Search/filter works
- [ ] Click row navigates to detail page
- [ ] CAD Planning detail at `/cad-planning/:id` works
- [ ] Back button returns to list
- [ ] Approval workflow still works
- [ ] Styles page no longer has CAD tabs/buttons
- [ ] Backward compatibility: `/styles/:id/cad-planning` still works

---

## Add Width Variant After Approval (v3.3)

*(Added 2026-01-05)*

### Overview

This feature allows users to add new CAD width variants even after a style has been approved. This addresses the common scenario where new fabric batches arrive with different widths than originally planned.

### Problem Solved

**Before v3.3:**
- Once a style's CAD was approved (`cadStatus = 'APPROVED'`), the frontend disabled ALL CAD controls
- Users could not add new CAD rows for different widths from new fabric batches
- The workaround required creating PRODUCTION CAD from stock via StockSummaryBanner, but COSTING/PLANNING rows couldn't be added
- This caused issues when:
  - New orders came with different fabric batches
  - Different widths needed COSTING analysis
  - Planning adjustments were required for new stock

**After v3.3:**
- Users can add new CAD rows anytime, even after style approval
- Approved rows are locked (cannot be edited/deleted)
- New rows start as PENDING with independent approval workflow
- Full flexibility to handle multiple fabric batches per style

### Use Case: Multi-Order with Different Widths

```
Scenario:
- Style "ABC" approved at 44" width (Order 1)
- Order 2 placed 3 months later
- New fabric batch arrives at 42" width
- Need to create CAD at 42" for Order 2

Before v3.3: ❌ Blocked - "Style already approved"
After v3.3:  ✅ Allowed - Add new row, approved rows preserved
```

### Implementation Details

#### Frontend Changes

##### 1. CADPlanningPage.tsx (Line 495)

**Before:**
```tsx
<CADSpreadsheetTable
  ...
  disabled={isApproved}
/>
```

**After:**
```tsx
<CADSpreadsheetTable
  ...
  disabled={false}
  isStyleApproved={isApproved}
/>
```

**Effect:** Spreadsheet is no longer globally disabled when style is approved.

##### 2. CADSpreadsheetTable.tsx - New Props

**Interface Addition:**
```typescript
export interface CADSpreadsheetTableProps {
  // ... existing props
  /** When true, style is approved but users can still add new width variants */
  isStyleApproved?: boolean;
}
```

**Component Parameter:**
```typescript
export function CADSpreadsheetTable({
  // ... existing params
  isStyleApproved = false,
}: CADSpreadsheetTableProps) {
```

##### 3. Per-Row Locking Logic

**New Variable:**
```typescript
// Lock rows that are APPROVED when style is approved (prevents editing historical data)
const isRowLocked = isStyleApproved && row.approvalStatus === 'APPROVED';
```

**Visual Styling for Locked Rows:**
```tsx
<TableRow
  key={row.id}
  className={cn(
    'hover:bg-muted/30',
    isEditing && 'bg-primary/5',
    isRowLocked && 'opacity-75 bg-gray-50'
  )}
  onClick={() => !isEditing && !isRowLocked && setEditingRow(row.id)}
  title={isRowLocked ? 'This row is locked (approved CAD)' : undefined}
>
```

##### 4. Lock Icon Indicator

```tsx
{isRowLocked && (
  <Lock className="h-3 w-3 text-amber-500" title="Locked - approved CAD cannot be modified" />
)}
```

##### 5. Edit/Delete Button Disabling

```tsx
// Edit button
<Button
  variant="ghost"
  size="sm"
  disabled={disabled || isRowLocked || row.isLocked}
  ...
>

// Delete button
<Button
  variant="ghost"
  size="sm"
  disabled={disabled || isRowLocked || row.isLocked}
  ...
>
```

##### 6. Info Banner in Add Row Dialog

```tsx
{isStyleApproved && (
  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-2">
    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
    <div className="text-sm text-blue-800">
      <strong>Adding width variant to approved style.</strong>
      <p className="mt-1 text-blue-600">
        New CAD rows will be created with PENDING status. Existing approved rows are preserved.
      </p>
    </div>
  </div>
)}
```

### UI Flow After v3.3

```
┌─────────────────────────────────────────────────────────────────┐
│               CAD PLANNING - APPROVED STYLE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Status: APPROVED                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [+ Add Row]  ← ENABLED (can still add new rows)           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Row 1: 44" PRODUCTION  │ ✅ APPROVED │ 🔒 │ [Edit] [Del]  │  │
│  │        Edit/Delete DISABLED - historical data protected   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Row 2: 42" PLANNING    │ ⏳ PENDING  │    │ [Edit] [Del]  │  │
│  │        Edit/Delete ENABLED - new row can be modified      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Row 3: 42" PRODUCTION  │ ⏳ PENDING  │    │ [Edit] [Del]  │  │
│  │        Edit/Delete ENABLED - new row can be modified      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Files Changed

| File | Changes |
|------|---------|
| `frontend/src/pages/CADPlanningPage.tsx` | Changed `disabled={isApproved}` to `disabled={false}`, added `isStyleApproved={isApproved}` |
| `frontend/src/components/cad/CADSpreadsheetTable.tsx` | Added `isStyleApproved` prop, `isRowLocked` logic, visual styling, info banner, lock icon |

### Behavior Matrix

| Scenario | Add Row | Edit APPROVED Row | Delete APPROVED Row | Edit PENDING Row | Delete PENDING Row |
|----------|---------|-------------------|---------------------|------------------|-------------------|
| Style PENDING | ✅ | ✅ | ✅ | ✅ | ✅ |
| Style IN_PROGRESS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Style APPROVED (before v3.3) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Style APPROVED (v3.3+) | ✅ | ❌ | ❌ | ✅ | ✅ |

### Important Notes

1. **Style-level status unchanged**: The style's `cadStatus` remains APPROVED. Only row-level controls are affected.

2. **Backward compatible**: Existing approved CAD rows are protected. No historical data is at risk.

3. **Independent row approval**: New rows follow the standard approval workflow (PENDING → APPROVED).

4. **Stock integration unaffected**: StockSummaryBanner's "+CAD" button continues to work as before.

5. **Order-CAD selection works**: Orders can select from any APPROVED CAD row, including new ones.

### Testing Checklist

- [ ] Style APPROVED shows "Add Row" button enabled
- [ ] Clicking Add Row shows info banner about width variant
- [ ] New rows created with PENDING status
- [ ] APPROVED rows show lock icon
- [ ] APPROVED rows have grayed-out styling
- [ ] APPROVED rows cannot be clicked to edit
- [ ] APPROVED rows have Edit/Delete buttons disabled
- [ ] PENDING rows in approved styles can be edited
- [ ] PENDING rows in approved styles can be deleted
- [ ] New rows can go through full approval workflow
- [ ] Orders can select newly approved CAD rows

### Troubleshooting

#### Issue: "Add Row" button still disabled

**Cause**: Browser cache may have old component version

**Solution**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Verify frontend is rebuilt after code changes

#### Issue: Lock icon not showing on approved rows

**Cause**: `isStyleApproved` prop not passed correctly

**Solution**:
1. Check CADPlanningPage passes `isStyleApproved={isApproved}`
2. Verify style data loading includes `cadStatus`
3. Check browser console for errors

#### Issue: Can still edit approved rows

**Cause**: `isRowLocked` logic may not be correctly applied

**Solution**:
1. Verify row has `approvalStatus === 'APPROVED'`
2. Verify style has `cadStatus === 'APPROVED'`
3. Both conditions must be true for locking

---

**End of Documentation**
