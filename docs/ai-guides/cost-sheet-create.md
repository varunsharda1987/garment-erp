---
slug: cost-sheet-create
title: Create a Cost Sheet for a Style
keywords:
  - cost sheet
  - costing
  - style costing
  - CMT
  - CAD approved
  - auto generate from cad
  - cost sheet kaise banaye
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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/App.tsx
  - frontend/src/pages/CostSheetList.tsx
  - frontend/src/pages/CostSheetForm.tsx
  - frontend/src/components/cost-sheet/LaceCostingSection.tsx
  - backend/src/controllers/style-costing-calc.controller.ts
  - backend/src/controllers/style-costing.utils.ts
  - backend/src/schemas/styleCosting.schema.ts
---

## Before you start

The style must exist, and **Auto-Generate from CAD** needs a fabric row with **both approvals**: the CAD approved in **CAD Planning** (quantity) AND the costing approved with a real price on the **Fabric Costing Options** page. This works through either mode: a fully-approved **Costing** row, or a fully-approved **Raw Material** row with fabric costing completed. A row that is only CAD-approved but has no saved costing does not count — save and approve its costing first. There is no shortcut around this: a style whose CAD was approved as a whole but has no fully-approved priced row is still refused. Rows without a costing are left out of the preview (a warning lists the skipped components).

## Steps

1. Open **Pre-Production → Cost Sheets** in the sidebar.
2. Click **+ New Cost Sheet**. The page **Create Cost Sheet** opens.
3. In **Search Style**, type the style code and pick the style. It is required. **Customer** fills itself and stays read-only.
4. Choose **Fabric Costing Mode**: **Costing (Buyer Quotation)**, **Raw Material Calculation** or **Production**. Only approved costing options from that mode are used for fabric rates.
5. If **Costing Run** chips appear, click one to use those fabrics. A green tick means all costs are complete; a warning sign means some are missing.
6. Click **Auto-Generate from CAD**. This only **previews** numbers into the form. Nothing is saved yet.
7. Check the message. It says the preview is generated and that you must review it and fill in CMT costs, then save.
8. Review the **Fabric Details** table. Every row needs a name, a CAD average and a rate, or it must be marked **N/A**.
9. If the style's BOM has lace, a **Lace Details** section appears with those laces pre-filled. For each row set **Qty/Garment** and **Wastage**, then pick the **Sourcing**: **Stock Reuse** (use existing inventory), **Ready Lace** (purchase finished lace, the default) or **Greige + Dyeing** (buy raw lace and process). To add another lace, pick it in **Select lace to add...** and click **Add Lace**. A lace that does not apply gets its **N/A** box ticked.
10. Review **Trims Details**, **Embroidery Details** and **Accessories Details** the same way.
11. Fill the **CMT Costs**: **Cutting**, **Stitching**, **Finishing**, **Button Attachment**, **Handwork** and **Smocking**. These are never auto-filled from CAD.
12. Set **Value Loss & Markup** percentages. Both must be between 0 and 100.
13. Optionally enter the **Closed Cost** agreed with the customer and its **Notes**. A comparison card then shows Calculated Cost, Closed Cost and Variance.
14. Click **Create Cost Sheet** to save. Only now does the sheet exist.
15. Back on the **Cost Sheets** list, use the row actions to send the sheet for approval or to approve or reject it.

## Traps

- Generating is not saving. If you leave the page after **Auto-Generate from CAD**, everything is lost.
- The save is rejected unless there is **at least one fabric row and at least one trim row**.
- Any row with a zero rate or zero quantity blocks the save with a toast. This applies to fabric, trim, lace, embroidery and accessory rows alike. Either type real values or tick **N/A** on that row. A lace row needs both a **Qty/Garment** and a cost above zero.
- A fabric row with a blank name blocks the save. Re-select the style or type the name.
- If a warning banner shows the CAD is not approved, use **Go to CAD Planning** on that banner and finish CAD first.
- If the error says the row needs to be **costing-approved with a price**, open **Fabric Costing Options** for the style, approve the costing there, then generate again.
- Components with CAD data but **no saved costing** are skipped from the preview and listed in a warning — they no longer appear as ₹0 fabric lines. Save a fabric costing for them first if they belong in the sheet.
- An approved cost sheet is read-only. To change it, create a new version from the list; a version reason is compulsory.
- **Reload from Style** refreshes fabric and trim rows from the style. It overwrites what you typed in those tables.
- If the style already has a cost sheet, the preview still runs but warns you. Check the list before making a duplicate.
