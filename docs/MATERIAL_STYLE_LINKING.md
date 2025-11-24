# Material-Style Linking & Requirement Planning

## Overview

This document explains how to link materials (Lace, Buttons, Threads, etc.) to styles and track consumption.

---

## Workflow

### Step 1: Create Materials First

Create your materials using the Phase 1 system:

**Example:**
```
Navigate to: /materials/lace
Click: "Create New Lace"
Enter: "White Floral Lace 2inch"
Submit → Gets code: LACE-0001
```

**Repeat for all material types:**
- Lace → LACE-0001, LACE-0002, ...
- Buttons → BTN-0001, BTN-0002, ...
- Threads → THR-0001, THR-0002, ...
- Zippers → ZIP-0001, ZIP-0002, ...
- Elastic → ELA-0001, ELA-0002, ...
- Labels → LAB-0001, LAB-0002, ...
- Packaging → PKG-0001, PKG-0002, ...

---

### Step 2: Create Style & Link Materials

When creating a style, add materials in the **Garment Trims** tab:

**Example Style: ABC-001 "Fancy Top"**

In the **Trims & Variants** tab:
1. Click "+ Add Trim"
2. Select trim from dropdown (shows all materials)
3. Enter quantity per piece
4. Select unit (meters, pieces, etc.)

**Example Configuration:**
```
Trim Name: LACE-0001 (White Floral Lace)
Quantity per Piece: 2
Unit: meters

Trim Name: BTN-0001 (Pearl Button 15mm)
Quantity per Piece: 5
Unit: pieces

Trim Name: THR-0001 (White Thread)
Quantity per Piece: 50
Unit: meters
```

This creates entries in the `style_garment_trims` table.

---

## Material Requirement Queries

### Query 1: Calculate Requirements for an Order

**Question:** "I have an order for 1000 pieces of Style ABC-001. How much material do I need?"

**API Endpoint (Planned):**
```
POST /api/materials/calculate-requirement
{
  "styleId": "abc-001-id",
  "orderQuantity": 1000
}
```

**Response:**
```json
{
  "styleCode": "ABC-001",
  "orderQuantity": 1000,
  "requirements": [
    {
      "materialCode": "LACE-0001",
      "materialName": "White Floral Lace 2inch",
      "quantityPerPiece": 2,
      "totalRequired": 2000,
      "unit": "meters",
      "availableStock": 1500,
      "shortfall": 500,
      "status": "SHORTAGE"
    },
    {
      "materialCode": "BTN-0001",
      "materialName": "Pearl Button 15mm",
      "quantityPerPiece": 5,
      "totalRequired": 5000,
      "unit": "pieces",
      "availableStock": 6000,
      "shortfall": -1000,
      "status": "SURPLUS"
    }
  ]
}
```

---

### Query 2: Find Styles Using a Material

**Question:** "Which styles use LACE-0001?"

**API Endpoint (Planned):**
```
GET /api/materials/lace/LACE-0001/styles
```

**Response:**
```json
{
  "materialCode": "LACE-0001",
  "materialName": "White Floral Lace 2inch",
  "usedInStyles": [
    {
      "styleCode": "ABC-001",
      "styleName": "Fancy Top",
      "quantityPerPiece": 2,
      "unit": "meters"
    },
    {
      "styleCode": "DEF-002",
      "styleName": "Designer Dress",
      "quantityPerPiece": 5,
      "unit": "meters"
    }
  ],
  "totalStylesUsing": 2
}
```

---

### Query 3: Bulk Production Planning

**Question:** "I have 5 different orders. What materials do I need total?"

**API Endpoint (Planned):**
```
POST /api/materials/bulk-requirement
{
  "orders": [
    { "styleId": "abc-001-id", "quantity": 1000 },
    { "styleId": "def-002-id", "quantity": 500 },
    { "styleId": "ghi-003-id", "quantity": 750 }
  ]
}
```

**Response:**
```json
{
  "aggregateRequirements": [
    {
      "materialCode": "LACE-0001",
      "totalRequired": 6500,
      "unit": "meters",
      "availableStock": 5000,
      "shortfall": 1500,
      "usedInStyles": ["ABC-001", "DEF-002", "GHI-003"]
    }
  ]
}
```

---

## Database Tables Involved

### 1. Material Masters
- `lace_master` - Stores lace details with LACE-0001 code
- `button_master` - Stores button details with BTN-0001 code
- `thread_master` - Stores thread details with THR-0001 code
- Similar for zipper, elastic, label, packaging

