---
slug: cad-approve
title: Approve a CAD Plan
keywords:
  # English
  - approve CAD
  - CAD approval
  - marker approval
  - confirm CAD
  - lock CAD
  - CAD plan approval
  - approve fabric planning
  - approve production CAD
  - production CAD approval
  - reject CAD plan
  - CAD in use
  - cannot reject CAD
  - CAD cannot be rejected
  - correct instead
  - unlock approved CAD
  - change approved CAD
  - CAD history
  - who changed the CAD
  - who approved the CAD
  - aprove CAD
  - rejct CAD
  - approve refused CAD image
  - needs image
  - differs from the CAD image
  - cannot approve CAD
  - enter values by hand
  - own values without image
  - image not readable
  - no marker image
  - 3XL XXXL
  - 2XL XXL
  # Hinglish
  - CAD approve karna
  - marker approve
  - CAD confirm karna
  - CAD lock karna
  - CAD plan approve
  - production CAD approve karna
  - CAD reject karna
  - CAD reject nahi ho raha
  - approved CAD badalna
  - CAD kisne badla
  - CAD ki history
  - CAD approve nahi ho raha
  - CAD image lagana padega
  - marker lot se chauda hai
  - wider than lot
  - will not fit
  - apni values dalni hai
  - image nahi padh raha
  - CAD image nahi hai
  - haath se values
  # Devanagari
  - कैड अप्रूव
  - मार्कर अप्रूवल
  - कैड कन्फर्म
  - कैड प्लान अप्रूव करना
  - कैड लॉक करना
  - प्रोडक्शन कैड अप्रूव
  - कैड रिजेक्ट
  - कैड रिजेक्ट नहीं हो रहा
  - कैड सुधारना
  - कैड हिस्ट्री
  - कैड किसने बदला
  - कैड इमेज
  - कैड अप्रूव नहीं हो रहा
  - मार्कर लॉट से चौड़ा
  - अपनी वैल्यू डालना
  - इमेज नहीं पढ़ रहा
  - कैड इमेज नहीं है
sources:
  - backend/src/services/style.service.ts
  - backend/src/services/helpers/cad-marker.helper.ts
  - frontend/src/utils/sku-generator.ts
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CADPlanningPage.tsx
  - frontend/src/components/cad/CADSpreadsheetTable.tsx
  - frontend/src/components/cad/CadInUseNotice.tsx
  - frontend/src/components/cad/CadHistoryDialog.tsx
  - frontend/src/components/cad/CorrectCadDialog.tsx
  - frontend/src/components/cad/MarkerImageDialog.tsx
  - backend/src/services/helpers/lot-width.helper.ts
  - backend/src/controllers/cad-approval.controller.ts
route: /cad-planning
---

## Before you start

The CAD plan must be complete before you can approve it:

1. **All rows must have a Part assigned** - Each CAD row needs a pattern part selected
2. **All rows must have CAD values** - The CAD Average (m/pc) must be calculated and greater than zero
3. **All fabric groups must be covered** - Every style fabric must have at least one CAD row with values
4. **Every Raw Mat and Production row must have its marker image** - The **CAD Image** column must not say **Needs image** or **Not used yet** (a row with its image but no values — open the image, click **Use these values**, save), and a row that differs from its image (**Differs** / **Not checked**) must first be saved with a reason. When there is no marker image to give (a hand-laid marker, or the image cannot be read), edit the row, type your own values and save them with a reason — the row can then be approved. Costing rows need no image (when they have one, it is checked the same way). See the guide "Create a CAD Plan (Marker)" for attaching the image
5. **A Production CAD must fit its lot** - its **Width** may be narrower than the lot's cutable width, never wider. The line under **Width** shows **Lot 53" · 1" spare**, or **Wider than lot** in red

If any of these are missing, you will see an error when trying to approve.

## Steps

1. Open **Pre-Production > CAD Planning** in the sidebar.

2. Find the style whose CAD plan you want to approve and click on it to open the CAD Planning page.

3. Review the **CAD Spreadsheet** tab to ensure:
   - Every Costing and Raw Mat row has a **Part** selected in the Part column (an old "All Parts" row counts)
   - Every Costing and Raw Mat row shows a **CAD Average** value (not blank or zero)
   - The plan is the **Costing and Raw Mat rows**. Production rows and rejected rows are not part of it — approve each of those with **Approve** in its own row menu
   - The status banner shows "All CAD entries complete. Ready to approve!"

4. Click the **Actions** dropdown button in the top-right area of the status banner.

5. Select **Approve CAD Plan** from the dropdown menu (shown in green text).

6. A confirmation dialog appears titled "Approve CAD Plan?" with the message:
   > Once approved, the CAD plan will be locked and you can generate the cost sheet. You won't be able to change fabric widths or values after approval.

7. Click **Approve & Lock** to confirm the approval.

8. You will see a success message: "CAD plan approved! You can now generate cost sheet."

9. The page navigates back to the CAD Planning list, where the style now shows status **APPROVED**.

## What approval means

When you approve a CAD plan:

- **Every Costing and Raw Mat row is approved** (not rejected ones) — each fabric is then linked to its Raw Mat row, or its Costing row when it has no Raw Mat row
- **The CAD plan is locked** - You cannot edit fabric widths, greige selections, size breakdowns, or CAD values
- **Status changes to APPROVED** - The style badge shows a green checkmark with "APPROVED"
- **Cost sheet generation is enabled** - You can now create or generate the style's cost sheet
- **Fabric costing can begin** - The "Push to Fabric Costing" action becomes available

## Traps

