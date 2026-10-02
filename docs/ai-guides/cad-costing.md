---
slug: cad-costing
title: Cost a CAD Plan (Fabric Costing)
keywords:
  # English
  - fabric costing
  - CAD costing
  - processing cost
  - fabric cost
  - greige cost
  - live rate
  - PO rate
  - greige rate from PO
  - manual greige rate reason
  - shrinkage
  - processor rate
  - cost per meter
  - landed price
  - build-up costing
  - transport cost
  - screen cost
  - no rate card
  - no processor rate
  - rate not found
  - print type
  - pigment
  - procian
  - discharge
  - why is the rate blank
  - costing not saving
  - production costing
  - production mode
  - production tab missing
  - price approval cleared
  - buyer style code
  - order quantity empty
  - order quantity from sale order
  - sale order quantity not showing
  - raw mat quantity
  # Hinglish
  - fabric costing karna
  - CAD ki costing
  - processing ka rate
  - greige ka rate
  - PO ka rate
  - naya PO rate
  - reason kyun dena hai
  - shrinkage kitna hai
  - meter ka cost
  - processor rate card
  - rate nahi mil raha
  - rate kyun nahi aa raha
  - rate card nahi hai
  - print type kya hai
  - costing save nahi ho rahi
  - production ki costing kaise kare
  - production tab kahan hai
  - buyer ka style code
  - order quantity nahi aa rahi
  - sale order ki quantity
  - raw mat me quantity khali hai
  # Devanagari (MANDATORY)
  - फैब्रिक कॉस्टिंग
  - कैड कॉस्टिंग
  - प्रोसेसिंग कॉस्ट
  - श्रिंकेज
  - ग्रेज रेट
  - पीओ रेट
  - लाइव रेट
  - कारण
  - प्रोसेसर रेट कार्ड
  - मीटर का रेट
  - ट्रांसपोर्ट कॉस्ट
  - लैंडेड प्राइस
  - रेट नहीं मिल रहा
  - रेट कार्ड नहीं है
  - प्रिंट टाइप
  - पिगमेंट
  - कॉस्टिंग सेव नहीं हो रही
  - प्रोडक्शन कॉस्टिंग
  - प्रोडक्शन मोड
  - बायर स्टाइल कोड
  - ऑर्डर क्वांटिटी
  - सेल ऑर्डर
  - सेल ऑर्डर की क्वांटिटी
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricCostingPage.tsx
  - frontend/src/components/ui/combobox.tsx
  - frontend/src/components/ui/multi-select.tsx
  - backend/src/services/helpers/cad-list-filter.helper.ts
  - frontend/src/utils/greigeRate.ts
  - frontend/src/pages/CADPlanningPage.tsx
  - frontend/src/components/cad/CADSpreadsheetTable.tsx
  - frontend/src/components/cad/CorrectCadDialog.tsx
  - frontend/src/pages/StyleFabricCostingOptionsPage.tsx
  - frontend/src/pages/ProcessorRateCardPage.tsx
route: /fabric-costing
---

## Before you start

- The style must have CAD data from **CAD Planning** (fabric consumption per piece). A Raw Mat row's Layer(M), width and sizes come from its marker image there (**CAD Image** column), or are typed by hand with a reason when there is no image to give
- If CAD is not done, go to **Pre-Production > CAD Planning** first
- CAD approval is NOT required for costing, but costing cannot be approved without CAD approval

## How to open Fabric Costing

**Option 1: From CAD Planning page**
1. Open the style in **Pre-Production > CAD Planning**
2. Click **Actions** dropdown (top right)
3. Select **View Fabric Costing** or **Push to Fabric Costing**
   - **Push to Fabric Costing** creates costing records for Costing and Raw Mat rows only. Production CAD rows (one per received lot) are skipped with the reason "Production CADs are lot markers — they are not costed".

**Option 2: Direct navigation**
1. Go to **Pre-Production > Fabric Costing**
2. Search for the style using the **Quick Search** box (type its buyer style code, style code or name)
3. Or select **Customer** first, then click **Style** and type part of the buyer style code, style code or name to pick it

## Steps

### 1. Select the style
- Use the **Quick Search** box ("Search by buyer style code, style code or name...") to find the style. Each result reads the **Buyer Style Code** first, with our Style Code in brackets when it differs, e.g. `SP27DR27 (EBWW-021)`
- Or pick **Customer** first, then click **Style** (**Select style**) and type part of the buyer style code, style code or name to pick it. It lists that customer's styles only
- Once picked, the box shows the style as `Buyer Style Code (Style Code) - Style Name`
- The **✕** in the Quick Search box clears the search and the picked customer and style

