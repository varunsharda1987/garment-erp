# Fabric Flow Analysis: From Greige to CAD Planning

---

## Bug Fix: Embroidery Data Loss in CAD Row Creation ✅ COMPLETED

Fixed in `style-cad-planning.controller.ts` line 3606:
```typescript
isEmbroidery: styleFabric.hasEmbroidery || false,  // Use from styleFabric, not request body
```

---

## Gap #5: PRODUCTION CAD Requires Stock (CURRENT TASK)

### User Requirement

**"Production CAD is possible only if we have fabric in stock or fabric has been GRN'd and the Width should be taken from there."**

This means:
1. **PRODUCTION purpose** CAD rows can ONLY be created if matching stock exists
2. **Width must come from actual stock** - not manually entered
3. Stock comes either from:
   - Existing fabric stock entries
   - GRN'd (Goods Receipt Note) fabric that's been received

### Current System (GAP)

Currently:
- CAD rows can be created with any purpose without checking stock
- Width (`cutableWidth`) starts at 0 and is manually set
- Stock linking happens later via `linkCADToStock` (optional)
- No validation enforces stock requirement for PRODUCTION

### Proposed Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CAD ROW CREATION BY PURPOSE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  COSTING Purpose:                                                        │
│  ├── Stock NOT required                                                  │
│  ├── Width can be estimated from greige                                  │
│  └── Used for early cost estimation                                      │
│                                                                          │
│  PLANNING Purpose:                                                       │
│  ├── Stock NOT required                                                  │
│  ├── Width can be estimated from greige                                  │
│  └── Used for marker/CAD planning before procurement                    │
│                                                                          │
│  PRODUCTION Purpose:                                                     │
│  ├── Stock IS REQUIRED ← NEW VALIDATION                                  │
│  ├── Width MUST come from stock ← NEW                                    │
│  ├── fabricStockId linked at creation ← NEW                             │
│  └── Used only when ready to cut                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 1: Backend Validation

**File:** `backend/src/controllers/style-cad-planning.controller.ts`

**In `addCADTableRow` function (~line 3514):**

```typescript
// NEW: For PRODUCTION purpose, require stock selection
if (purpose === 'PRODUCTION') {
  const { fabricStockId } = req.body;

  if (!fabricStockId) {
    return res.status(400).json({
      success: false,
      message: 'PRODUCTION CAD requires fabric stock. Please select available stock or use PLANNING purpose.',
    });
  }

  // Validate stock exists and has available quantity
  const stock = await prisma.fabric_stock.findUnique({
    where: { id: fabricStockId },
    include: { fabricMaster: true },
  });

  if (!stock || stock.quantityAvailable <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Selected stock is not available or depleted.',
    });
  }

  // Use width from stock, not from greige
  cutableWidth = Number(stock.cutableWidth);
}
```

**Update CAD creation data:**
```typescript
const newCad = await prisma.fabric_width_cad.create({
  data: {
    // ... existing fields ...
    fabricStockId: purpose === 'PRODUCTION' ? fabricStockId : undefined,
    cutableWidth: purpose === 'PRODUCTION' ? stockWidth : 0,
  },
});
```

#### Phase 2: Frontend Modal Changes

**File:** `frontend/src/components/cad/CADSpreadsheetTable.tsx`

**When purpose is PRODUCTION, show stock selector instead of greige/width:**

```tsx
// In Add CAD Row modal
{purpose === 'PRODUCTION' ? (
  <div className="space-y-3">
    <Label>Select Available Stock *</Label>
    <StockSelector
      styleId={styleId}
      styleFabricId={selectedFabric.id}
      embroideryId={selectedFabric.hasEmbroidery ? selectedFabric.embroideryId : null}
      onSelect={(stock) => {
        setSelectedStock(stock);
        // Width auto-filled from stock
      }}
    />
    {!availableStocks.length && (
      <Alert variant="warning">
        No stock available. Please use PLANNING purpose or wait for GRN.
      </Alert>
    )}
  </div>
) : (
  // Existing greige/width selection for PLANNING/COSTING
  <GreigeWidthSelector ... />
)}
```

**Add "PRODUCTION (requires stock)" indicator:**
```tsx
<SelectItem value="PRODUCTION">
  PRODUCTION (requires stock)
</SelectItem>
```

#### Phase 3: Stock Query Enhancement

**Ensure stock is filtered correctly:**
- Match by `genericFabricName` from style fabric
- Filter by `embroideryId` (null for plain, specific ID for embroidered)
- Only show `status: 'AVAILABLE'` and `quantityAvailable > 0`

```typescript
// In frontend service
const getAvailableStockForCAD = async (params: {
  styleId: string;
  genericFabricName: string;
  embroideryId?: string | null;
}) => {
  const queryParams = new URLSearchParams({
    genericFabricName: params.genericFabricName,
  });
  if (params.embroideryId !== undefined) {
    queryParams.append('embroideryId', params.embroideryId ?? 'null');
  }
  // ... fetch from API
};
```

### UI Flow for PRODUCTION