- **Cannot edit after approval** - Once approved, you cannot change any CAD values (the Size Breakup button is greyed out too). To fix an approved Costing or Raw Mat row, use row menu (three dots) > **Correct…** (see the guide "Correct an approved CAD"). While nothing uses the CAD, you can also Reject it, edit it and approve it again
- **Reject requires a reason** - To undo an approval, you must provide a rejection reason
- **"CAD Plan Approved" means every Costing and Raw Mat row is approved** - The card under the header says **CAD Plan Approved** only then. When a new row (a width variant) is added to an approved plan, the card offers **Approve CAD Plan** again, and the **Actions** menu still has **Push to Fabric Costing** and **Reject CAD Plan**. Approving the plan again approves only the new rows — rows approved earlier are left as they are. An approved Production CAD on its own does not make the plan approved: **Reject CAD Plan** is then refused with "The CAD plan is not approved — no Costing or Raw Mat row is approved"
- **A costing clone stays pending** - A Costing row copied in Fabric Costing for another processor or quantity (same part, fabric, width) is a costing option of geometry already approved: Approve CAD Plan leaves it pending and does not count it
- **One Production CAD per lot** - Approving a Production CAD is refused while its lot has another Production CAD that is pending or approved: "This lot already has another Production CAD … reject or delete that one first"
- **Reject is refused when the CAD is in use** - If an approved cost sheet or an order's BOM is built on the CAD, Reject stops with a yellow box **This CAD is already in use — it cannot be rejected**. It lists the cost sheets and orders. There is no way to reject past it. Use **Correct…** instead: it carries the change to those cost sheets, order BOMs and requirements
- **Rejection resets the planning rows** - Rejecting an approved CAD plan resets the Costing and Raw Mat rows to PENDING and unlocks them for editing. Production CADs stay approved, because cutting uses them
- **Rejection clears the fabric price approval** - The fabric costing figures are kept, but their approval is removed and must be done again on the Costing Options page
- **Every change is recorded** - Row menu (three dots) > **History** shows who created, edited, approved, rejected or corrected the row, what changed (old → new) and why
- **The green APPROVED badge is not the Production CAD** - The badge in the header is the style's CAD status, as the CAD Planning list files it: it shows once any CAD row is approved. Whether the PLAN is approved is the card under it (**CAD Plan Approved**). The Production CAD for received fabric is approved row by row: row menu (three dots) > **Approve**. Cutting needs an approved Production CAD with a CAD Average; a pending or rejected one does not count
- **A Production CAD with no average cannot be approved** - Fill in Layer(M) and the Size Breakdown, save, then Approve
- **Approve is refused for the CAD image** - A single row: "This Raw Mat CAD has no marker image…" (or Production) — the **CAD image** window opens; attach the image and use its values, or click **Enter values by hand**, save the row with a reason, then approve. Or "…values differ from its marker image: … Correct them, or save them with a reason, then approve." **Approve CAD Plan** names every row that is not ready ("2 CAD rows cannot be approved yet: …")
- **Approved rows from before 28-Sep-2026 show "No image"** - They keep their values and stay approved. Click the chip to attach the marker image: an approved row takes it only when the image says exactly what the row holds. If it differs, the image is kept in the style's images and the row changes only through row menu > **Correct…** (pick the image there)
- **A Production CAD must be on a received lot** - Approve does not show on a Production row with no lot. Use **Link to Stock** on the row, or delete it and press **Create CAD** on the lot in the **Fabric Stock Available** box
- **"This marker is 54" but lot … is 53" cutable — it will not fit"** - Approve (and Approve CAD Plan) refuse a Production CAD wider than its lot. Make a marker at the lot's cutable width or less; or, if the lot's width was recorded wrong at receipt, click **Width** on the lot in the **Fabric Stock Available** box and correct it first
- **A Production CAD is never corrected** - **Correct…** does not show on Production rows. To change one: row menu > **Reject**, edit the row, then **Approve** it again

## After approving

Once the CAD plan is approved:

1. The status banner shows **CAD Plan Approved**
2. Click **Actions** to access:
   - **Push to Fabric Costing** - Creates fabric costing records from the CAD data
   - **View Fabric Costing** - Opens the Fabric Costing page filtered to this style
   - **Reject CAD Plan** - Unlocks the Costing and Raw Mat rows if changes are needed (requires a reason). Refused while an approved cost sheet or an order's BOM is built on them

3. Navigate to **Cost Sheets** to create or generate the style's cost sheet using the approved CAD values

## How to reject (undo approval)

Use this only while nothing approved is built on the CAD. If a cost sheet or an order already uses it, correct the row instead.

**The whole plan:**

1. Open the approved CAD plan from the CAD Planning list
2. Click the **Actions** dropdown
3. Select **Reject CAD Plan** (shown in red text)
4. Enter the **Reason for rejection** in the text area (required)
5. Click **Reject & Unlock**
6. If a yellow box **This CAD is already in use — it cannot be rejected** appears, the plan is NOT rejected. The **Reject & Unlock** button stays greyed out. Click **Cancel**, then open the row menu (three dots) of the row you need to change > **Correct…**
7. Otherwise the Costing and Raw Mat rows are no longer approved and are editable again. Their fabric price approval is cleared (the cost figures are kept). Production CADs stay approved

**One row:**

1. Open the row menu (three dots) > **Reject**
2. Enter the **Rejection Reason** and click **Reject CAD**
3. If the yellow box **This CAD is already in use — it cannot be rejected** appears, click **Correct instead**. The **Correct CAD** window opens for that row
4. Otherwise the row becomes REJECTED and shows a red **Rejected** badge. Its fabric price approval is cleared

To see who changed a row and when, open the row menu (three dots) > **History**. The **CAD history** window lists each change with the person, date and time, the old and new values, and the reason. Changes are recorded from 26-Sep-2026; the row's creator and creation date are shown at the top.
