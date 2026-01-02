# CAD Planning Module - Complete Documentation

**Last Updated**: 2025-01-01
**Version**: 3.0
**Status**: ✅ Complete (Backend + Frontend + Stock Integration)

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
10. [Workflows](#workflows)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

---

## Executive Summary

The CAD (Consumption Average Data) Planning module calculates and manages fabric consumption per garment. It has evolved through three major phases:

| Phase | Date | Description | Status |
|-------|------|-------------|--------|
| **1.0** | 2024-12-29 | Group-based workflow | Deprecated |
| **2.0** | 2024-12-30 | Spreadsheet-style workflow | ✅ Active |
| **3.0** | 2025-01-01 | CAD Purposes + Stock Integration | ✅ Active |

### Key Features (v3.0)

- **Three CAD Purposes**: PRODUCTION, PLANNING, COSTING
- **Approval Workflows**: Multi-stage approval with role-based authorization
- **Version Control**: PLANNING CAD supports versioning (v1, v2, v3...)
- **Locking Mechanism**: PRODUCTION CAD locks when used in orders
- **Stock Integration**: Link PRODUCTION CAD to actual fabric stock
- **Variance Tracking**: Monitor differences between planned vs actual widths
- **Spreadsheet UI**: Inline editing with real-time calculations

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
│  1. COSTING CAD (Quotation Stage)                               │
│     → Greige master standard widths                             │
│     → Approve with costing sheet                                │
│                                                                 │
│  2. PLANNING CAD (Sample Approved)                              │
│     → Copy from COSTING or create new                           │
│     → Refine estimates based on sample                          │
│     → Versioning supported (v1, v2, v3...)                      │
│                                                                 │
│  3. PRODUCTION CAD (Fabric in Stock)                            │
│     → Copy from PLANNING                                        │
│     → Link to actual fabric stock                               │
│     → Variance tracking vs PLANNING                             │
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
// CAD Purposes
enum CADPurpose {
  PRODUCTION  // For production use
  PLANNING    // For planning/sample stage
  COSTING     // For quotation/costing
}

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
| `planningCadWidth` | Decimal | Original PLANNING width |
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

### Three CAD Purposes

#### 1. COSTING CAD (Quotation Stage)

**Purpose**: Initial fabric consumption estimate for quotations

**When Created**: During quotation/costing sheet preparation

**Key Features**:
- Uses greige master standard widths (conservative estimates)
- Can be auto-approved with costing sheet
- Linked to `style_costing` table
- Can be copied to PLANNING CAD

**Authorization**: Admin, Merchandiser

**Workflow**:
```
1. Create COSTING CAD during quotation
2. Use greige master standard widths (e.g., 44″, 58″)
3. Enter estimated consumption
4. Auto-approve via costing sheet OR manual approval
5. Link to quotation via styleCostingId
6. Copy to PLANNING CAD after sample approval
```

#### 2. PLANNING CAD (Sample/Pre-Production)

**Purpose**: Refined consumption estimates based on approved samples

**When Created**: After sample approval, before bulk production

**Key Features**:
- Supports versioning (v1, v2, v3...)
- Cannot edit approved version - must create new version
- Can be copied to PRODUCTION CAD
- Version history tracked via `supersededById`

**Authorization**: Admin, Merchandiser, Designer

**Workflow**:
```
1. Create PLANNING CAD (copy from COSTING or new)
2. Refine estimates based on approved sample
3. Enter actual pattern measurements
4. Submit for approval
5. If changes needed after approval:
   → Create new version (v1 → v2)
   → v1 marked as superseded
   → v2 becomes active
6. Copy to PRODUCTION CAD when fabric in stock
```

#### 3. PRODUCTION CAD (Bulk Production)

**Purpose**: Actual fabric consumption for production orders

**When Created**: After fabric receipt, before cutting

**Key Features**:
- Must link to fabric stock (actual widths received)
- Tracks variance from PLANNING CAD
- Locks when used in orders (prevents editing)
- FIFO stock allocation

**Authorization**: Admin, Merchandiser

**Workflow**:
```
1. Create PRODUCTION CAD (copy from PLANNING)
2. Click "Link to Stock" button
3. Select actual fabric stock from modal
4. System calculates variance vs PLANNING CAD
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

### Version Control (PLANNING CAD Only)

**Why Versioning?**

PLANNING CAD estimates often need refinement based on:
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

### Locking Mechanism (PRODUCTION CAD Only)

**Why Locking?**

Once PRODUCTION CAD is used in orders/cutting, it must remain immutable to maintain data integrity.

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

### Copy Between Purposes

**Allowed Copy Paths**:
- COSTING → PLANNING (after sample approval)
- PLANNING → PRODUCTION (after fabric in stock)

**Not Allowed**:
- PRODUCTION → anywhere (use locked data for audit)
- PLANNING → COSTING (backwards flow)

**Copy Process**:
```
1. Click "Copy" button on APPROVED CAD
2. System determines target purpose:
   - COSTING → PLANNING
   - PLANNING → PRODUCTION
3. Creates new CAD row:
   - Copies all fields
   - Changes purpose to target
   - Resets approvalStatus to PENDING
   - If target = PRODUCTION:
     → Stores planningCadWidth for variance tracking
4. User can edit new CAD
5. Submit for approval
```

---

## Stock Integration Feature

### Overview

Stock Integration links PRODUCTION CAD to actual fabric stock entries, ensuring consumption calculations use real-world fabric widths.

### When to Use

- **PRODUCTION CAD Only**: Feature only available for PRODUCTION purpose
- **After Fabric Receipt**: Fabric must be received and entered in stock
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

1. Checks if PLANNING CAD exists for same component/part
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

PLANNING CAD:  44.0″ (estimated)
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
2. If PLANNING CAD exists:
   - `planningCadWidth` = planningCAD.cutableWidth
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
- `planningCadWidth`: Original PLANNING width (inches)
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
2. Verify `genericFabricName` matches
3. Verify greige `isActive = true`

---

## Related Documentation

- **Fabric Stock Management**: [Fabric-Stock.md](./Fabric-Stock.md)
- **Procurement Workflow**: [Procurement-Workflow.md](./Procurement-Workflow.md)
- **Costing Module**: [Costing.md](./Costing.md)
- **Work Orders**: [Work-Orders.md](./Work-Orders.md)

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

---

**End of Documentation**
