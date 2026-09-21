---
slug: fabric-costing-run
title: Run Fabric Costing for a Style
keywords:
  # English
  - fabric costing
  - costing run
  - processor cost
  - fabric rate
  - build up cost
  - landed price
  - greige cost
  - processing cost
  - shrinkage
  - screen cost
  - fabric cost per meter
  # Hinglish
  - fabric costing karna
  - costing run karna
  - fabric ka rate
  - processor rate lookup
  - shrinkage calculate
  # Devanagari
  - फैब्रिक कॉस्टिंग
  - कॉस्टिंग रन
  - फैब्रिक रेट
  - प्रोसेसर कॉस्ट
  - ग्रेज कॉस्ट
  - सिकुड़न
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricCostingPage.tsx
  - frontend/src/pages/ProcessorRateCardPage.tsx
route: /fabric-costing
---

## Before you start

1. **CAD Planning must be done first** - Fabric Costing needs CAD data (meters per piece consumption). If CAD data is missing, a warning banner appears with a link to create it.

2. **Style must exist** - The style should be created with its fabrics linked in the Style Master.

3. **Processor Rate Cards should be set up** - For Build Up costing mode, processor rate cards define the processing cost per meter based on quantity slabs.

## Steps

### 1. Open Fabric Costing

**Menu:** Pre-Production > Fabric Costing

### 2. Select a Style

Two ways to find a style:

**Quick Search (recommended):**
- Type in the "Quick Search" box
- Search by style code, buyer reference, or style name
- Results show costing status (Costed/Approved/Pending) and option count
- Click a result to select

**Or Customer > Style dropdown:**
- Select Customer first
- Then select Style from the filtered dropdown

### 3. Choose the Mode

Three tabs for different purposes:

| Mode | Use When |
|------|----------|
| **Costing** | Creating quotations - initial pricing |
| **Raw Mat Calculation** | MRP for confirmed orders |
| **Production** | Final locked costings for production |

### 4. Set Order Quantity

- Enter the order quantity in pieces (e.g., 1000)
- This quantity affects processor rate slab lookups
- Changing quantity from a previous costing creates a NEW option (preserves the original)
- Each row can also have its own quantity override

### 5. Cost Each Fabric Row

The table shows all fabrics from CAD Planning. For each row:

**Choose Costing Mode:**
- **Build Up** - Calculate from components (greige + transport + processing + shrinkage + screens)
- **Landed** - Direct landed price per meter

**For Build Up Mode:**

1. **Greige Rate (Rs/m):**
   - Auto-filled from Greige Master if available
   - Shows source label (stock, procurement, manual)
   - Blue refresh icon appears when a newer rate exists

2. **Transport:**
   - Default Rs 2/m
   - Edit if different

3. **Select Processor:**
   - Click the Processor dropdown
   - Select a processor (dyer/printer)
   - Rate auto-looks up from Rate Cards based on:
     - Processor
     - Greige type
     - Print Type (printing only)
     - Quantity (uses combined batch quantity if same greige + color)
   - For a printed fabric the rate is fetched once Print Type is set. Until then the Process
     column reads "Print type?" rather than leaving you guessing.

4. **For Printing - additional fields:**
   - Number of Colors
   - Print Type (Pigment / Procian / Discharge / Pig+Dis) - rates are held separately per
     print type, so the rate cannot be fetched until this is set
   - Screen (Rotary / Flat Belt / Table) - affects screen cost calculation
   - Screen cost is amortized over the total meters

5. **Shrinkage:**
   - Auto-filled from processor rate card
   - Affects greige requirement calculation

**For Landed Price Mode:**
- Simply enter the total landed price per meter
- Used for ready fabrics with known cost

### 6. Review Calculations

The table shows:
- **Total (Rs/m)** - Final fabric cost per meter
- **Part Cost (Rs)** - Cost per garment (CAD m/pc x Total Rs/m)
- **Fabric Req (m)** - Total finished fabric needed
- **Greige Req (m)** - Total greige needed (accounts for shrinkage)

**Stock Badge:** If finished fabric stock exists at that width, a badge shows available meters and coverage.

### 7. Save Costing

- Click **Save Costing** button
- Saves to fabric_width_cad table
- Option to create a "Costing Run" to group these fabrics together

### 8. View Options (Optional)

- Click **Options** button or **View All Options**
- See all saved costing options for the style
- Approve options from there

## Traps

- **Missing greige rate blocks save** - Build Up rows without a greige price cannot be saved. Enter a rate or set one on the Greige Master.

- **Missing landed price skipped** - Landed Price mode rows without a price are silently excluded from save.

- **Approved costings unchanged** - Already approved costing options are skipped. Unapprove on the Options page first to modify.

- **CAD data required** - Without CAD Planning data, fabric consumption (m/pc) is unknown and costing won't work properly.

- **Rate card not found** - If no rate matches the processor + greige + print type + quantity
  combination, a warning panel above the table names the exact reason, and the affected rows
  show a red "no rate card" marker in the Process column. The reason stays on screen until it
  is fixed. Click **Go to Rate Cards** in the panel to open the Rate Card page with that
  processor, process type and print type already selected. Rows with no processor rate are
  skipped on save and named, so add the rate and fetch it again before saving.

- **Batch quantity** - Fabrics with same greige + same color are batched together for rate lookup. The combined quantity may hit a lower rate slab.

## After running

1. **View Saved Options** - Button appears after save to see all options

2. **Approve Options** - Go to Costing Options page to approve the preferred option

3. **Use in Cost Sheet** - Approved fabric costs feed into the Style Cost Sheet

4. **MRP uses approved costings** - Material Requirement Planning uses approved Production-mode costings for procurement calculations
