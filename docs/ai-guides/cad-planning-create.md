---
slug: cad-planning-create
title: Create a CAD Plan (Marker)
keywords:
  # English
  - CAD
  - CAD planning
  - marker
  - marker efficiency
  - fabric consumption
  - average
  - cuttable width
  - layer length
  - size breakdown
  - pattern parts
  - greige selection
  - fabric width
  - CAD average
  - marker plan
  - cutting plan
  - production CAD
  - create CAD from stock
  - fabric stock available
  - received lot
  - GRN lot
  - rejected CAD
  - approve production CAD
  # Hinglish
  - CAD banana
  - marker banane ka tarika
  - average nikalna
  - fabric ka consumption
  - cutting plan banana
  - width select karna
  - greige dalna
  - lot ka CAD banana
  - production CAD approve karna
  - CAD reject ho gaya
  - maal aa gaya CAD
  # Devanagari (MANDATORY)
  - कैड
  - कैड प्लानिंग
  - मार्कर
  - एवरेज
  - फैब्रिक कंजम्पशन
  - कटिंग प्लान
  - ग्रेज
  - साइज ब्रेकडाउन
  - लेयर लेंथ
  - प्रोडक्शन कैड
  - लॉट
  - कैड रिजेक्ट
  - कैड अप्रूव
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CADPlanningPage.tsx
  - frontend/src/pages/CADPlanningList.tsx
  - frontend/src/components/cad/CADSpreadsheetTable.tsx
  - frontend/src/components/cad/StockSummaryBanner.tsx
route: /cad-planning
---

## Before you start

A style must exist with:
- At least one component (e.g., Top, Bottom, Sleeve)
- Fabrics assigned to components (fabric finish type, greige linked)
- Size category assigned to the style (for size breakdown options)

## Steps

### 1. Open CAD Planning

1. Click **Pre-Production** in the sidebar.
2. Click **CAD Planning**.
3. The list shows styles organized by status tabs:
   - **Pending** tab: Styles with CAD work pending (includes IN_PROGRESS)
   - **Approved** tab: Styles with approved CAD plans

### 2. Find your style

- Use the **Search** bar to search by style code, name, buyer, or brand (searches across all statuses).
- Click the expand arrow on any row to see existing CAD width details grouped by purpose.
- Check the **Progress** column to see which purposes are done:
  - **Costing** - for cost sheet generation
  - **Raw Mat** - for raw material requirement planning
  - **Production** - for actual production cutting

### 3. Open the CAD spreadsheet

1. Click **Open CAD** button on your style row.
2. The CAD Planning page opens with three tabs:
   - **CAD Spreadsheet** - main editing area (default)
   - **CAD History** - view all historical CAD options
   - **Order History** - orders using this style's CAD

### 4. Add a CAD row

1. On the CAD Spreadsheet tab, click **+ Add Row** button.
2. In the dialog:
   - Select **Purpose** *: Costing, Raw Mat (RAW_MATERIAL_CALCULATION), or Production
   - Select **Style Fabric(s)**: Choose which fabric(s) this CAD row covers
   - For **Production** purpose: You must also pick the received lot in **Select stock...**
3. Click **Add** to create the row.

> **Received fabric?** For a Production CAD, use **Create CAD** on the lot in the **Fabric Stock Available** box instead (section 10) — it fills the marker in for you.

> **Tip**: To create a combined-cutting row (one marker for several components), tick them all and click **Combine as 1 … Row**. Components can be combined only when they are the SAME fabric: same generic greige, same finish, same colour (or print design) and same embroidery. The box under the list says **Can be combined** or tells you why not.

### 5. Fill in CAD row data

Each row has these columns (left to right):

**Pre-populated (gray background, auto-filled):**
- **Purpose** - Costing / Raw Mat / Production
- **Component** - Auto-filled from style fabric
- **Fabric Finish** - e.g., PLAIN, PRINTED, DYED
- **Embroidery** - Shows if fabric has embroidery
- **Generic Greige** - Base greige name

**Editable (blue background, you fill these):**
- **Part** * - Select pattern part (e.g., All Parts, Body, Sleeve)
- **Greige Name** * - Select specific greige (dropdown from available greiges)
- **Cutable Width** * - Enter width in inches (e.g., 42, 44, 58)
- **Print Direction** - Select if applicable (LENGTHWISE / WIDTHWISE)
- **Size Breakdown** * - Click to open size popup, enter quantity per size
- **Layer Margin (m)** - Optional margin added per layer

**Calculated (green background, auto-computed):**
- **No. of Pcs** - Total pieces from size breakdown
- **Layer (M)** - Marker length in meters
- **CAD Average** - Fabric consumption per piece in meters

### 6. Enter size breakdown

1. Click the **Size Breakdown** cell (shows current values or "Click to set").
2. In the popup:
   - Each size shows +/- buttons and an input field
   - Enter quantity for each size in the marker (e.g., S:1, M:2, L:2, XL:1)
   - Use **+ Add 1 to all** to quickly increment all sizes
   - Use **Clear** to reset all to zero
   - **Total Pieces** shows at the bottom
