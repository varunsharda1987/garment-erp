---
slug: cost-sheet-create
title: Create a Cost Sheet for a Style
keywords:
  - cost sheet
  - costsheet
  - kost sheet
  - costing
  - style costing
  - CMT
  - CAD approved
  - costing run
  - costing run chip
  - apply costing run
  - कॉस्टिंग रन
  - cost sheet kaise banaye
  - cost sheet banana
  - costing banana
  - लागत
  - कॉस्ट शीट
  - कॉस्टिंग
  - स्टाइल
  - कपड़ा
  - सिलाई
  - मंजूरी
  - lace
  - lace details
  - lace costing
  - लेस
  - greige lace
  - dyed variant
  - dye lace
  - undyed lace
  - lace dyeing
  - lace rangai
  - कच्ची लेस
  - रंगी लेस
  - लेस रंगाई
  - budget tracking
  - fetch budgets
  - बजट
  - download cost sheet
  - cost sheet download
  - cost sheet download kaise kare
  - cost sheet pdf
  - cost sheet excel
  - export cost sheet
  - print cost sheet
  - cost sheet print
  - कॉस्ट शीट डाउनलोड
  - डाउनलोड
  - पीडीएफ
  - एक्सेल
  - प्रिंट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/CostSheetList.tsx
  - frontend/src/pages/CostSheetForm.tsx
  - frontend/src/pages/CostSheetDetail.tsx
  - frontend/src/components/cost-sheet/LaceCostingSection.tsx
  - frontend/src/components/cost-sheet/LaceSourcingStrategySelector.tsx
  - frontend/src/components/cost-sheet/LaceCostingRow.tsx
  - backend/src/controllers/style-costing-calc.controller.ts
  - backend/src/controllers/style-costing.utils.ts
  - backend/src/schemas/styleCosting.schema.ts
  - backend/src/controllers/lace.controller.ts
  - backend/src/services/laceCostingCalculation.service.ts
route: /cost-sheets/new
---

## Before you start

The style must exist and its fabrics must be costed: the CAD approved in **CAD Planning** (quantity) AND the costing approved with a real price on the **Fabric Costing Options** page. A row that is only CAD-approved but has no saved costing contributes no rate — save and approve its costing first.

## Steps

1. Open **Pre-Production → Cost Sheets** in the sidebar.
2. Click **+ New Cost Sheet**. The page **Create Cost Sheet** opens.
3. In **Search Style**, type the style code and pick the style. It is required. You can also type the style name, the customer, or the buyer's own style code, and several words together narrow it — "kasya LNG229" finds that one style. **Customer** fills itself and stays read-only.
4. Picking the style fills the form by itself — fabrics come from the approved fabric costings, and trims, lace, embroidery and accessories come from the style's BOM. There is no button to press for this. Nothing is saved yet.
5. Choose **Fabric Costing Mode**: **Costing (Buyer Quotation)**, **Raw Material Calculation** or **Production**. Only approved costing options from that mode are used for fabric rates, and changing the mode refills the fabric rows. The system remembers your last choice.
6. If **Costing Run** chips appear and you want that specific run's fabrics instead, just click the chip — it loads straight away and the chip shows **✓ fabric rows loaded from this run**. A green tick on the chip means all its costs are complete; a warning sign means some are missing. Clicking a different chip switches to that run. This replaces the fabric rows only; trims, lace, embroidery and accessories are untouched.
7. In **Raw Material Calculation** or **Production** mode an **Enable Budget Tracking for Procurement** box appears. Leave it unticked for a normal cost sheet. Tick it only when you want budget-versus-actual variance tracked during procurement: then set **Budget Source** to **Manual Entry** and type each category budget, or to **Auto-Calculate from Style Data** and click **Fetch Budgets** to fill them from the style.
8. **Number of Components**, **Category** and **Sub Category** are optional. Category is normally already filled from the style.
9. Review the **Fabric Details** table. A fabric costed at more than one width appears as **one row per width** — both belong in the sheet, so do not delete one as a duplicate. Every row needs a name, a CAD average and a rate, or it must be marked **N/A**. Use **Add Fabric** to add a row by hand.
10. If the style's BOM has lace, a **Lace Details** section appears with those laces pre-filled. For each row set **Qty/Garment**; **Wastage** is pre-filled from the system default — change it only if this style differs. Then click **Choose Sourcing** and pick one of three tabs: **Stock Reuse** (use existing inventory), **Ready Lace** (purchase finished lace, the default) or **Greige + Dyeing** (buy raw lace and dye it). Confirm the tab with its button — **Select Stock Reuse**, **Select Ready Lace** or **Select Greige + Dyeing**. To add another lace, pick it in **Select lace to add...** and click **Add Lace**. That list includes greige laces, marked **— Greige**, so a greige can be used undyed. A lace that does not apply gets its **N/A** box ticked.
11. **If the Ready Lace tab says no price is set**, type the rate in **Ready Lace Price (₹/m)** and give a **Reason for Custom Price**, then click **Use Custom Price**. Setting **Price per Meter** on the lace master avoids this step next time.
12. **To dye a greige lace**, open **Choose Sourcing** on that row and go to the **Greige + Dyeing** tab. Pick the colour in **Dye to Colour** and, if you want a specific dyer, choose them in **Processor (optional)** — leave it empty to use the cheapest rate. Click **Create Dyed Variant & Cost**. A finished lace for that colour is created (or reused if it already exists) and the row is costed as Greige + Dyeing against it. The greige itself stays available for styles that use it undyed. If the system's greige rate is wrong for this job, tick **Manually override greige cost**, type **Greige Cost per Meter (₹)** and a **Justification for Override**; the confirm button then reads **Select Greige + Dyeing (Manual Override)**.
13. Review **Trims Details** (use **Add Trim** to add a row), **Embroidery Details** and **Accessories Details** the same way.
14. Fill the **CMT Costs**: **Cutting**, **Stitching**, **Finishing**, **Button Attachment**, **Handwork** and **Smocking**. These are never auto-filled from CAD.
15. Under **Value Loss & Markup**, set **Value Loss (%)** and **Markup (%)**. Both must be between 0 and 100.
16. Optionally, under **Closed Cost (Final Agreed Price)**, enter the **Closed Cost per Piece (₹)** agreed with the customer and **Notes (Optional)**. The form then shows how far the closed cost sits above or below the calculated cost, and a comparison card shows Calculated Cost, Closed Cost and Variance.
17. Click **Create Cost Sheet** to save. Only now does the sheet exist. When editing an existing sheet the same button reads **Update Cost Sheet**.
18. Back on the **Cost Sheets** list, use the row actions: **Approve** or **Reject** a pending sheet (rejection notes are compulsory). An approved sheet offers **New Version** instead of Edit.
19. To share or print a saved sheet, open it from the list and click **Download**, then **Download PDF** (opens in a new browser tab) or **Download Excel** (saves an .xlsx file). The **Download** button is on both the **Cost Sheet Details** page and the **Edit Cost Sheet** page.