```
┌────────────────────────────────────────────────────────────────────────┐
│ Add CAD Row                                                       ✕    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ Purpose: [PRODUCTION ▼] (requires stock)                               │
│                                                                        │
│ Component-Fabric: [Blouse - Viscose Shantoon (DYED)]                  │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────┐     │
│ │ 📦 Select Available Stock                                       │     │
│ │                                                                 │     │
│ │ ┌───────────────────────────────────────────────────────────┐  │     │
│ │ │ ◉ Roll #R001-R003 | Width: 56" | Qty: 450m | Grade A      │  │     │
│ │ └───────────────────────────────────────────────────────────┘  │     │
│ │ ┌───────────────────────────────────────────────────────────┐  │     │
│ │ │ ○ Roll #R004-R005 | Width: 54" | Qty: 200m | Grade A      │  │     │
│ │ └───────────────────────────────────────────────────────────┘  │     │
│ └────────────────────────────────────────────────────────────────┘     │
│                                                                        │
│ Selected: Roll #R001-R003 @ 56" width                                  │
│                                                                        │
│                                              [Cancel]  [Add CAD Row]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Files to Modify

| File | Changes |
|------|---------|
| `backend/src/controllers/style-cad-planning.controller.ts` | Add stock validation for PRODUCTION purpose |
| `frontend/src/components/cad/CADSpreadsheetTable.tsx` | Show stock selector when PRODUCTION selected |
| `frontend/src/services/fabricStockService.ts` | Add `getAvailableStockForCAD` method |

### Behavior Summary

| Purpose | Stock Required? | Width Source | Can Add Without Stock? |
|---------|-----------------|--------------|------------------------|
| COSTING | No | Greige estimate | Yes |
| PLANNING | No | Greige estimate | Yes |
| PRODUCTION | **YES** | **Actual stock** | **No** |

### Edge Cases

1. **No stock available for PRODUCTION:**
   - Show message: "No stock available. Use PLANNING or wait for GRN."
   - Disable "Add CAD Row" button

2. **Converting PLANNING to PRODUCTION:**
   - When copying PLANNING → PRODUCTION, require stock selection
   - Use `copyCADPurpose` with stock validation

3. **Multiple stock entries with different widths:**
   - User selects which stock to use
   - Width auto-filled from selected stock
   - Different widths = different CAD rows (can't mix)

---

## Gap #3: Normalize style_components → component_masters (NEW)

### The Problem

`style_components` currently stores `componentName` and `componentType` as **strings** instead of having a foreign key to `component_masters`. This causes:

1. **No referential integrity** - Can create styles with typos like "Blouuse"
2. **No easy joins** - Can't directly access `component_pattern_parts` without string matching
3. **Data inconsistency** - "Blouse" vs "blouse" vs "BLOUSE" could all exist
4. **No cascade updates** - Renaming in master doesn't update existing styles

### Current Schema (Denormalized)

```prisma
model style_components {
  id            String @id @default(uuid())
  styleId       String
  componentName String    // ← String, no FK
  componentType String    // ← String, no FK
  sortOrder     Int       @default(0)
  // ... relations
}
```

### Proposed Schema (Normalized)

```prisma
model style_components {
  id                String  @id @default(uuid())
  styleId           String
  componentMasterId String? @map("component_master_id")  // NEW FK (nullable for migration)
  componentName     String  // KEEP for display/cache/backward compat
  componentType     String  // KEEP for display/cache/backward compat
  sortOrder         Int     @default(0)

  // Relations
  componentMaster   component_masters? @relation(fields: [componentMasterId], references: [id])
  // ... existing relations
}
```

### Implementation Plan

#### Phase 1: Schema Migration

**File**: `backend/prisma/schema.prisma`

1. Add `componentMasterId` field (nullable initially)
2. Add relation to `component_masters`
3. Add index on `componentMasterId`

**Migration SQL:**
```sql
ALTER TABLE style_components ADD COLUMN component_master_id UUID;
ALTER TABLE style_components ADD CONSTRAINT fk_component_master
  FOREIGN KEY (component_master_id) REFERENCES component_masters(id);
CREATE INDEX idx_style_components_master ON style_components(component_master_id);
```

#### Phase 2: Data Backfill

**Script**: `backend/scripts/backfill-component-master-ids.ts`

```typescript
// For each style_component, find matching component_master by name
const styleComponents = await prisma.style_components.findMany({
  where: { componentMasterId: null }
});