3. Click **Save**.

### 7. Verify CAD calculations

After filling cutable width and size breakdown, the system auto-calculates:
- **No. of Pcs** = sum of all sizes in the marker
- **Layer (M)** = marker length based on greige and width
- **CAD Average** = Layer(M) / No. of Pcs = meters per piece

> **Important**: CAD Average is the key output used in cost sheets and MRP.

### 8. Approve the CAD plan

Once all rows have CAD values:

1. The status card shows: "All CAD entries complete. Ready to approve!"
2. Click **Actions** dropdown > **Approve CAD Plan**.
3. Review the confirmation:
   - "Once approved, the CAD plan will be locked..."
   - "You won't be able to change fabric widths or values after approval"
4. Click **Approve & Lock**.

After approval:
- Status changes to **APPROVED** (green badge)
- You can now generate cost sheets
- CAD values are locked for this style

### 9. Push to Fabric Costing (optional)

Push creates costing records for Costing and Raw Mat rows only — Production rows are skipped.

After approval, to create fabric costing records:

1. Click **Actions** dropdown > **Push to Fabric Costing**.
2. Review what will be created:
   - Shows count of new records to create
   - Shows count of existing records (skipped)
3. Click **Create X Records** to proceed.
4. You are redirected to the Fabric Costing page.

### 10. Make the Production CAD for received fabric

When processed fabric has been received for the style, a green **Fabric Stock Available** box appears above the spreadsheet. It lists every lot with its GRN number, cutable width and metres, e.g. `GRN2609-0080 · 52" • 852.1m`, and a badge such as **2 need CAD**.

1. Click **Create CAD** next to a lot. There is one Production CAD per lot.
2. A new **Production** row appears, already filled from the approved Raw Mat (or Costing) marker: size breakdown, No. of Pcs, Layer (M) and CAD Average, at the lot's width.
   - If the lot's width differs from the planned marker, a warning says so. The sizes are copied, but **Layer (M)** and **CAD Average** are left empty — enter the layer length for the new width.
3. Check the row. Then open the row menu (three dots) > **Approve**.
4. Repeat for every lot in the box.

**Cutting needs an APPROVED Production CAD with a CAD Average.** A pending or rejected Production CAD does not count, and Push to Cutting / Create Batch will refuse until one is approved.

## Traps

- **Missing greige selection**: Each row must have a greige selected. Without it, CAD calculations cannot run.
- **Zero size breakdown**: If no sizes are entered, No. of Pcs = 0 and CAD Average cannot be calculated.
- **Wrong cutable width**: Using greige width instead of cutable width leads to wrong fabric consumption. Cutable width is typically 1-2 inches less than greige width due to selvedge.
- **Approving without Production CAD**: Costing CAD is sufficient for cost sheets, but cutting needs an APPROVED Production CAD made from the received lot.
- **"Cannot tell which fabric of … this lot belongs to"**: Create CAD could not match the lot to one of the style's fabrics (same greige and finish). Check the style's fabrics, then press **Create CAD** again. Nothing was created.
- **"This lot already has a Production CAD"**: each lot gets one. Find it in the Production section of the table.
- **"This Production CAD has no average yet"**: Approve is refused until the row has a Layer (M) and a Size Breakdown. Fill them in, save, then Approve.
- **A lot shows a red Rejected chip**: its Production CAD was rejected. Press **Create CAD** again to make a new one.
- **Deleting approved rows**: Approved CAD rows linked to fabric costing or orders cannot be deleted.
- **Combining different colours**: A White Poplin top and a Burgundy Poplin shirt are two different fabrics, even on the same greige — they cannot share one marker. Click **Add 2 … Rows** to plan them separately.

## After saving

- **CAD Average** is used by:
  - Cost sheets (fabric cost calculation)
  - MRP (raw material requirement planning)
  - Cutting charts (layer planning)

- **Next steps**:
  - Open **Fabric Costing** to add processing costs and approve rates
  - Create or update **Cost Sheet** with fabric costs
  - When orders are placed, Production CAD is used for cutting

## Row actions

Click the row menu (three dots) for:
- **Approve** - Approve this CAD entry (pending or rejected rows)
- **Reject** - Enter a **Rejection Reason** and confirm. The row becomes REJECTED and shows a red **Rejected** badge under its purpose; hover it to see who rejected it, when and why
- **Create Version** - New version of an approved entry
- **Copy to Raw Mat** (on Costing rows) / **Copy to Production** (on Raw Mat rows) - Copies the marker and size breakdown. The price is not copied to a Production row
- **Link to Stock** - Attach a received lot to a pending Production row
- **Edit** / **Delete** - Not available on approved rows

## Reject CAD plan

If the approved plan needs changes:

1. Click **Actions** dropdown > **Reject CAD Plan**.
2. Enter **Reason for rejection** * (required).
3. Click **Reject & Unlock**.
4. All rows reset to PENDING status, and you can edit again.
