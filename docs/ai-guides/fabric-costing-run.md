---
slug: fabric-costing-run
title: Run Fabric Costing for a Style
keywords:
  # English
  - fabric costing
  - costing run
  - greige rate from PO
  - live greige rate
  - greige rate reason
  - processor cost
  - fabric rate
  - build up cost
  - landed price
  - greige cost
  - processing cost
  - shrinkage
  - screen cost
  - fabric cost per meter
  - saved run details
  - how was the run costed
  - compare costing runs
  - old costing run
  # Hinglish
  - PO wala rate
  - greige rate reason kyun
  - fabric costing karna
  - costing run karna
  - fabric ka rate
  - processor rate lookup
  - shrinkage calculate
  - purana run dekhna
  - run kaise bana tha
  - run ki detail
  # Devanagari
  - फैब्रिक कॉस्टिंग
  - कॉस्टिंग रन
  - फैब्रिक रेट
  - प्रोसेसर कॉस्ट
  - ग्रेज कॉस्ट
  - पीओ रेट
  - ग्रेज रेट का कारण
  - सिकुड़न
  - रन की डिटेल
  - पुराना रन
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricCostingPage.tsx
  - frontend/src/components/fabric-costing/CostingRunDetailDialog.tsx
  - frontend/src/utils/greigeRate.ts
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
- Results show costing status (Approved/Pending) and option count
- Click a result to select

**Or Customer > Style dropdown:**
- Select Customer first
- Then select Style from the filtered dropdown

### 3. Choose the Mode

Two tabs for different purposes:

| Mode | Use When |
|------|----------|
| **Costing** | Creating quotations - initial pricing |
| **Raw Mat Calculation** | MRP for confirmed orders |

There is no Production mode. A Production CAD (one per received fabric lot) is made and approved in **CAD Planning** and is never costed.

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
   - Filled with the live rate: the newest greige PO or purchase for that greige, else the Greige Master default
   - The label under the box says where it came from: **from PO**, **from purchase**, **from stock**, **default**, **committed** (the rate a saved costing was priced at) or **manual**
   - When the box differs from today's rate, a line under it reads **Use ₹67 · PO2609-0004**; click it (or the blue refresh icon) to take the live rate
   - A typed rate that differs from the live one needs a reason: fill the **Reason** box that appears under it. **Save Costing** names any row still missing one

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
- A dialog offers **Create Run N**: it saves these fabrics as a costing run. A run keeps its own copy of every figure, so later changes to the costing do not alter it — you can save several runs (for example at different quantities) and look back at each.

### 8. View Options (Optional)

- Click **Options** button or **View All Options**
- See all saved costing options for the style
- Approve options from there

### 9. See how a saved run was costed

1. Select the style and the mode (**Costing** or **Raw Mat Calculation**). The **Existing Costing Runs** box lists that mode's runs, newest first.
2. Each run card shows the fabric cost per garment, the number of fabrics, the order quantity, the processor, and when and by whom it was saved. **N changed since** means some of its fabrics have been re-costed after the run was saved.
3. Click a run card. A window opens showing, for every fabric, how the cost was built up as it was when the run was saved:
   - **Greige** rate and where it came from (from PO with the PO number, from a purchase, from a stock lot, Greige Master default, or typed by hand with the reason)
   - **+ Transport**, **+ Processing** (processor, process, print type and colours), **+ Shrinkage** (the loss %), **+ Screen**
   - **= Fabric cost** per metre, **× CAD average** per piece = cost per garment
   - The quantity it was costed for, and whether a batch rate was used
   - Whether the price was approved at that time
4. A fabric marked **Re-costed since this run** shows **Today:** with the current figure under the run's own figure. **Costing removed since** means that fabric's costing was later removed. **This fabric was saved again in Run N** means it is also in a later run.
5. Runs saved before 26-Sep-2026 say their figures were recorded on that date, from the costing as it stood then.
6. To delete a run, click the bin icon on its card. Deleting a run does not delete the costing itself.

## Traps

- **Missing greige rate blocks save** - Build Up rows without a greige price cannot be saved. Enter a rate or set one on the Greige Master.
- **A typed greige rate needs a reason** - If the rate differs from the live one, the save is refused until the **Reason** box under it is filled. Click **Use ₹…** to take the live rate instead.
- **"Processing rate looked up again for … row"**: the fabric (greige) on those rows was changed in CAD Planning after they were costed, so the page read the processor's rate for the new greige. Check the **Process** rate, then click **Save Costing**. If it says **No processor rate for this combination**, add the new greige for that processor on the **Processor Rate Card** page first
- **"… the processing rate is <processor>'s rate for GRG-…, but this fabric is now GRG-…"**: the save was refused because the rate came from another greige. Select the processor again on that row to take its rate for the new greige

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

4. **MRP uses the order BOM** - The order BOM is built from the style's approved Raw Material Calculation cost sheet, and MRP works from that BOM