### 2. Choose the costing mode (tabs)
- **Costing** - For quotation pricing (default)
- **Raw Mat Calculation** - For MRP after order confirmation

There is no Production tab. A Production CAD is the marker for one received fabric lot: it is made and approved in **CAD Planning** and is never costed. Orders and production run on the approved **Raw Mat Calculation** costing.

### 3. Enter Order Quantity (pcs)
- This quantity is used for rate slab lookup
- If you change the quantity later, a NEW costing option is created (original preserved)
- A style costed before opens with its saved quantity
- **Raw Mat Calculation tab — quantity from sale orders:**
  1. Under **Order Quantity (pcs)**, the **Sale orders** box lists the style's open sale orders (any buyer; not cancelled, dispatched or delivered), each as `SO number · pieces · ship date`. A draft sale order shows **Draft**
  2. Every sale order except drafts is ticked. If the style has no saved Raw Mat quantity and you have not typed one, **Order Quantity** fills with the ticked orders' total pieces (all colours and sizes of this style)
  3. Click the **Sale orders** box and tick or untick an order to cost for a different set. **Order Quantity** changes to the new total
  4. If the box shows another number (a saved costing, or one you typed), a line **Sale orders: … pcs · Use** appears. Click **Use** to take the sale-order total
  5. **No open sale order for this style** means nothing to fill from. Type the quantity yourself
- Rows with no quantity of their own (the **Qty (pcs)** column empty) use **Order Quantity**; rows saved before keep their own quantity
- The **Costing** tab never fills from sale orders — type the quantity for a quotation

### 4. Cost each fabric row

Each row represents one fabric from CAD Planning. You have two costing modes:

**Mode toggle: B (Build-up) or L (Landed Price)**
- Switch using the toggle in the **Mode** column

#### Build-up Mode (B) - Component-wise costing

Fill in these fields:
1. **Greige** (per meter) - The raw greige fabric cost
   - Filled with the **live rate**: the newest greige PO or purchase for that greige (the label under the box says **from PO**, **from purchase** or **from stock**), else the Greige Master default
   - When the box differs from today's rate, a line under it reads **Use ₹… · PO…** (the live rate and the PO it came from). Click it, or the refresh icon, to take that rate
   - If you type a different rate, the box turns amber and a **Reason** box appears under it. Write why (for example "supplier quote for the new quality"). **Save Costing** is refused until a reason is filled in, and the rate is saved as **manual** with that reason
   
2. **Transport** (per meter) - Transport cost to bring greige
   - Default is usually set
   
3. **Processor** - Select the dyeing/printing mill
   - Choose from the dropdown
   - For DYEING: the rate is fetched automatically
   - For PRINTING: the rate is fetched automatically once **Print Type** is set. If it is
     not set yet, the page tells you to choose one and the Process cell reads "Print type?"

4. **Colors** (printing only) - Number of colors/screens

5. **Print Type** (printing only) - The printing method the rate card is priced by
   - Options: Pigment, Procian, Discharge, Pig+Dis
   - Rates are held separately per print type, so the rate cannot be found until this is set
   - Changing it clears the fetched rate and fetches again

6. **Screen** (printing only) - The screen type used
   - Options: Rotary, Flat Belt, Table
   - The screen cost per meter appears under the dropdown once colors are entered

7. Click the refresh icon next to the processor to fetch again at any time:
   - Processing cost per meter (from rate card)
   - Shrinkage percentage
   - Screen cost per screen (for printing)

#### Landed Price Mode (L) - Single price

- Enter the final landed price per metre directly in the **Landed ₹** box
- Use when you have an all-inclusive fabric price
- Processor and processing fields are disabled

### 5. Check the calculated values

- **Process** - Processing cost per meter from rate card
- **Shrink** - Shrinkage cost (greige adjusted for shrinkage)
- **Screen** - Screen cost amortized per meter (printing only)
- **Total** - Final cost per meter
- **Part Cost** - Total per meter multiplied by CAD consumption
- **Fabric Req** - Finished fabric required (CAD per meter)
- **Greige Req** - Greige required (adjusted for shrinkage)