### 2. Materials (Universal Container)
- `materials` - Universal reference table
- Links to specific masters via `laceId`, `buttonId`, etc.
- Used in inventory tracking

### 3. Style-Material Link
- `style_garment_trims` - Current system (direct link)
- `style_material_bom` - Phase 2 (unified BOM) - **PLANNED**

### 4. Inventory Tracking
- `inventory_stock` - Stock levels by location
- `stock_levels` - Alternative stock tracking
- `stock_transactions` - Stock movement history

---

## Current Status

### ✅ Implemented
1. Material masters with auto-code generation (LACE-0001, BTN-0001, etc.)
2. Style-garment trims linking (manual entry in style form)
3. Basic BOM structure

### 🚧 Planned (Phase 2)
1. **Material Requirement Service** (partially created - see `backend/src/services/material-requirement.service.ts`)
2. **API endpoints** for requirement calculations
3. **Frontend reports** showing:
   - Materials needed for orders
   - Styles using a material
   - Stock availability checks
4. **Inventory integration** for real-time stock levels

### 📋 To-Do
1. Link `style_garment_trims` to `materials` table properly
2. Implement stock checking in requirement calculations
3. Create frontend Material Requirement Report
4. Add "Styles Using This Material" tab in material detail pages
5. Add "Material Availability Check" in order creation

---

## Recommended Next Steps

### Option A: Complete Current Workflow (Quick Win)
1. Create a few lace/button/thread items
2. Create a test style
3. Add the materials as garment trims
4. Manually calculate requirements (Excel/calculator)
5. **Benefit:** Can start using the system immediately

### Option B: Build MRP System (Proper Solution)
1. Implement Material Requirement API endpoints
2. Create Material Requirement Report page
3. Add stock integration
4. Add "Check Availability" button in order creation
5. **Benefit:** Automated requirement planning

### Option C: Phase 2 Integration (Complete BOM)
1. Activate `style_material_bom` table
2. Migrate `style_garment_trims` to unified BOM
3. Link all material types (fabrics, trims, packaging)
4. Build comprehensive costing & requirement system
5. **Benefit:** Complete ERP solution

---

## Example Scenario

**Your Business Case:**
```
Order Received:
- Style: ABC-001 "Fancy Top"
- Quantity: 1000 pieces
- Delivery: 30 days

Materials Required (from BOM):
✅ LACE-0001 (White Floral Lace) → 2 meters × 1000 = 2000 meters
✅ BTN-0001 (Pearl Button) → 5 pieces × 1000 = 5000 pieces
✅ THR-0001 (White Thread) → 50 meters × 1000 = 50,000 meters

Stock Check:
✅ LACE-0001: Available = 2500 meters (surplus: 500 meters)
❌ BTN-0001: Available = 3000 pieces (shortage: 2000 pieces)
✅ THR-0001: Available = 75,000 meters (surplus: 25,000 meters)

Action Required:
🛒 Purchase 2000 pieces of BTN-0001 (Pearl Button 15mm)
```

---

## Technical Implementation

### Service Layer
```typescript
// File: backend/src/services/material-requirement.service.ts
export async function calculateMaterialRequirement(
  styleId: string,
  orderQuantity: number
): Promise<MaterialRequirement[]>
```

### Controller Layer (To Be Created)
```typescript
// File: backend/src/controllers/material-requirement.controller.ts
export async function getMaterialRequirements(req: Request, res: Response)
export async function getStylesUsingMaterial(req: Request, res: Response)
export async function checkAvailability(req: Request, res: Response)
```

### Frontend Component (To Be Created)
```
Page: /reports/material-requirements
Features:
- Select style + order quantity
- Shows required materials
- Highlights shortages in red
- Shows surplus in green
- Export to Excel
```

---

## Questions & Answers

**Q: Can I add materials AFTER creating a style?**
A: Yes! Edit the style and add more garment trims.

**Q: Can I change quantity per piece later?**
A: Yes! Edit the style and update the trim quantities.

**Q: How do I know if I have enough stock before accepting an order?**
A: Use the Material Availability Check (Phase 2 feature - to be implemented).

**Q: Can one material be used in multiple styles?**
A: Yes! That's the whole point. LACE-0001 can be used in 10 different styles.

**Q: How do I track which styles are using a material?**
A: Use the "Styles Using This Material" report (Phase 2 - to be implemented).

---

**Last Updated:** January 24, 2025
**Status:** Workflow Documented, MRP Service Created (Partial), APIs Pending