## Traps

- Filling the form is not saving. If you leave the page before clicking **Create Cost Sheet**, everything is lost.
- The save is rejected unless there is **at least one fabric row and at least one trim row**.
- Any row with a zero rate or zero quantity blocks the save with a toast ("Enter values or mark as N/A to save"). This applies to fabric, trim, lace, embroidery and accessory rows alike. Either type real values or tick **N/A** on that row. A lace row needs both a **Qty/Garment** and a cost above zero.
- A fabric row with a blank name blocks the save. Re-select the style or type the name.
- If a warning banner shows the CAD is not approved, use **Go to CAD Planning** on that banner and finish CAD first.
- If a fabric row has no rate, open **Fabric Costing Options** for the style, approve the costing there, then re-pick the style (or switch mode and back) to refill.
- Components with CAD data but **no saved costing** produce no fabric row. Save a fabric costing for them first if they belong in the sheet.
- If a fabric option was **costed more than once**, the most recent costing is the one used. Check the style's Fabric Costing Options if a rate looks unfamiliar.
- An approved cost sheet is read-only. Opening its edit link shows "Approved cost sheets cannot be edited. Create a new version instead." and sends you to the details page. Create a new version from the list; a version reason is compulsory.
- **Reload from Style** refreshes fabric and trim rows from the style. It overwrites what you typed in those tables.
- If the style already has a cost sheet, check the list before making a duplicate.
- **Enable Budget Tracking for Procurement** only appears in **Raw Material Calculation** and **Production** modes, and every budget must be zero or more.
- **Download** exports what is saved. Unsaved edits on the form are not in the PDF or Excel — click **Update Cost Sheet** first.
- Trim items can carry only one master link at a time. If you see an error about multiple FK fields, only one of the master IDs should be set.
- A dyed lace is a **separate lace** from the greige it came from — that is what keeps dyed and undyed stock apart. Only one dyed lace can exist per greige and colour; asking for the same pair again reuses the existing one instead of creating a second.
- **Greige + Dyeing needs a processor rate card** for that lace, including its shrinkage %. Without one the tab says it cannot be costed — set the rate card up first.
- A lab dip only counts for the colour it was approved for. A colour with no approved dip is still costed, but its lab-dip approval stays pending and the processing PO is blocked until it is approved.