### 6. Save the costing
- Click **Save Costing** button
- After saving, optionally create a **Costing Run** (groups related options and keeps its own copy of the figures). Click a run card under **Existing Costing Runs** to see how each fabric was costed when that run was saved

## Understanding the costs

### Total Cost Formula (Build-up mode)
```
Total per meter = Greige + Transport + Shrinkage Cost + Processing + Screen
```

### Shrinkage calculation
- If shrinkage is 10%, you need more greige to get the same finished fabric
- Shrinkage cost = Greige price adjusted for the shrinkage percentage
- Example: with 10% shrinkage, one finished metre needs 1 ÷ 0.9 = about 1.11 metres of greige, so the greige cost per finished metre is about 11% higher

### Batch rate advantage
- Fabrics with the same greige + processor + color are batched together
- Combined quantity gets a better rate slab
- You see "batch" label and savings per meter shown

## Traps to avoid

- **No CAD data**: If you see "No CAD Data Found" warning, go to CAD Planning first
- **Missing greige rate**: Enter a rate or set it on the Greige Master
- **"Enter a reason for the greige rate typed on …"**: you typed a greige rate different from the live one. Fill the **Reason** box under it, or click **Use ₹…** to take the live rate
- **The PO you expected is not the live rate**: the live rate is read for the exact greige on the row. A PO raised on a different greige master (even with the same generic name) does not count — check the greige in CAD Planning
- **"Processing rate looked up again for … row"**: the fabric (greige) on those rows was changed in CAD Planning after they were costed, so the page read the processor's rate for the new greige. Check the **Process** rate, then click **Save Costing**. If it says **No processor rate for this combination**, add the new greige for that processor on the **Processor Rate Card** page first
- **"… the processing rate is <processor>'s rate for GRG-…, but this fabric is now GRG-…"**: the save was refused because the rate came from another greige. Select the processor again on that row to take its rate for the new greige
- **No processor rate**: If the processor has no rate for this combination, a warning panel
  appears above the table naming the exact reason - for example that the processor has no
  quantity slabs set, does not rate this greige, or does not rate this print type. The
  affected rows show a red "no rate card" marker in the Process column, and the reason stays
  on screen until it is fixed. Click **Go to Rate Cards** in the panel: the Rate Card page
  opens with that processor, process type and print type already selected.
- **Rows with no processor rate are not saved**: Save skips them and names them, because the
  total would otherwise be greige + transport only and would understate the fabric cost in
  the cost sheet and MRP. Add the missing rate, fetch it again, then save.
- **Quantity matters**: Rate slabs depend on quantity - higher quantity = better rate. A new quantity makes a new costing option; it keeps the CAD row's sizes and marker image
- **Approved rows**: You cannot modify a row with approved costing - unapprove first on the Options page
- **The CAD itself is wrong (layer, sizes, greige or width) and a cost sheet or order already uses it**: do not re-cost here. In **CAD Planning**, open the row menu (three dots) > **Correct…**. It works out the new price per metre for you and carries the change to the cost sheets, order BOMs and requirements (see the guide "Correct an approved CAD")
- **Price approval disappeared**: rejecting the CAD in CAD Planning (row **Reject** or **Reject CAD Plan**) clears the fabric price approval of those rows. The cost figures stay; approve the option again on the Costing Options page after the CAD is re-approved. A **Correct…** that is applied straight away (nothing approved uses the CAD) also clears it when the price per metre changes. When the correction goes to an admin, approving the new cost sheet version gives the price approval back by itself
- **Reject is refused**: once an approved cost sheet or an order's BOM is built on a CAD row, CAD Planning will not reject it — use **Correct…** instead
- **"... is a Production CAD — the marker for a received fabric lot"**: Save refuses a Production CAD row and saves nothing. Cost the style on the **Costing** or **Raw Mat Calculation** tab instead; the Production CAD itself is approved in CAD Planning.

## After saving

1. **View Saved Options** - Opens the costing options page for this style
2. **View All Options** button - See all costing options across styles
3. **Create Cost Sheet** - Use the costing in the cost sheet (Pre-Production > Cost Sheets)
4. To approve a costing option, go to **Pre-Production > Costing Options**

## Related pages

- **CAD Planning** - Where fabric consumption is calculated
- **Costing Options** - View/approve all costing options
- **Cost Sheets** - Full garment costing using fabric costings
- **Processor Rate Cards** - Manage processor rates (Materials & Masters)
