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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CADPlanningPage.tsx
  - frontend/src/components/cad/CADSpreadsheetTable.tsx
  - frontend/src/components/cad/CadInUseNotice.tsx
  - frontend/src/components/cad/CadHistoryDialog.tsx
  - frontend/src/components/cad/CorrectCadDialog.tsx
route: /cad-planning
---

## Before you start

The CAD plan must be complete before you can approve it:

1. **All rows must have a Part assigned** - Each CAD row needs a pattern part selected
2. **All rows must have CAD values** - The CAD Average (m/pc) must be calculated and greater than zero
3. **All fabric groups must be covered** - Every style fabric must have at least one CAD row with values

If any of these are missing, you will see an error when trying to approve.

## Steps

1. Open **Pre-Production > CAD Planning** in the sidebar.

2. Find the style whose CAD plan you want to approve and click on it to open the CAD Planning page.

3. Review the **CAD Spreadsheet** tab to ensure:
   - Every row has a **Part** selected in the Part column
   - Every row shows a **CAD Average** value (not blank or zero)
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

- **The CAD plan is locked** - You cannot edit fabric widths, greige selections, size breakdowns, or CAD values
- **Status changes to APPROVED** - The style badge shows a green checkmark with "APPROVED"
- **Cost sheet generation is enabled** - You can now create or generate the style's cost sheet
- **Fabric costing can begin** - The "Push to Fabric Costing" action becomes available

## Traps

- **Cannot edit after approval** - Once approved, you cannot change any CAD values (the Size Breakup button is greyed out too). To fix an approved Costing or Raw Mat row, use row menu (three dots) > **Correct…** (see the guide "Correct an approved CAD"). While nothing uses the CAD, you can also Reject it, edit it and approve it again
- **Reject requires a reason** - To undo an approval, you must provide a rejection reason
- **Reject is refused when the CAD is in use** - If an approved cost sheet or an order's BOM is built on the CAD, Reject stops with a yellow box **This CAD is already in use — it cannot be rejected**. It lists the cost sheets and orders. There is no way to reject past it. Use **Correct…** instead: it carries the change to those cost sheets, order BOMs and requirements
- **Rejection resets the planning rows** - Rejecting an approved CAD plan resets the Costing and Raw Mat rows to PENDING and unlocks them for editing. Production CADs stay approved, because cutting uses them
- **Rejection clears the fabric price approval** - The fabric costing figures are kept, but their approval is removed and must be done again on the Costing Options page
- **Every change is recorded** - Row menu (three dots) > **History** shows who created, edited, approved, rejected or corrected the row, what changed (old → new) and why
- **The green APPROVED badge is not the Production CAD** - It shows once any CAD row is approved. The Production CAD for received fabric is approved row by row: row menu (three dots) > **Approve**. Cutting needs an approved Production CAD with a CAD Average; a pending or rejected one does not count
- **A Production CAD with no average cannot be approved** - Fill in Layer (M) and the Size Breakdown, save, then Approve
- **A Production CAD must be on a received lot** - Approve does not show on a Production row with no lot. Use **Link to Stock** on the row, or delete it and press **Create CAD** on the lot in the **Fabric Stock Available** box
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
