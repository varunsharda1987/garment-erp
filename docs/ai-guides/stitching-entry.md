---
slug: stitching-entry
title: Record Stitching (Create Issue and Daily Output)
keywords:
  - change contractor
  - contractor badalna
  - ठेकेदार बदलें
  - delete stitching issue
  - issue delete karna
  - edit stitching issue
  - all defect
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
  - color required
  - colour required
  - color row 1 required
  - primary color
  - output save nahi ho raha
  - rang zaroori hai
  - रंग
  - रंग ज़रूरी
  - प्राइमरी कलर
  - आउटपुट सेव नहीं हो रहा
  - no colour
  - style has no colour
  - colour optional
  - color unknown
  - bina colour ke silai
  - colour nahi hai
  - बिना रंग
  - रंग नहीं है
  - रंग वैकल्पिक
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
  - remaining pieces
  - left to issue
  - partial issue
  - baaki pieces
  - baki maal
  - kuch size dena
  - बाकी पीस
  - बचा हुआ माल
  - complete short
  - short complete
  - adhura complete
  - अधूरा
  - size wise status
  - साइज़ वाइज़
sources:
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/production/EditStitchingIssueDialog.tsx
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/StitchingList.tsx
  - frontend/src/pages/StitchingForm.tsx
  - frontend/src/pages/StitchingDetail.tsx
  - backend/src/schemas/production.schema.ts
  - backend/src/routes/stitching.routes.ts
  - backend/src/controllers/stitching.controller.ts
  - backend/src/services/helpers/stitching-slip-balance.helper.ts
  - frontend/src/components/production/CompleteStitchingDialog.tsx
route: /manufacturing/stitching
---

Stitching has two parts: first create a **stitching issue** from a cutting transfer slip, then record **daily output** on that issue.

## Before you start
- Cutting must be finished and a transfer slip generated from the cutting batch.
- Pending slips appear in the **Incoming from Cutting** tab; the number on the tab shows how many are waiting. If that tab is empty, nothing can be issued yet.
- A slip shows only the pieces **left to issue**. A slip that was partly issued reads **N of M pcs left** and lists only the sizes still waiting, under **Left to Issue**.

## Create the stitching issue
1. Open **Manufacturing → Stitching** in the sidebar (under the **Production Stages** heading). The **Stitching Department** page opens.
2. Click **New Issue**. You can also open the **Incoming from Cutting** tab and click **Receive & Create Issue** on a slip, which pre-ticks it.
3. On the **New Stitching Issue** page, in **Source Selection**, tick one or more transfer slips. Each slip shows its number, the style by buyer style code first (our Style Code in brackets when it differs), the style name and its pieces (**N of M pcs left** when partly issued). Use the work-order checkbox to tick all slips of that run at once.
4. In **Issue Details** fill **Issue Date** (required) and pick the **Stitching Contractor** (required) — click the box and type part of the contractor's name or code; only stitching contractors are listed. **Expected Completion** defaults to 7 days ahead and can be changed.
5. In **SKU Breakdown**, set **Issue Qty** for each colour and size. It is pre-filled with everything in **Left to Issue** (a size already partly issued also shows **of N sent**).
6. To give only some sizes (or part of a size) to this contractor, lower **Issue Qty** or set it to 0. The note under the table says how many pieces stay on the slip; they stay under **Incoming from Cutting** for the next issue.
7. Click **Create Stitching Issue**. The issue page opens.

## Find an issue later
On the **Stitching Issues** tab, the filter row has a search box (**Search issue number, run number, buyer style code, style…** — the contractor's name finds its issues too), **All statuses**, and **All production runs** (type a run number, buyer style code, style code or order to pick one). **Clear N filters** removes them all. Each issue shows the **Work Order**, the **Buyer Style Code** (the style name under it), our **Style Code**, the **Contractor**, and **Days** (a running issue reads **N running**). Picking a production run also narrows the cards at the top to that run. The issue page lists **Buyer Style Code**, **Style Code** and **Style Name** separately.

## Record the work
8. Click **Receive from Cutting** (Step 1), then **Start Stitching** (Step 2).
9. Click **Record Output**. In the **Record Daily Output** dialog set **Output Date** (required), then enter **Good Qty** and **Defect Qty** per row and click **Save Output**. Repeat every day.
10. When everything is stitched, click **Complete**. A **Complete** box shows **Issued**, **Good**, **Defect** and **Not recorded**. Click **Complete** to finish.
11. Click **Generate Transfer Slip** to send the good pieces to finishing. The page then shows **Go to Finishing**, which opens a new finishing issue for that slip.

## See where each size stands
Open the **Size-wise Status** tab. Each production run shows, per size: **Waiting** (cut, still on slips from cutting), **Issued**, **With Contractor** (issued and not yet recorded), **Stitched** (good pieces) and **Defects**. A run leaves this tab once all of it is stitched and sent to finishing. An **Idle** badge counts the days a completed issue has waited for its transfer slip.

## Traps to avoid
- All selected slips must belong to the **same work order**. Ticking a slip from another run clears the earlier selection.
- **Issue Qty** cannot exceed what is **Left to Issue** on the selected slips, or the save is rejected with the size named.
- A slip whose pieces have all been issued leaves the **Incoming from Cutting** tab and cannot be picked again.
- **Good Qty** and **Defect Qty** together cannot go above the **Remaining** figure on that row. A defect counts as a recorded piece.
- **Complete** only appears after some output is recorded (good or defect). If every piece came out defective the issue can still be completed; the page then says **No good pieces to send** — there is nothing to transfer to finishing. If some pieces were never recorded, the box asks for a **Reason for completing short** and the button reads **Complete Short**. Those pieces do not go to finishing, and the reason is kept in the issue's **Remarks**. Record the missing output first if you can.
- A colour is not needed. A style with no colour is received, stitched, recorded and transferred with no colour on its rows — the **Color** column reads **Unknown** in the **Record Daily Output** dialog and **-** in **SKU Breakdown**. Just enter the quantities and click **Save Output**; you do not have to set a colour on the style first.
- Completed too early? **Reopen** (shown on a Completed issue until its transfer slip is generated) puts it back to In Progress so you can record more output.
- Wrong contractor or date? Click **Edit** at the top of the issue page (any issue not yet Completed) to change **Issue Date**, **Stitching Contractor**, **Expected Completion** (clear it to leave it blank) or **Remarks**, then **Save**.
- Made the issue by mistake? While it is still **Pending Receipt**, click **Delete** at the top of the issue page and confirm. Its pieces go back to their cutting slips under **Incoming from Cutting**, to issue again.
- On the list, the row icons do the same steps quickly: Receive, Start, Complete (after output is recorded) and Issue to Finishing. Once an issue's transfer slip exists, the row shows the slip number instead of the Issue to Finishing icon.