for (const sc of styleComponents) {
  const master = await prisma.component_masters.findFirst({
    where: { name: { equals: sc.componentName, mode: 'insensitive' } }
  });
  if (master) {
    await prisma.style_components.update({
      where: { id: sc.id },
      data: { componentMasterId: master.id }
    });
  }
}
```

#### Phase 3: Update Service Layer

**File**: `backend/src/services/style.service.ts`

1. When creating style_components, look up `component_masters` by name and set `componentMasterId`
2. Update `getListIncludes()` to include `componentMaster` relation

```typescript
style_components: {
  select: {
    id: true,
    componentName: true,
    componentType: true,
    sortOrder: true,
    componentMaster: {       // NEW - include master data
      select: {
        id: true,
        name: true,
        componentGroupId: true,
      },
    },
    style_fabrics: { ... },
  },
},
```

#### Phase 4: Update Frontend Types

**File**: `frontend/src/types/style.types.ts`

```typescript
interface StyleComponent {
  id: string;
  componentName: string;
  componentType: string;
  sortOrder: number;
  componentMaster?: {        // NEW
    id: string;
    name: string;
    componentGroupId?: string;
  };
  fabrics?: StyleFabric[];
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add componentMasterId FK to style_components |
| `backend/scripts/backfill-component-master-ids.ts` | NEW - Data migration script |
| `backend/src/services/style.service.ts` | Set componentMasterId on create, include in queries |
| `backend/src/controllers/styleComponent.controller.ts` | Look up master by name |
| `frontend/src/types/style.types.ts` | Add componentMaster to StyleComponent |

### Benefits After Implementation

1. ✅ Proper joins to `component_pattern_parts` without string matching
2. ✅ Referential integrity prevents invalid components
3. ✅ Easy to query "all styles using Blouse component"
4. ✅ Component group info available via join
5. ✅ Foundation for future enhancements (component-specific costing rules, etc.)

---

## Problem Statement (Detailed)

### Use Case: 3-Component Style with Shared Fabric Processing

We have a style with **3 components**:
1. **BLOUSE** (Component 1)
2. **SHRUG** (Component 2)
3. **PALLAZO** (Component 3)

**Fabric Requirements:**
- **Blouse** and **Pallazo** both use the **same greige** (Viscose Shantoon)
- This greige will be **dyed** (processed) to create finished fabric
- The **dyed fabric** will be used in:
  - **Blouse**: For plain (non-embroidered) parts
  - **Blouse**: For embroidered parts (embroidery done ON the dyed fabric)
  - **Pallazo**: For all parts (plain dyed only)
- **Shrug** uses a **different greige** (Georgette) which is also dyed

### The Core Question

How should we define and track fabric across these modules:
1. **Greige Master** - Raw unprocessed fabric
2. **Fabric Master** - Processed/finished fabric
3. **Fabric Stock** - Inventory of finished fabric
4. **Style Master** - Fabric assignments to style components
5. **CAD Planning** - Consumption calculation per CAD group

---

## Why Fabric Master Has NO Embroidery Field (By Design)

### The Architecture Decision

Looking at your screenshot of the Fabric Master form, you correctly noticed there's **no embroidery field**. This is **intentional** because:

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

### The Correct Flow

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

### What This Means for Your Use Case

| Module | Embroidery Field? | Purpose |
|--------|-------------------|---------|
| Fabric Master | ❌ NO | Defines base fabric properties |
| Fabric Stock | ✅ YES (`embroideryId`) | Tracks whether stock is embroidered |
| Style Fabrics | ✅ YES (`hasEmbroidery`, `embroideryId`) | Defines component needs |
| CAD Planning | ✅ YES (`isEmbroidery`) | Groups by embroidery for consumption |

---

## Current System Architecture

### Module Relationships

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
│  │ genericFabricName:         │      │ genericFabricName:         │          │
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
```

---

## Style Master: How to Define Fabric per Component

### Current Structure (style_fabrics table)

Each **component** can have **multiple fabric entries**:

```
STYLE: A73d27fa...
├── BLOUSE (Component 1)
│   ├── Fabric Entry 1:
│   │   ├── genericFabricName: "Viscose Shantoon"
│   │   ├── fabricFinishType: "DYED"
│   │   ├── hasEmbroidery: false
│   │   └── embroideryId: null
│   │
│   └── Fabric Entry 2:
│       ├── genericFabricName: "Viscose Shantoon"
│       ├── fabricFinishType: "DYED"
│       ├── hasEmbroidery: true
│       └── embroideryId: "EMB-001" (or null if design not yet selected)
│
├── SHRUG (Component 2)
│   └── Fabric Entry 1:
│       ├── genericFabricName: "Georgette"
│       ├── fabricFinishType: "DYED"
│       ├── hasEmbroidery: false
│       └── embroideryId: null
│
└── PALLAZO (Component 3)
    └── Fabric Entry 1:
        ├── genericFabricName: "Viscose Shantoon"
        ├── fabricFinishType: "DYED"
        ├── hasEmbroidery: false
        └── embroideryId: null
```

### CAD Groups (Automatically Generated)

Based on the above, CAD groups will be:

| # | Group Key | Components | CAD Use |
|---|-----------|------------|---------|
| 1 | `Viscose Shantoon-DYED-NO_EMB` | Blouse, Pallazo | Plain dyed fabric consumption |
| 2 | `Viscose Shantoon-DYED-EMB-{id}` | Blouse | Embroidered fabric consumption |
| 3 | `Georgette-DYED-NO_EMB` | Shrug | Plain dyed fabric consumption |

---

## Step-by-Step: How to Enter This Style

### Step 1: Ensure Greige Master Exists

**Navigate to**: Greige Master → Add New

| Field | Viscose Shantoon | Georgette |
|-------|------------------|-----------|
| Greige Code | GRG-VS-001 | GRG-GEO-001 |
| Greige Name | Viscose Shantoon 40×40 | Georgette 75×75 |
| Generic Fabric Name | Viscose Shantoon | Georgette |
| Greige Width | 60" | 54" |
| Expected Finished Width Min | 56" | 50" |
| Expected Finished Width Max | 58" | 52" |

### Step 2: Ensure Embroidery Master Exists

**Navigate to**: Embroidery Master → Add New

| Field | Value |
|-------|-------|
| Embroidery Code | EMB-001 |
| Design Name | Floral Pattern A |
| Cost Per Meter | ₹50 |
| Width Reduction | 2" (optional info) |

### Step 3: Create Style with Components

**Navigate to**: Styles → Add New → Tab 1 (Basic Info)

1. Enter style code, name, customer, brand, category
2. Select product category (e.g., "Ladies Ethnic Set")
3. System auto-suggests 3 components: Blouse, Shrug, Pallazo

### Step 4: Add Fabrics to Components (Tab 2: Fabrics)

**For BLOUSE (Component 1)** - Add TWO fabric entries:

**Fabric Entry 1 (Plain Dyed):**
| Field | Value |
|-------|-------|
| Generic Fabric Name | Viscose Shantoon |
| Fabric Finish Type | Solid Dyed |
| Has Embroidery | ❌ Unchecked |

**Fabric Entry 2 (Embroidered):**
| Field | Value |
|-------|-------|
| Generic Fabric Name | Viscose Shantoon |
| Fabric Finish Type | Solid Dyed |
| Has Embroidery | ✅ Checked |
| Embroidery Design | Select "Floral Pattern A" (or leave pending) |

**For SHRUG (Component 2)** - Add ONE fabric entry:

| Field | Value |
|-------|-------|
| Generic Fabric Name | Georgette |
| Fabric Finish Type | Solid Dyed |
| Has Embroidery | ❌ Unchecked |

**For PALLAZO (Component 3)** - Add ONE fabric entry:

| Field | Value |
|-------|-------|
| Generic Fabric Name | Viscose Shantoon |
| Fabric Finish Type | Solid Dyed |
| Has Embroidery | ❌ Unchecked |

### Step 5: Verify CAD Groups Preview

At the bottom of Tab 2, you should see:

```
CAD Groups Preview
┌─────────────────────────────────────────────────────────────────┐
│ 1  Viscose Shantoon  [DYED]                                     │
│    ✂ Blouse, Pallazo                                            │
├─────────────────────────────────────────────────────────────────┤
│ 2  Viscose Shantoon  [DYED]  ✨ Embroidered                     │
│    ✂ Blouse                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 3  Georgette  [DYED]                                            │
│    ✂ Shrug                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Step 6: Save Style

Click "Save" to create the style with all fabric assignments.

---

## After Order: Fabric Processing & Stock Entry

### Step 7: Order Greige and Process (Dye)

1. Order greige from supplier
2. Send to processor for dyeing
3. Receive finished (dyed) fabric

### Step 8: Create Fabric Master Entry (Optional)

If not already exists, create finished fabric entry:

**Navigate to**: Fabric Master → Add New

| Field | Value |
|-------|-------|
| Greige | Viscose Shantoon 40×40 |
| Fabric Code | FAB-VS-NAVY-001 |
| Fabric Name | Navy Viscose Shantoon 56" |
| Generic Fabric Name | Viscose Shantoon |
| Finish Type | DYED |
| Color Name | Navy Blue |
| Actual Width | 58" |
| Cutable Width | 56" |
| Cost Per Meter | ₹150 |

### Step 9: Enter Fabric Stock (Plain Dyed)

**Navigate to**: Fabric Stock Entry

| Field | Value |
|-------|-------|
| Fabric | FAB-VS-NAVY-001 (Navy Viscose Shantoon) |
| Quantity | 500 meters |
| Width | 58" (auto-filled from fabric master) |
| Quality Grade | A |
| Purchase Cost | ₹150/m |
| Origin Style | A73d27fa... (link to style) |
| Roll Numbers | R001, R002, R003 |
| Warehouse | Warehouse A |

### Step 10: Send Fabric for Embroidery

**Navigate to**: Embroidery Send Out

| Field | Value |
|-------|-------|
| Source Fabric Stock | Select R001 (200m from plain dyed stock) |
| Embroidery Design | EMB-001: Floral Pattern A |
| Supplier | Embroidery Vendor X |
| Quantity Sent | 200 meters |
| Agreed Rate | ₹50/m |
| For Style | A73d27fa... |

### Step 11: Receive Embroidered Fabric

When embroidery returns:

| Field | Value |
|-------|-------|
| Quantity Received | 195 meters (5m damaged) |
| Received Cutable Width | 54" (reduced due to embroidery) |
| Actual Cost | ₹10,250 (205 × ₹50) |

System auto-creates new stock entry:
- fabricId: FAB-VS-NAVY-001 (same base fabric)
- embroideryId: EMB-001
- cutableWidth: 54"
- quantityAvailable: 195m
- qualityGrade: A

---

## CAD Planning: Using Stock

### Step 12: Navigate to CAD Planning

**Navigate to**: CAD Planning → Select Style A73d27fa...

### Step 13: Create CAD Rows for Each Group

**For Group 1 (Viscose Shantoon - Plain Dyed):**

| Field | Value |
|-------|-------|
| Purpose | PRODUCTION |
| Component | Blouse, Pallazo |
| Part | Body Front, Body Back, Sleeves, etc. |
| Generic Greige | Viscose Shantoon |
| Greige | Viscose Shantoon 40×40 |
| Width | 56" (from stock) |
| Size Breakdown | S=10, M=20, L=15, XL=5 |
| Layer Length | 45m |
| CAD Average | 0.902 m/pc (auto-calculated) |

**Link to Stock:** Click 📦 → Select plain dyed stock (500m @ 56")

**For Group 2 (Viscose Shantoon - Embroidered):**

| Field | Value |
|-------|-------|
| Purpose | PRODUCTION |
| Component | Blouse |
| Part | Front Panel (embroidered area) |
| Is Embroidery | ✅ Yes |
| Generic Greige | Viscose Shantoon |
| Greige | Viscose Shantoon 40×40 |
| Width | 54" (embroidered stock has reduced width) |
| Size Breakdown | S=10, M=20, L=15, XL=5 |
| Layer Length | 20m |
| CAD Average | 0.401 m/pc (auto-calculated) |

**Link to Stock:** Click 📦 → Select embroidered stock (195m @ 54")

**For Group 3 (Georgette - Plain Dyed):**

| Field | Value |
|-------|-------|
| Purpose | PRODUCTION |
| Component | Shrug |
| Part | Full Body |
| Generic Greige | Georgette |
| Greige | Georgette 75×75 |
| Width | 50" (from stock) |
| Size Breakdown | S=10, M=20, L=15, XL=5 |
| Layer Length | 35m |
| CAD Average | 0.702 m/pc (auto-calculated) |

---

## Summary: Complete Fabric Flow

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

---

## Bug Fixes Already Applied

### Issue 1: CAD Grouping Logic Bug (FIXED ✅)

**Files Modified:**
- `frontend/src/components/CADGroupPreview.tsx` (lines 45-48)
- `backend/src/controllers/style-cad-planning.controller.ts` (lines 909-912)

**Fix:** Changed grouping key to use `hasEmbroidery` alone as primary criteria:
```typescript
const embroideryPart = fabric.hasEmbroidery
  ? (fabric.embroideryId ? `EMB-${fabric.embroideryId.substring(0, 8)}` : 'EMB-PENDING')
  : 'NO_EMB';
```

---

## What's Already Working

| Feature | Status | Notes |
|---------|--------|-------|
| Greige Master | ✅ | Full CRUD with generic fabric name |
| Fabric Master | ✅ | Links to greige, stores processing details |
| Fabric Stock | ✅ | Supports embroideryId field |
| Embroidery Send Out | ✅ | Creates embroidered stock |
| Style Fabrics | ✅ | Multiple fabrics per component |
| CAD Groups Preview | ✅ | Fixed grouping logic |
| CAD Planning | ✅ | Full spreadsheet workflow |
| Stock Integration | ✅ | Link CAD to actual stock |

---

## Identified Gap #1: Style-Linked Fabric Master Missing Embroidery

### The Problem

When creating a **Style-Linked Fabric Master** (as shown in your screenshot), the form allows:
- Style selection ✅
- Component selection ✅
- Pattern Parts selection ✅
- Generic Fabric Name ✅
- Finish Type ✅

But **NO embroidery selection** - which is needed because:
1. Component may require embroidered fabric (e.g., Blouse with embroidered front panel)
2. Pattern parts have `goesToEmbroidery` flag that's currently hardcoded to `false`
3. Style-linked fabric should know if it's for embroidered use

### Current Allocation Code (BROKEN)

```typescript
// fabric.controller.ts line 1380, 1389
await prisma.style_fabrics.create({
  data: {
    componentId,
    fabricId: id,
    stylePatternParts: patternPartIds.length > 0 ? {
      create: patternPartIds.map(partId => ({
        patternPartId: partId,
        quantity: 1,
        goesToEmbroidery: false,  // ← HARDCODED to false!
      })),
    } : undefined,
  },
});
```

### Expected Form Flow (After Fix)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Source: [Style-Linked ▼]                                              │
├──────────────────────────────────────────────────────────────────────┤
│ Style: [COS009 - COS009 ▼]                                           │
├──────────────────────────────────────────────────────────────────────┤
│ Component: [Blouse ▼]                                                │
├──────────────────────────────────────────────────────────────────────┤
│ ╔════════════════════════════════════════════════════════════════╗  │
│ ║ 🧵 Embroidery (Component requires embroidery)                   ║  │
│ ║ ┌──────────────────────────────────────────────────────────┐   ║  │
│ ║ │ Has Embroidery: ☑                                        │   ║  │
│ ║ │ Embroidery Design: [EMB-001 - Floral Pattern A ▼]        │   ║  │
│ ║ └──────────────────────────────────────────────────────────┘   ║  │
│ ╚════════════════════════════════════════════════════════════════╝  │
├──────────────────────────────────────────────────────────────────────┤
│ Pattern Parts:                                                        │
│   [Body Front 🧵] [Body Back] [Sleeve] [Collar]                      │
│   (🧵 = goes to embroidery)                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Fabric Identity, Specs, etc...                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 1: Frontend Form Enhancement

**File**: `frontend/src/pages/FabricForm.tsx`

1. Add state for embroidery:
```typescript
const [hasEmbroidery, setHasEmbroidery] = useState(false);
const [selectedEmbroideryId, setSelectedEmbroideryId] = useState<string | null>(null);
const [embroideryDesigns, setEmbroideryDesigns] = useState<EmbroideryMaster[]>([]);
```

2. Check if selected component uses embroidery:
```typescript
// In handleComponentChange
const component = await getComponentDetails(componentId);
if (component?.styleFabrics?.some(f => f.hasEmbroidery)) {
  setHasEmbroidery(true);
  // Load embroidery designs for selection
  const designs = await embroideryService.getAll();
  setEmbroideryDesigns(designs);
}
```

3. Add embroidery section after Component dropdown (around line 697):
```tsx
{/* Embroidery Section */}
{selectedComponent?.hasEmbroidery && (
  <div className="border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r">
    <div className="flex items-center gap-2 mb-2">
      <Sparkles className="h-4 w-4 text-purple-600" />
      <span className="text-sm font-medium text-purple-700">
        Embroidery Required for this Component
      </span>
    </div>
    <Checkbox
      id="hasEmbroidery"
      checked={hasEmbroidery}
      onCheckedChange={(checked) => setHasEmbroidery(!!checked)}
    />
    <label htmlFor="hasEmbroidery">This fabric will be embroidered</label>

    {hasEmbroidery && (
      <Select value={selectedEmbroideryId} onValueChange={setSelectedEmbroideryId}>
        <SelectTrigger>
          <SelectValue placeholder="Select embroidery design..." />
        </SelectTrigger>
        <SelectContent>
          {embroideryDesigns.map(design => (
            <SelectItem key={design.id} value={design.id}>
              {design.embroideryCode} - {design.designName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
  </div>
)}
```

4. Update pattern parts display to show embroidery indicator:
```tsx
{part.goesToEmbroidery && (
  <span className="ml-1 text-purple-600" title="Goes to embroidery">🧵</span>
)}
```

#### Phase 2: Backend API Enhancement

**File**: `backend/src/controllers/fabric.controller.ts`

1. Update `allocateToStyle` request body:
```typescript
interface AllocateToStyleRequest {
  componentId: string;
  patternPartIds?: string[];
  hasEmbroidery?: boolean;
  embroideryId?: string;
  patternPartDetails?: Array<{
    patternPartId: string;
    goesToEmbroidery: boolean;
  }>;
}
```

2. Update allocation logic (lines 1370-1390):
```typescript
// Use patternPartDetails if provided, otherwise default pattern parts
const patternPartsToCreate = req.body.patternPartDetails
  ? req.body.patternPartDetails.map(detail => ({
      patternPartId: detail.patternPartId,
      quantity: 1,
      goesToEmbroidery: detail.goesToEmbroidery,
    }))
  : patternPartIds.map(partId => ({
      patternPartId: partId,
      quantity: 1,
      goesToEmbroidery: false,
    }));

await prisma.style_fabrics.create({
  data: {
    componentId,
    fabricId: id,
    hasEmbroidery: req.body.hasEmbroidery || false,
    embroideryId: req.body.embroideryId || null,
    stylePatternParts: {
      create: patternPartsToCreate,
    },
  },
});
```

**File**: `backend/src/controllers/style-cad-planning.controller.ts`

3. Update `getCADPatternPartsForComponent` to return goesToEmbroidery flag:
```typescript
// Around line 3946+
// Add goesToEmbroidery to pattern part response
const patternParts = cadPatternParts.map(part => ({
  id: part.id,
  code: part.patternPart.code,
  name: part.patternPart.name,
  goesToEmbroidery: part.goesToEmbroidery || false,  // ADD THIS
}));
```

#### Phase 3: Frontend Types Update

**File**: `frontend/src/types/fabric-greige.types.ts`

```typescript
export interface FabricMasterFormData {
  // ... existing fields
  hasEmbroidery?: boolean;
  embroideryId?: string;
}

export interface PatternPartForFabric {
  id: string;
  code: string;
  name: string;
  goesToEmbroidery?: boolean;  // ADD THIS
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/pages/FabricForm.tsx` | Add embroidery section, update pattern parts display |
| `frontend/src/types/fabric-greige.types.ts` | Add embroidery fields to types |
| `backend/src/controllers/fabric.controller.ts` | Accept embroidery params in allocateToStyle |
| `backend/src/controllers/style-cad-planning.controller.ts` | Return goesToEmbroidery in pattern parts |

---

## Identified Gap #2: CAD-Stock Embroidery Filtering

### The Problem

Currently, when linking CAD to stock (`getStockForStyle` endpoint):

1. **No embroideryId filter** - Returns ALL stock regardless of embroidery status
2. **No embroideryId in response** - Frontend can't distinguish plain vs embroidered stock
3. **No matching logic** - CAD row with `hasEmbroidery=true` should only show embroidered stock

### Current Flow (Broken)

```
CAD Row (Embroidered) → Click "Link to Stock"
                      → Shows ALL stock (plain + embroidered mixed)
                      → User must manually identify correct stock
                      → Wrong stock could be linked
```

### Expected Flow (After Fix)

```
CAD Row (Embroidered) → Click "Link to Stock"
                      → Shows ONLY embroidered stock matching embroideryId
                      → User sees filtered, relevant stock
                      → Correct stock is easily identified
```

---

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Update `getStockForStyle` Endpoint

**File**: `backend/src/controllers/fabric-stock.controller.ts` (lines 434-518)

**Add embroideryId filter parameter and include in response:**

```typescript
// Add to query params
const { fabricId, status, qualityGrade, embroideryId } = req.query;

// Add embroideryId filter
if (embroideryId && typeof embroideryId === 'string') {
  where.embroideryId = embroideryId;
} else if (embroideryId === 'null' || embroideryId === '') {
  // Explicitly filter for plain (non-embroidered) stock
  where.embroideryId = null;
}

// Include embroidery relation in query
include: {
  fabricMaster: { include: { greige: true } },
  procurement: true,
  embroidery: true,  // ADD THIS
},

// Add to transformed response
embroideryId: stock.embroideryId || null,
embroideryCode: stock.embroidery?.embroideryCode || null,
embroideryName: stock.embroidery?.designName || null,
```

#### 1.2 Update Types

**File**: `backend/src/types/fabric.types.ts`

Add embroidery fields to `FabricStockForCAD` interface:

```typescript
export interface FabricStockForCAD {
  // ... existing fields
  embroideryId?: string | null;
  embroideryCode?: string | null;
  embroideryName?: string | null;
}
```

### Phase 2: Frontend Changes

#### 2.1 Update Stock Selection Modal

**File**: `frontend/src/components/cad/CADSpreadsheetTable.tsx`

When opening stock selection modal:

```typescript
// Current: No embroidery filter
const fetchStock = async () => {
  const stock = await fabricStockService.getAvailableStock({ styleId });
  setAvailableStock(stock);
};

// After: Filter by embroidery
const fetchStock = async () => {
  const row = cadRows.find(r => r.id === selectedRowForStock);
  const embroideryId = row?.isEmbroidery
    ? (row.embroideryId || 'any-embroidered')  // Any embroidered stock
    : 'null';  // Plain stock only

  const stock = await fabricStockService.getAvailableStock({
    styleId,
    embroideryId
  });
  setAvailableStock(stock);
};
```

#### 2.2 Update Stock Service

**File**: `frontend/src/services/fabricStockService.ts`

Add embroideryId parameter:

```typescript
getAvailableStock: async (params: {
  styleId: string;
  fabricId?: string;
  status?: string;
  qualityGrade?: string;
  embroideryId?: string | null;  // ADD THIS
}) => {
  const searchParams = new URLSearchParams();
  // ... existing params
  if (params.embroideryId !== undefined) {
    searchParams.append('embroideryId', params.embroideryId ?? 'null');
  }
  // ...
}
```

#### 2.3 Update Stock Display

Show embroidery badge in stock selection modal:

```tsx
{stock.embroideryId && (
  <Badge className="bg-purple-100 text-purple-700">
    <Sparkles className="h-3 w-3 mr-1" />
    {stock.embroideryName || 'Embroidered'}
  </Badge>
)}
```

### Phase 3: Frontend Types Update

**File**: `frontend/src/types/fabric-greige.types.ts`

Update `FabricStockForCAD` interface:

```typescript
export interface FabricStockForCAD {
  // ... existing fields
  embroideryId?: string | null;
  embroideryCode?: string | null;
  embroideryName?: string | null;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/controllers/fabric-stock.controller.ts` | Add embroideryId filter and response field |
| `backend/src/types/fabric.types.ts` | Update FabricStockForCAD interface |
| `frontend/src/components/cad/CADSpreadsheetTable.tsx` | Filter stock by embroidery status |
| `frontend/src/services/fabricStockService.ts` | Add embroideryId parameter |
| `frontend/src/types/fabric-greige.types.ts` | Update FabricStockForCAD interface |

---

## Testing Checklist

### Backend Tests
- [ ] `GET /api/styles/:styleId/fabric-stock` returns embroideryId in response
- [ ] `GET /api/styles/:styleId/fabric-stock?embroideryId=null` returns only plain stock
- [ ] `GET /api/styles/:styleId/fabric-stock?embroideryId=EMB-001` returns only embroidered stock

### Frontend Tests
- [ ] CAD row with `isEmbroidery=false` shows only plain stock in modal
- [ ] CAD row with `isEmbroidery=true` shows only embroidered stock in modal
- [ ] Embroidery badge displays in stock selection modal
- [ ] Stock selection correctly links to CAD row

### End-to-End Test (Your Use Case)
1. Create style with Blouse (2 fabrics: plain + embroidered), Shrug, Pallazo
2. Create plain dyed stock (Viscose Shantoon)
3. Send portion for embroidery, receive embroidered stock
4. In CAD Planning:
   - Plain CAD row → Shows only plain stock
   - Embroidered CAD row → Shows only embroidered stock
5. Link each CAD to appropriate stock
6. Verify variance tracking works

---

## Summary: What Was Already Working vs What Needs Fix

| Feature | Status | Notes |
|---------|--------|-------|
| Greige Master | ✅ Working | Generic fabric name supported |
| Fabric Master | ✅ Working | Has valueAddition field (not embroideryId - by design) |
| Fabric Stock | ✅ Working | Has embroideryId field |
| Style Fabrics | ✅ Working | Multiple fabrics per component with embroidery |
| CAD Groups Preview | ✅ Fixed | Grouping by embroidery status |
| CAD Planning | ✅ Working | Full spreadsheet workflow |
| **Style-Linked Fabric Embroidery** | ✅ **GAP #1 DONE** | Embroidery section in FabricForm when Style-Linked |
| **Pattern Parts goesToEmbroidery** | ✅ **GAP #1 DONE** | Backend returns goesToEmbroidery, frontend shows indicator |
| **Stock Filtering by Embroidery** | ✅ **GAP #2 DONE** | Stock filtered by embroidery status in CAD stock modal |
| **Stock Display with Embroidery** | ✅ **GAP #2 DONE** | Embroidery badge in stock selection modal |
| **style_components → component_masters FK** | ✅ **GAP #3 DONE** | componentMasterId FK added, backfill complete |
| **Combined Cutting for CAD** | ❌ **GAP #4** | Allow combining same-fabric components in one CAD row |

---

## Implementation Priority

### Gap #1: Style-Linked Fabric Master Embroidery ✅ COMPLETED
- **Status**: Frontend embroidery section implemented, backend accepts embroidery params
- **Files Modified**: FabricForm.tsx, fabric.controller.ts, style-cad-planning.controller.ts, types
- **Bug Fixed**: getListIncludes() now returns hasEmbroidery and embroideryId in style_fabrics

### Gap #2: CAD-Stock Embroidery Filtering (MEDIUM PRIORITY)
- **Why**: Stock selection doesn't filter by embroidery status
- **Impact**: Affects production planning workflow
- **Files**: fabric-stock.controller.ts, CADSpreadsheetTable.tsx, fabricStockService.ts, types

### Gap #3: Normalize style_components → component_masters (HIGH PRIORITY)
- **Why**: No FK means string-based matching, no referential integrity, can't join to pattern_parts
- **Impact**: Data integrity, easier queries, foundation for future features
- **Files**: schema.prisma, style.service.ts, styleComponent.controller.ts, backfill script, types

### Gap #2: CAD-Stock Embroidery Filtering ✅ COMPLETED
- **Status**: Stock filtering by embroidery implemented
- **Files Modified**: fabric-stock.controller.ts, CADSpreadsheetTable.tsx, fabricStockService.ts, types
- **Feature**: Plain CAD rows show plain stock, Embroidered CAD rows show embroidered stock

### Gap #3: Normalize style_components → component_masters ✅ COMPLETED
- **Status**: componentMasterId FK added, backfill script created and run
- **Files Modified**: schema.prisma, style.service.ts, styleComponent.controller.ts, backfill script, types

---

## Gap #4: Combined Cutting for CAD Planning (NEW)

### The Problem

Currently, when adding CAD rows:
- Each component-fabric pair creates a **separate** CAD row
- User cannot combine fabrics that share the same base fabric for marker planning
- No way to plan a **combined marker** (e.g., Blouse body + Pallazo body on same cutting table)

### User Request Screenshot Analysis

From the screenshot, the "Add CAD Rows" modal shows:
```
☐ Blouse ✨ Embroidery    DYED • Viscose Shantoon
☑ Blouse                  DYED • Viscose Shantoon  ← Same base fabric
☐ Shrug                   DYED • Georgette         ← Different fabric
☑ Pallazo                 DYED • Viscose Shantoon  ← Same base fabric as Blouse

2 component-fabric pairs selected
```

**User wants:** Ability to combine "Blouse (plain)" + "Pallazo" into ONE CAD row since they use the same base fabric (Viscose Shantoon DYED).

### Why Combined Cutting Matters

1. **Marker Efficiency**: Same fabric can have multiple components laid out together
2. **Fabric Utilization**: Reduces wastage by fitting different-sized pieces together
3. **Cutting Optimization**: One cutting table setup instead of multiple
4. **Real-world Practice**: Garment factories routinely combine components on markers

### Current Flow (Broken)

```
Select: Blouse + Pallazo (both Viscose Shantoon DYED)
        ↓
Creates: 2 separate CAD rows
        ├── Row 1: Blouse - Viscose Shantoon - Width X - CAD Avg Y
        └── Row 2: Pallazo - Viscose Shantoon - Width X - CAD Avg Z

Problem: Can't plan combined marker, can't see combined consumption
```

### Expected Flow (After Fix)

```
Select: Blouse + Pallazo (both Viscose Shantoon DYED)
        ↓
Option A: Create separate rows (current behavior)
Option B: Create COMBINED row ← NEW
        ↓
Creates: 1 combined CAD row
        └── Row: Blouse + Pallazo - Viscose Shantoon - Width X - Combined CAD Avg (Y+Z)

Benefits: Single marker planning, combined consumption, better efficiency
```

### Proposed UI Changes

#### Phase 1: Add CAD Rows Modal Enhancement

```
┌────────────────────────────────────────────────────────────────────────┐
│ Add CAD Rows                                                      ✕    │
├────────────────────────────────────────────────────────────────────────┤
│ Select component-fabric pairs to add CAD entries:                      │
│                                                                        │
│ ┌─ GROUP 1: Viscose Shantoon (DYED) ──────────────────────────────┐   │
│ │  ☑ Blouse                    [🔗 Combine]                        │   │
│ │  ☑ Pallazo                   [🔗 Combine]                        │   │
│ │                                                                  │   │
│ │  ⓘ These can be combined for marker planning                     │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ ┌─ GROUP 2: Viscose Shantoon (DYED) ✨ Embroidered ───────────────┐   │
│ │  ☐ Blouse ✨ Embroidery                                          │   │
│ │                                                                  │   │
│ │  ⓘ Embroidered fabric - separate from plain                      │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ ┌─ GROUP 3: Georgette (DYED) ─────────────────────────────────────┐   │
│ │  ☐ Shrug                                                         │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────┐     │
│ │ 📦 2 items selected                                             │     │
│ │                                                                 │     │
│ │ ☑ Create as COMBINED row (recommended when same fabric)         │     │
│ │   → Single CAD row with combined consumption                    │     │
│ │                                                                 │     │
│ │ ☐ Create as SEPARATE rows                                       │     │
│ │   → Individual CAD rows per component                           │     │
│ └────────────────────────────────────────────────────────────────┘     │
│                                                                        │
│                                      [Cancel]  [Add 1 Combined Row]    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Phase 2: CAD Spreadsheet Table - Combined Row Display

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Purpose  │ Component      │ Part │ Fabric Finish │ Width │ Pcs │ CAD Avg │ ... │
├─────────────────────────────────────────────────────────────────────────────────┤
│ PLANNING │ Blouse+Pallazo │ ALL  │ DYED          │ 56"   │ 100 │ 1.45    │     │
│          │ 📎 Combined    │      │ Viscose       │       │     │         │     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ PLANNING │ Blouse ✨      │ ALL  │ DYED          │ 54"   │  50 │ 0.85    │     │
│          │ Embroidered    │      │ Viscose       │       │     │         │     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ PLANNING │ Shrug          │ ALL  │ DYED          │ 50"   │  50 │ 0.72    │     │
│          │                │      │ Georgette     │       │     │         │     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Approach A: Lightweight (Recommended for V1)

**Concept:** Store combined info as JSON in existing `fabric_width_cad` table

**Schema Change:**
```prisma
model fabric_width_cad {
  // ... existing fields ...

  // Combined cutting fields (NEW)
  isCombinedCutting    Boolean   @default(false)
  combinedFabricIds    String?   // JSON array of styleFabricIds: ["uuid1", "uuid2"]
  combinedComponents   String?   // Display string: "Blouse, Pallazo"
}
```

**Benefits:**
- Minimal schema change
- No new tables
- Backwards compatible
- Quick to implement

#### Approach B: Full Normalization (For V2)

**New Table:**
```prisma
model combined_cad_marker {
  id                String   @id @default(uuid())
  styleId           String
  groupKey          String   // "Viscose Shantoon|DYED|NO_EMB"

  // Member CAD rows
  memberCadRows     fabric_width_cad[]  @relation("CombinedMarker")

  // Combined values
  combinedWidth     Decimal
  combinedPieces    Int
  combinedCadAvg    Decimal

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Files to Modify (Approach A)

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add `isCombinedCutting`, `combinedFabricIds`, `combinedComponents` |
| `backend/src/services/style.service.ts` | Add `addCombinedCADRow()` method |
| `backend/src/controllers/style-cad-planning.controller.ts` | New endpoint for combined row creation |
| `frontend/src/components/cad/CADSpreadsheetTable.tsx` | Update modal with grouping and combine option |
| `frontend/src/types/style.types.ts` | Add `isCombinedCutting` and related fields to types |

### User Requirements (Confirmed)

1. **Size Breakdowns**: Combined total only - single set of sizes for the combined marker
2. **Combine Trigger**: Manual selection - user selects items first, then clicks "Combine" button

### Implementation Steps

1. **Schema Migration** - Add 3 new fields to `fabric_width_cad`
   ```
   isCombinedCutting: Boolean (default false)
   combinedFabricIds: String? (JSON array of styleFabricIds)
   combinedComponents: String? (display string like "Blouse, Pallazo")
   ```

2. **Backend Service** - Create `addCombinedCADRow()` that:
   - Validates all fabrics have same base fabric + finish + embroidery status
   - Creates single CAD row with `isCombinedCutting=true`
   - Stores linked fabric IDs in `combinedFabricIds`
   - Sets `combinedComponents` display string
   - Size breakdowns stored as combined total (not per-component)

3. **Frontend Modal** - Add "Combine Selected" button:
   - Shows ONLY when 2+ items selected
   - Shows ONLY when all selected items have same fabric/finish/embroidery
   - Button disabled with tooltip if selection is invalid for combining
   - Current flow unchanged - just adds button next to "Add X Rows"

4. **Frontend Table** - Display combined rows with visual indicator:
   - Component column shows "Blouse + Pallazo" with 📎 icon
   - Tooltip shows full list of combined components

### Updated Modal UI (Simplified)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Add CAD Rows                                                      ✕    │
├────────────────────────────────────────────────────────────────────────┤
│ Select component-fabric pairs to add CAD entries:      ☐ Select All    │
│                                                                        │
│  ☐ Blouse ✨ Embroidery    DYED • Viscose Shantoon                     │
│  ☑ Blouse                  DYED • Viscose Shantoon                     │
│  ☐ Shrug                   DYED • Georgette                            │
│  ☑ Pallazo                 DYED • Viscose Shantoon                     │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────┐     │
│ │ 2 component-fabric pairs selected                               │     │
│ │ ✅ Can be combined (same fabric: Viscose Shantoon DYED)        │     │
│ └────────────────────────────────────────────────────────────────┘     │
│                                                                        │
│                    [Cancel]  [Combine as 1 Row]  [Add 2 Rows]          │
└────────────────────────────────────────────────────────────────────────┘
```

**Button States:**
- "Add X Rows" - Always visible (current behavior)
- "Combine as 1 Row" - Only when:
  - 2+ items selected
  - All selected have same genericFabricName
  - All selected have same fabricFinishType
  - All selected have same embroidery status

### Validation Rules

Combined cutting is allowed when ALL selected fabrics have:
- ✅ Same `genericFabricName` (e.g., "Viscose Shantoon")
- ✅ Same `fabricFinishType` (e.g., "DYED")
- ✅ Same embroidery status (all plain OR all same embroideryId)
- ❌ NOT allowed across different base fabrics
- ❌ NOT allowed mixing plain + embroidered

### Recommended Order (Updated)
1. ~~Implement Gap #1 first~~ ✅ DONE
2. ~~Implement Gap #2~~ ✅ DONE
3. ~~Implement Gap #3~~ ✅ DONE
4. **Implement Gap #4 (Combined Cutting)** ← NEXT
