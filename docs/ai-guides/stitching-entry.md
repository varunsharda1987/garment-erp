---
slug: stitching-entry
title: Record Stitching (Create Issue and Daily Output)
keywords:
  - stitching
  - stitching issue
  - stiching
  - daily output
  - tailor
  - contractor
  - silai kaise kare
  - silai entry
  - transfer slip
  - सिलाई
  - सिलाई इशू
  - दर्जी
  - आउटपुट
  - कटिंग से
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/StitchingList.tsx
  - frontend/src/pages/StitchingForm.tsx
  - frontend/src/pages/StitchingDetail.tsx
  - backend/src/schemas/production.schema.ts
  - backend/src/routes/stitching.routes.ts
  - backend/src/controllers/stitching.controller.ts
---

Stitching has two parts: first create a **stitching issue** from a cutting transfer slip, then record **daily output** on that issue.

## Before you start
- Cutting must be finished and a transfer slip generated from the cutting batch.
- Pending slips appear in the **Incoming from Cutting** tab. If that tab is empty, nothing can be issued yet.

## Create the stitching issue
1. Open **Manufacturing → Stitching** in the sidebar (under the **Production Stages** heading). The **Stitching Department** page opens.
2. Click **New Issue**. You can also open the **Incoming from Cutting** tab and click **Receive & Create Issue** on a slip, which pre-ticks it.
3. On the **New Stitching Issue** page, in **Source Selection**, tick one or more transfer slips. Use the work-order checkbox to tick all slips of that run at once.
4. In **Issue Details** fill **Issue Date** (required) and pick the **Stitching Contractor** (required). **Expected Completion** defaults to 7 days ahead and can be changed.
5. In **SKU Breakdown**, set **Issue Qty** for each colour and size. It is pre-filled with the full **Available** quantity.
6. Click **Create Stitching Issue**. The issue page opens.

## Record the work
7. Click **Receive from Cutting** (Step 1), then **Start Stitching** (Step 2).
8. Click **Record Output**. In the **Record Daily Output** dialog set **Output Date**, then enter **Good Qty** and **Defect Qty** per row and click **Save Output**. Repeat every day.
9. When everything is stitched, click **Complete**, then **Generate Transfer Slip** to send the pieces to finishing.

## Traps to avoid
- All selected slips must belong to the **same work order**. Ticking a slip from another run clears the earlier selection.
- **Issue Qty** cannot exceed the pieces on the selected slips, or the save is rejected.
- A slip already used by another stitching issue cannot be reused.
- **Complete** only appears after at least one daily output is recorded.
- **Good Qty** and **Defect Qty** are capped at the **Remaining** figure on that row.
- On the list, the row icons do the same steps quickly: Receive, Start, Complete, Issue to Finishing.
