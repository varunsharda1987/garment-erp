# CAD Planning Module - Data Flow Analysis

## Overview

The CAD (Consumption Average Data) Planning module is a central component in the Garment ERP system that calculates and manages fabric consumption data per garment. It acts as a bridge between style design and production costing.

---

## Module Structure

### Backend Files
| File | Purpose |
|------|---------|
| [style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts) | Main CAD workflow (2,070 lines, 17 handlers) |
| [fabric-cad.controller.ts](backend/src/controllers/fabric-cad.controller.ts) | Fabric width CAD CRUD (460 lines) |
| [style-cad-planning.routes.ts](backend/src/routes/style-cad-planning.routes.ts) | 15 API endpoints |
| [style-cad-planning.types.ts](backend/src/types/style-cad-planning.types.ts) | Type definitions |

### Frontend Files
| File | Purpose |
|------|---------|
| [CADPlanningPage.tsx](frontend/src/pages/CADPlanningPage.tsx) | Main planning workflow (1,296 lines) |
| [CADEditPage.tsx](frontend/src/pages/CADEditPage.tsx) | CAD value editing (854 lines) |
| [CADStatusBadge.tsx](frontend/src/components/CADStatusBadge.tsx) | Status indicator |
| [CADGroupPreview.tsx](frontend/src/components/CADGroupPreview.tsx) | Fabric grouping preview |

### Database Models (Prisma)
| Model | Purpose |
|-------|---------|
| `fabric_width_cad` | Central CAD repository per fabric width |
| `cad_size_breakdown` | Size-wise piece counts for averaging |
| `styles.cadStatus` | CAD approval status (PENDING/IN_PROGRESS/APPROVED) |
| `style_fabrics.fabricCADId` | Links fabrics to approved CAD |

---

## Data Flow Diagram

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
│  1. Group fabrics by: genericFabricName + fabricFinishType + embroidery    │
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

## Upstream Data Sources (INTO CAD Planning)

### 1. Style Module
| Data | Source Table | Usage |
|------|--------------|-------|
| Style fabrics | `style_fabrics` | Groups fabrics for CAD planning |
| Generic fabric name | `style_fabrics.genericFabricName` | Grouping key |
| Fabric finish type | `style_fabrics.fabricFinishType` | Grouping key (PLAIN/DYED/PRINTED) |
| Components | `style_components` | Component-level CAD (SEPARATE mode) |
| Variants/Sizes | `style_variants` | Pre-populates size breakdown rows |
| Embroidery flag | `style_fabrics.hasEmbroidery` | Creates separate CAD groups |

