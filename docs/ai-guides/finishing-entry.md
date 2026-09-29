---
slug: finishing-entry
title: Record Finishing (Issue, Output, Packing)
keywords:
  - finishing
  - finishing issue
  - packing
  - polybag
  - carton
  - QC
  - finishing kaise kare
  - packing entry
  - finshing
  - फिनिशिंग
  - पैकिंग
  - पॉलीबैग
  - कार्टन
  - सिलाई से
  - color required
  - colour required
  - color row 1 required
  - primary color
  - packing save nahi ho raha
  - rang zaroori hai
  - रंग
  - रंग ज़रूरी
  - प्राइमरी कलर
  - पैकिंग सेव नहीं हो रही
  - no colour
  - style has no colour
  - colour optional
  - color unknown
  - bina colour ke packing
  - colour nahi hai
  - बिना रंग
  - रंग नहीं है
  - रंग वैकल्पिक
  - तैयार माल स्टॉक
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/FinishingList.tsx
  - frontend/src/pages/FinishingForm.tsx
  - frontend/src/pages/FinishingDetail.tsx
  - backend/src/schemas/production.schema.ts
  - backend/src/routes/finishing.routes.ts
  - backend/src/controllers/finishing.controller.ts
route: /manufacturing/finishing
---

Finishing starts from a stitching transfer slip, then moves through output, packing and completion.

## Before you start
- A stitching issue must be **Completed** and its transfer slip generated. Those slips show in the **Incoming from Stitching** tab.

## Create the finishing issue
1. Open **Manufacturing → Finishing** in the sidebar (under the **Production Stages** heading).
2. Click **New Issue**. You can also use **Receive & Create Issue** on a slip in the **Incoming from Stitching** tab.
3. On the **New Finishing Issue** page, pick **Transfer Slip from Stitching** (required). Each slip reads slip number - work order - style, the style named by its Buyer Style Code first with our Style Code in brackets when different (e.g. SP27DR27 (EBWW-021)). Only one slip per issue is allowed here.
4. Fill **Issue Date** (required) and pick the **Finishing Contractor** (required). **Expected Completion** defaults to 5 days ahead.
5. In **SKU Breakdown**, set **Issue Qty** per colour and size. It is pre-filled with the full **Available** quantity.
6. Click **Create Finishing Issue**.

## Find an existing issue
- On **Manufacturing → Finishing**, type in the **Search issue number, run number, buyer style code, style, contractor…** box.
- The issues table shows a **Buyer Style Code** column (bold, style name under it) followed by a **Style Code** column (our code). The issue page shows **Buyer Style Code**, **Style Code** and **Style Name** as separate lines.

## Run the finishing work
7. On the issue page click **Receive from Stitching**, then **Start Finishing**.
8. Click **Record Output**. In the **Record Daily Output** dialog set **Output Date**, enter **Finished** and **Defect** per row, then click **Save Output**. Repeat daily.
9. Click **Move to Packing** when finishing work is done.
10. In packing, use **Polybag Entry** (set **Packing Date** and **Packed** per row, then **Save Polybag Entry**) and **Carton Packing** (**Carton Number** and **Carton Date** are required, then **Save Carton**).
11. Click **Complete**, then **Generate Transfer Slip** to hand the goods to dispatch. This also adds the finished pieces to **Inventory → FG Stock**, per size (and colour, when the style has one) — delivery notes ship from that stock.

## Traps to avoid
- The status order is fixed: Pending Receipt → Received → In Progress → Packing → Completed. **Complete** only appears in the Packing stage.
- **Finished** and **Defect** are capped at the **Remaining** figure on that row, and at least one row must be filled.
- **Packed** quantity in Polybag Entry and **Quantity** in Carton Packing must be more than zero on at least one row.
- If the slip has no size breakdown, the form shows a single "All Colors / All Sizes" row — check it before saving.
- A colour is not needed. For a style with no colour, **Record Output**, **Polybag Entry**, **Carton Packing** and **Generate Transfer Slip** all work with no colour on the rows — the **Color** column reads **Unknown** in the output, polybag and carton dialogs and **-** in **SKU Breakdown**. Enter the quantities and save as usual; the finished goods go into FG Stock with no colour. You do not have to set a colour on the style first.
- A transfer slip can be generated only once per finishing issue.
- Use the **Size-wise Status** tab to see pending, running and done pieces per size, plus idle-day warnings.