### 2. Greige Master
| Data | Source Table | Usage |
|------|--------------|-------|
| Greige width | `greige_master.greigeWidth` | Calculates cutable widths (-2", -4", -6") |
| Cost per meter | `greige_master.costPerMeter` | Fabric rate calculations |
| Composition | `greige_master.composition` | Display in selection |
| Default cutable width | `greige_master.defaultCutableWidth` | Initial suggestion |

### 3. Embroidery Master
| Data | Source Table | Usage |
|------|--------------|-------|
| Embroidery design | `embroidery` | Separate CAD groups for embroidered fabrics |
| Cost per meter | `embroidery.costPerMeter` | Additional costing |

### 4. Fabric Master
| Data | Source Table | Usage |
|------|--------------|-------|
| Fabric specs | `fabric_master` | CAD container, links greige to style |
| Actual width | `fabric_master.actualWidth` | Width tracking |

---

## Downstream Data Consumers (FROM CAD Planning)

### 1. Costing Module
| Consumer | FK Column | Data Used |
|----------|-----------|-----------|
| `order_items` | `selectedCadId` | Order-specific CAD selection |
| `order_item_costing` | `selectedCadId` | Fabric cost = cadMeters × fabricRate |
| `style_costing_fabric_items` | `fabricCADId` | Style-level costing |
| `cost_sheet_items` | `selectedCadId` | Cost sheet generation |

### 2. Work Orders Module
| Consumer | FK Column | Data Used |
|----------|-----------|-----------|
| `work_order_components` | `fabricCADId` | Component fabric requirements |

### 3. Cutting Module
| Consumer | Field | Data Used |
|----------|-------|-----------|
| Cutting Batch | `cadAverageUsed` | Planned consumption |
| Cutting Batch | `cadWidthUsed` | Planned width |
| Variance Report | calculated | Actual vs. planned efficiency |

### 4. Procurement Module
| Consumer | Data Used |
|----------|-----------|
| Fabric requirements | `cadMeters × orderQuantity` |
| Shortfall calculation | Available stock vs. required |

### 5. BOM (Bill of Materials)
| Consumer | Data Used |
|----------|-----------|
| Component breakdown | `cadMeters`, `cutableWidth` per component |

---

## API Endpoints

### CAD Planning Workflow
```
GET  /api/styles/cad-planning/pending          # List pending styles
GET  /api/styles/:id/cad-planning              # Get CAD planning data
GET  /api/styles/:id/cad-planning/history      # CAD history
POST /api/styles/:id/cad-planning/select-greige # Select greige
POST /api/styles/:id/cad-planning/add-width    # Add custom width
PUT  /api/styles/cad-planning/cad/:cadId       # Update CAD values
PUT  /api/styles/cad-planning/cad/:cadId/set-preferred # Mark preferred
DELETE /api/styles/cad-planning/cad/:cadId     # Delete width option
POST /api/styles/cad-planning/approve          # Approve CAD plan
```

### Fabric CAD CRUD
```
GET  /api/cad/fabrics/:fabricId    # Get CADs for fabric
POST /api/cad                      # Create CAD entry
PUT  /api/cad/:id                  # Update CAD entry
DELETE /api/cad/:id                # Delete CAD entry
```

---

## CAD Status Workflow

```
PENDING → IN_PROGRESS → APPROVED
   │           │            │
   │           │            └── style_fabrics.fabricCADId linked
   │           │                styles.approvedCadDate set
   │           │
   │           └── Greige selected, CAD options generated
   │
   └── Initial state when style created
```

---

## Key Features

1. **Multi-width support** - Multiple cutable widths per fabric for cost comparison
2. **Component-level CAD** - SEPARATE mode for different components (body, sleeves)
3. **COMBINED mode** - Single CAD for all components using same fabric
4. **Embroidery awareness** - Separate CAD groups for embroidered fabrics
5. **Size-based averaging** - CAD weighted by size distribution (S:2, M:4, L:3, XL:1)
6. **Preferred width marking** - Auto-selection for downstream modules
7. **Order-level override** - Each order can select different CAD than style default

---

---

## User Requirements (Clarified)

### Problem Statement

The current CAD system needs enhancement for:

1. **Embroidery parts cut separately** - Parts going to embroidery need separate CAD calculation
2. **Print direction tracking** - Need to capture One-Way vs Two-Way print direction (affects marker efficiency)
3. **Cutable width validation** - Width must be within greige's `expectedFinishedWidthMin` and `expectedFinishedWidthMax` range
4. **Pattern part assignment** - Link pattern parts to fabrics during CAD planning

### Primary Scenario: Embroidery Parts
**Example:** Nightgown with Viscose fabric
- Pattern parts: Front, Back, Sleeves, Yoke
- **Main CAD:** Front + Back + Sleeves → Cut together → CAD = X meters
- **Embroidery CAD:** Yoke → Cut separately (goes to embroidery) → CAD = Y meters
- Same fabric processes together for dyeing/printing
- **Total Fabric CAD** = Main CAD + Embroidery CAD

### New Field: Print Direction
- **One-Way:** Pattern pieces must all face same direction (more fabric consumption)
- **Two-Way:** Pattern pieces can face either direction (more efficient)
- Affects marker planning and CAD calculation

### Cutable Width Rules
1. User selects greige from `greige_master` (filtered by generic fabric name from style)
2. Cutable width must be between `expectedFinishedWidthMin` and `expectedFinishedWidthMax`
3. **Exception:** If fabric has embroidery, user can enter any width (greige width)
4. Validation enforced in UI and backend

### Required CAD Hierarchy
```
Style Total CAD
  └── Fabric Group CAD (by genericFabricName + fabricFinishType)
        └── Per Fabric CAD
              ├── Main CAD (non-embroidery parts)
              └── Embroidery CAD (embroidery parts) [if applicable]
```

---

## Current State Analysis

### Current Grouping Logic
**Location:** [style-cad-planning.controller.ts:807-872](backend/src/controllers/style-cad-planning.controller.ts#L807-L872)

```typescript
const groupKey = `${genericFabricName}-${fabricFinishType}-${embroideryState}`;
// Example: "Cambric-DYED-NO_EMB"
```

**Limitation:** No pattern part awareness - all parts of a component get same CAD

### Current Data Model Gap
```
pattern_part_master (exists - master data only)
    ↓
component_pattern_parts (exists - links parts to components)
    ↓
❌ NO style_pattern_parts or part-level CAD exists
    ↓
style_components → style_fabrics → fabric_width_cad (component level only)
```

### Cutable Width Auto-Generation
**Location:** [style-cad-planning.controller.ts:9](backend/src/controllers/style-cad-planning.controller.ts#L9)

```typescript
const CUTABLE_WIDTH_OFFSETS = [-2, -4, -6]; // Currently disabled - manual entry only
```

**Current Status:** Auto-generation disabled, users add widths manually on CAD Edit page

---

## Proposed Solution

### Phase 1: Database Schema Changes

#### 1.1 Add `printDirection` to `fabric_width_cad`
```prisma
// Add to existing fabric_width_cad model
printDirection    PrintDirection @default(TWO_WAY)

enum PrintDirection {
  ONE_WAY
  TWO_WAY
}
```

#### 1.2 New Model: `style_pattern_parts`
Links pattern parts to style fabrics with embroidery flag.

```prisma
model style_pattern_parts {
  id                String   @id @default(uuid())
  styleFabricId     String   // FK to style_fabrics
  patternPartId     String   // FK to pattern_part_master
  quantity          Int      @default(1)
  goesToEmbroidery  Boolean  @default(false)  // If true, separate CAD needed
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  styleFabric       style_fabrics       @relation(...)
  patternPart       pattern_part_master @relation(...)

  @@unique([styleFabricId, patternPartId])
}
```

#### 1.3 New Model: `embroidery_part_cad`
Separate CAD for embroidery parts (only created when parts have `goesToEmbroidery = true`).

```prisma
model embroidery_part_cad {
  id                String   @id @default(uuid())
  styleFabricId     String   // FK to style_fabrics
  fabricWidthCadId  String?  // FK to fabric_width_cad (selected width)
  embroideryId      String?  // FK to embroidery master

  // CAD Values for embroidery parts
  cadMeters         Decimal?
  cadYards          Decimal?
  cadWastagePercent Decimal  @default(5)
  layerMarginMeters Decimal?
  piecesPerMarker   Int?
  markerEfficiency  Decimal?
  printDirection    PrintDirection @default(TWO_WAY)

  isApproved        Boolean  @default(false)
  notes             String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  styleFabric       style_fabrics    @relation(...)
  fabricWidthCad    fabric_width_cad @relation(...)
  embroidery        embroidery?      @relation(...)
  sizeBreakdowns    embroidery_cad_size_breakdown[]

  @@unique([styleFabricId])  // One embroidery CAD per style_fabric
}
```

#### 1.4 New Model: `embroidery_cad_size_breakdown`
```prisma
model embroidery_cad_size_breakdown {
  id                String   @id @default(uuid())
  embroideryCadId   String   // FK to embroidery_part_cad
  sizeName          String
  sizeId            String?
  quantity          Int

  embroideryCad     embroidery_part_cad @relation(...)

  @@unique([embroideryCadId, sizeName])
}
```

### Phase 2: Cutable Width Validation

#### Width Validation Logic
```typescript
function validateCutableWidth(
  cutableWidth: number,
  greige: GreigeMaster,
  hasEmbroidery: boolean
): { valid: boolean; message?: string } {
  // If embroidery, allow any width up to greige width
  if (hasEmbroidery) {
    if (cutableWidth > greige.greigeWidth) {
      return { valid: false, message: `Width cannot exceed greige width (${greige.greigeWidth}")` };
    }
    return { valid: true };
  }

  // Non-embroidery: must be within finished width range
  const minWidth = greige.expectedFinishedWidthMin;
  const maxWidth = greige.expectedFinishedWidthMax;

  if (minWidth && cutableWidth < minWidth) {
    return { valid: false, message: `Width must be at least ${minWidth}" (min finished width)` };
  }
  if (maxWidth && cutableWidth > maxWidth) {
    return { valid: false, message: `Width cannot exceed ${maxWidth}" (max finished width)` };
  }

  return { valid: true };
}
```

### Phase 3: Updated CAD Workflow

```
1. Style has fabrics assigned to components (existing)
   ↓
2. In CAD Planning: User assigns pattern parts to style_fabric (NEW)
   - Select which parts from component_pattern_parts apply
   - Mark parts that go to embroidery
   ↓
3. Select greige for fabric group (existing)
   ↓
4. Add cutable widths (existing + validation)
   - Validate against expectedFinishedWidthMin/Max
   - Allow override only for embroidery fabrics
   ↓
5. Enter Main CAD (existing)
   - For non-embroidery parts
   - Select print direction (One-Way/Two-Way)
   - Size breakdown
   ↓
6. Enter Embroidery CAD (NEW - if applicable)
   - Only if any parts marked goesToEmbroidery
   - Separate cadMeters for embroidery parts
   - Size breakdown
   ↓
7. System calculates:
   - Main CAD (non-embroidery parts)
   - Embroidery CAD (embroidery parts)
   - Total Fabric CAD = Main + Embroidery
   - Group CAD (sum of all fabrics in group)
   - Style CAD (total)
   ↓
8. Approve CAD at style level (existing)
```

### Phase 4: Print Direction Implementation

**Where to add:**
- Add `printDirection` enum and field to `fabric_width_cad`
- Display in CAD Edit page as dropdown (One-Way / Two-Way)
- Include in CAD planning summary

**Impact:**
- One-Way prints require more fabric (all pieces face same direction)
- Two-Way allows nesting pieces in opposite directions (more efficient)
- May affect marker efficiency calculation

---

## Files to Modify

### Backend - Schema
| File | Change |
|------|--------|
| [schema.prisma](backend/prisma/schema.prisma) | Add `PrintDirection` enum, `printDirection` field, 3 new models |

### Backend - Controllers
| File | Change |
|------|--------|
| [style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts) | Add pattern part assignment, embroidery CAD endpoints, width validation |
| [fabric-cad.controller.ts](backend/src/controllers/fabric-cad.controller.ts) | Add printDirection field handling |

### Backend - Services
| File | Change |
|------|--------|
| [style.service.ts](backend/src/services/style.service.ts) | Add pattern part queries |
| New: `pattern-part-assignment.service.ts` | Pattern part CRUD for style fabrics |

### Backend - Routes
| File | Change |
|------|--------|
| [style-cad-planning.routes.ts](backend/src/routes/style-cad-planning.routes.ts) | Add pattern part and embroidery CAD routes |

### Backend - Types
| File | Change |
|------|--------|
| [style-cad-planning.types.ts](backend/src/types/style-cad-planning.types.ts) | Add PrintDirection, pattern part, embroidery CAD types |

### Frontend - Pages
| File | Change |
|------|--------|
| [CADPlanningPage.tsx](frontend/src/pages/CADPlanningPage.tsx) | Add pattern part assignment UI, embroidery CAD section |
| [CADEditPage.tsx](frontend/src/pages/CADEditPage.tsx) | Add print direction dropdown, width validation, embroidery CAD form |

### Frontend - Components
| File | Change |
|------|--------|
| New: `PatternPartAssignment.tsx` | Component to assign parts and mark embroidery |
| New: `EmbroideryCadForm.tsx` | Form for entering embroidery part CAD |
| Modify: `CadAverageInput.tsx` | Add print direction selector |

### Frontend - Types
| File | Change |
|------|--------|
| [style.types.ts](frontend/src/types/style.types.ts) | Add PrintDirection, pattern part types |

---

## Implementation Steps

### Step 1: Schema Migration
1. Add `PrintDirection` enum to schema
2. Add `printDirection` field to `fabric_width_cad`
3. Create `style_pattern_parts` model
4. Create `embroidery_part_cad` model
5. Create `embroidery_cad_size_breakdown` model
6. Run `npx prisma migrate dev`

### Step 2: Backend - Width Validation
1. Add `validateCutableWidth()` function to `style-cad-planning.controller.ts`
2. Enforce in `addCADWidth()` endpoint
3. Return error if width outside `expectedFinishedWidthMin/Max` range
4. Skip validation if fabric has embroidery parts

### Step 3: Backend - Pattern Parts API
1. `GET /api/styles/:id/fabrics/:fabricId/pattern-parts` - Get assigned parts
2. `POST /api/styles/:id/fabrics/:fabricId/pattern-parts` - Assign parts
3. `PUT /api/styles/:id/pattern-parts/:partId` - Update (toggle embroidery flag)
4. `DELETE /api/styles/:id/pattern-parts/:partId` - Remove assignment

### Step 4: Backend - Embroidery CAD API
1. `GET /api/styles/:id/fabrics/:fabricId/embroidery-cad` - Get embroidery CAD
2. `POST /api/styles/:id/fabrics/:fabricId/embroidery-cad` - Create/update
3. Include size breakdown management
4. Calculate total fabric CAD (Main + Embroidery)

### Step 5: Backend - Print Direction
1. Add to CAD creation/update endpoints
2. Include in CAD responses
3. Update serializer mappings

### Step 6: Frontend - Pattern Part Assignment
1. Create `PatternPartAssignment.tsx` component
2. Display in CAD Planning page per fabric group
3. Checkbox to mark parts for embroidery
4. Save on change

### Step 7: Frontend - Embroidery CAD Form
1. Show only when embroidery parts exist
2. Separate CAD entry fields
3. Size breakdown grid
4. Calculate and display total

### Step 8: Frontend - Print Direction
1. Add dropdown to CAD Edit page
2. Options: "One-Way", "Two-Way"
3. Save with CAD data

### Step 9: Frontend - Width Validation
1. Show `expectedFinishedWidthMin` / `Max` from greige
2. Validate input before save
3. Show error message if out of range
4. Allow override for embroidery fabrics

---

## Confirmed Decisions

| Decision | Answer |
|----------|--------|
| Pattern parts source | Both - default from component, user can add/remove |
| Pattern part assignment timing | During CAD planning |
| Cutable width validation | Enforce min/max finished width from greige (except embroidery) |
| Print direction | Add One-Way / Two-Way field to CAD |
| CAD approval level | Style level (existing behavior) |
| UI issues | To be addressed separately |

---

## Summary

This plan adds **4 key enhancements** to CAD Planning:

1. **Print Direction Field** - One-Way vs Two-Way for marker efficiency
2. **Pattern Part Assignment** - Assign parts to fabrics during CAD planning, mark embroidery parts
3. **Separate Embroidery CAD** - Parts going to embroidery get their own CAD calculation
4. **Cutable Width Validation** - Enforce greige's finished width range (with embroidery exception)

**Schema changes:** 1 new enum + 3 new models
**New API endpoints:** ~8 endpoints for pattern parts and embroidery CAD
**Frontend changes:** 2 new components, updates to CAD pages

---

---

# REVISED PLAN: Simplified Single-Page CAD Workflow

## User Feedback

> "The entire form has been made too complicated with unnecessary pages and steps. Once the greige is selected user should be given all the options in a single row, and if another width we want user can select in second row."

## Current Problems

1. **Two-Page Flow** - CADPlanningPage → CADEditPage navigation is cumbersome
2. **Hidden CAD Entry** - CAD values are entered on a separate page (CADEditPage)
3. **Pattern Parts Missing** - PatternPartAssignment component exists but not integrated
4. **Embroidery CAD Missing** - EmbroideryCadForm component exists but not integrated
5. **Too Many Clicks** - Select greige → Navigate → Add width → Enter CAD → Navigate back

## Simplified Design

### Single-Page Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAD Planning Page (Unified)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each Fabric Group:                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ HEADER: Cambric - DYED                                     [Approved] │  │
│  │ Components: Body, Sleeve, Yoke                                        │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │ Step 1: Select Greige                                                 │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ [Dropdown: Select Greige] Greige: 63" | Cutable: 53"-55"       │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │ Step 2: Pattern Parts (Optional - shows after greige selection)      │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ [PatternPartAssignment Component]                              │   │  │
│  │ │ ☑ Front ☑ Back ☑ Sleeve   ☐ Yoke (goes to embroidery)         │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │ Step 3: CAD Width Rows (Inline Table)                                │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ Width│ CAD(m) │ Layer │ Pcs │ Size Breakdown │ Print │ Actions │   │  │
│  │ ├──────┼────────┼───────┼─────┼────────────────┼───────┼─────────┤   │  │
│  │ │ 54"  │ 1.55   │ 15.5m │ 10  │ S:2 M:4 L:3 XL:1│ 2-Way │ ○ ★ 🗑  │   │  │
│  │ │ 53"  │ 1.62   │ 16.2m │ 10  │ S:2 M:4 L:3 XL:1│ 2-Way │ ● ☆ 🗑  │   │  │
│  │ ├──────┼────────┼───────┼─────┼────────────────┼───────┼─────────┤   │  │
│  │ │ [+Add Row: Enter width ___" ]                        [Add]     │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │ Step 4: Embroidery CAD (Only if embroidery parts marked)             │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ [EmbroideryCadForm Component]                                  │   │  │
│  │ │ Parts: Yoke    Width: 52"    CAD: 0.45m                       │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [Approve CAD Plan]                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Inline CAD Row Component

Each row in the CAD table is editable inline:

```tsx
interface InlineCADRow {
  cutableWidth: number;     // Editable input
  cadMeters: number | null; // Editable input
  layerLength: number | null; // Editable input (optional)
  sizeBreakdown: { [size: string]: number }; // Inline size inputs (S:_, M:_, L:_, XL:_)
  printDirection: 'ONE_WAY' | 'TWO_WAY'; // Dropdown
  isSelected: boolean;      // Radio button
  isPreferred: boolean;     // Star icon toggle
}
```

### Key Differences from Current Design

| Current | Simplified |
|---------|------------|
| CADPlanningPage shows summary table | Shows editable inline table |
| Click "Edit" → navigates to CADEditPage | Edit directly in row |
| Size breakdown on separate page | Size inputs inline in row |
| Print direction on CADEditPage | Dropdown in row |
| Pattern parts not shown | PatternPartAssignment integrated |
| Embroidery CAD not shown | EmbroideryCadForm integrated below main CAD |

## Implementation Steps

### Phase 1: Consolidate CAD Planning Page

**File:** `frontend/src/pages/CADPlanningPage.tsx`

1. **Replace FabricGroupCard with InlineFabricGroupCard**
   - Keep greige selection as-is
   - Add PatternPartAssignment component below greige selection
   - Replace CAD summary table with editable InlineCADTable

2. **Create InlineCADTable Component**
   ```tsx
   interface InlineCADTableProps {
     cadOptions: CADOption[];
     sizeOptions: SizeOption[];
     selectedCADId: string | null;
     onUpdate: (cadId: string, data: Partial<CADOption>) => Promise<void>;
     onAdd: (cutableWidth: number) => Promise<void>;
     onDelete: (cadId: string) => Promise<void>;
     onSelect: (cadId: string) => void;
   }
   ```

3. **Create InlineCADRow Component**
   - Each row is a self-contained editable unit
   - Debounced auto-save on blur (or explicit save button)
   - Size breakdown as inline mini-inputs

4. **Integrate PatternPartAssignment**
   - Show after greige selection
   - Pass `styleId`, `fabricId`, `componentId`
   - Listen for `onPatternPartsChange` to show/hide EmbroideryCadForm

5. **Integrate EmbroideryCadForm**
   - Show conditionally when embroidery parts exist
   - Display below main CAD table

### Phase 2: API Updates

**File:** `backend/src/controllers/style-cad-planning.controller.ts`

1. **Bulk Update Endpoint**
   - `PUT /api/styles/:id/cad-planning/bulk-update`
   - Accepts array of CAD updates for efficiency
   - Reduces round-trips when user edits multiple rows

2. **Pattern Parts Endpoint** (Already exists)
   - `GET /api/styles/:id/fabrics/:fabricId/pattern-parts`
   - `POST /api/styles/:id/fabrics/:fabricId/pattern-parts/from-component`

### Phase 3: Remove CADEditPage Navigation

1. Keep CADEditPage as fallback for advanced editing
2. Remove navigation from CADPlanningPage "Edit" buttons
3. All essential editing happens inline

## File Changes

### Frontend

| File | Change |
|------|--------|
| [CADPlanningPage.tsx](frontend/src/pages/CADPlanningPage.tsx) | Major refactor - inline editing |
| New: `InlineCADTable.tsx` | Editable CAD table component |
| New: `InlineCADRow.tsx` | Single editable CAD row |
| [PatternPartAssignment.tsx](frontend/src/components/PatternPartAssignment.tsx) | Integrate into CADPlanningPage |
| [EmbroideryCadForm.tsx](frontend/src/components/EmbroideryCadForm.tsx) | Integrate into CADPlanningPage |
| [CADEditPage.tsx](frontend/src/pages/CADEditPage.tsx) | Keep for advanced editing, not primary flow |

### Backend

| File | Change |
|------|--------|
| [style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts) | Add bulk update endpoint |
| [style-cad-planning.routes.ts](backend/src/routes/style-cad-planning.routes.ts) | Add bulk update route |

## Detailed Component Design

### InlineCADRow Component

```tsx
function InlineCADRow({
  cad,
  sizeOptions,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  saving,
  widthRange, // { min: number, max: number } from greige
}: Props) {
  return (
    <tr className={cn(isSelected && 'bg-blue-50')}>
      {/* Select radio */}
      <td>
        <input type="radio" checked={isSelected} onChange={() => onSelect(cad.id)} />
      </td>

      {/* Cutable Width */}
      <td>
        <Input
          type="number"
          value={cad.cutableWidth}
          onChange={(e) => onUpdate(cad.id, { cutableWidth: parseFloat(e.target.value) })}
          className="w-16"
        />
      </td>

      {/* CAD Meters */}
      <td>
        <Input
          type="number"
          step="0.001"
          value={cad.cadMeters || ''}
          onChange={(e) => onUpdate(cad.id, { cadMeters: parseFloat(e.target.value) })}
          className="w-20"
        />
      </td>

      {/* Layer Length */}
      <td>
        <Input
          type="number"
          value={cad.markerLengthMeters || ''}
          onChange={(e) => onUpdate(cad.id, { markerLengthMeters: parseFloat(e.target.value) })}
          className="w-16"
        />
      </td>

      {/* Size Breakdown - compact */}
      <td>
        <div className="flex gap-1 text-xs">
          {sizeOptions.map(size => (
            <div key={size.sizeName} className="flex items-center gap-0.5">
              <span className="text-muted-foreground">{size.sizeName}:</span>
              <Input
                type="number"
                min={0}
                value={cad.sizeBreakdowns?.find(s => s.sizeName === size.sizeName)?.quantity || ''}
                onChange={(e) => handleSizeChange(size.sizeName, parseInt(e.target.value))}
                className="w-8 h-6 p-0.5 text-center"
              />
            </div>
          ))}
        </div>
      </td>

      {/* Print Direction */}
      <td>
        <Select value={cad.printDirection} onValueChange={(v) => onUpdate(cad.id, { printDirection: v })}>
          <SelectTrigger className="w-20 h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TWO_WAY">2-Way</SelectItem>
            <SelectItem value="ONE_WAY">1-Way</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Actions */}
      <td>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onSetPreferred(cad.id)}>
            {cad.isPreferred ? <Star className="h-4 w-4 fill-yellow-400" /> : <Star className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(cad.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
```

## Success Criteria

1. **Single page** - User never leaves CAD Planning page for basic workflow
2. **Inline editing** - CAD values editable directly in table rows
3. **Pattern parts visible** - PatternPartAssignment shows after greige selection
4. **Embroidery CAD shown** - EmbroideryCadForm appears when parts marked for embroidery
5. **Fewer clicks** - Add width + enter CAD in same row, not separate page
6. **Mobile-friendly** - Table is responsive or collapses to cards on mobile

## Migration Path

1. Implement InlineCADTable and InlineCADRow components
2. Update CADPlanningPage to use inline components
3. Keep CADEditPage route for backward compatibility
4. Test thoroughly with existing data
5. Remove "Edit" button navigation to CADEditPage
6. Eventually deprecate CADEditPage (or keep for advanced use)

---

## Ready for Implementation

The plan above consolidates the CAD workflow into a single page with:
- Inline editable CAD rows
- Integrated pattern part assignment
- Integrated embroidery CAD form
- No navigation to separate pages

**Estimated Changes:**
- 1 major component refactor (CADPlanningPage)
- 2 new components (InlineCADTable, InlineCADRow)
- Integration of 2 existing components (PatternPartAssignment, EmbroideryCadForm)
- 1 new API endpoint (bulk update)
