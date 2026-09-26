---
slug: cad-correct
title: Correct an approved CAD (average, layer, sizes or greige)
keywords:
  # English
  - correct CAD
  - CAD correction
  - fix approved CAD
  - wrong CAD average
  - change CAD average
  - change layer length
  - change size breakup after approval
  - change greige after approval
  - change width after approval
  - approved CAD is wrong
  - CAD in use cannot reject
  - correct instead
  - correction pending
  - correction partly applied
  - check impact
  - send for approval
  - made by a CAD correction
  - carry CAD to order BOM
  - update order BOM from CAD
  - corect CAD
  - cad corection
  - avrage wrong
  - averge change
  # Hinglish
  - CAD galat hai
  - CAD sahi karna
  - CAD theek karna
  - average badalna
  - average galat hai
  - layer badalna
  - size breakup badalna
  - greige badalna
  - approved CAD change karna
  - CAD correction approve karna
  - correction pending kyun hai
  - order ka BOM update karna
  # Devanagari (MANDATORY)
  - कैड सुधारना
  - कैड गलत है
  - कैड सही करना
  - एवरेज गलत
  - एवरेज बदलना
  - लेयर बदलना
  - ग्रेज बदलना
  - साइज ब्रेकअप बदलना
  - कैड करेक्शन
  - करेक्शन पेंडिंग
  - कॉस्ट शीट वर्जन अप्रूव
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CADPlanningPage.tsx
  - frontend/src/components/cad/CADSpreadsheetTable.tsx
  - frontend/src/components/cad/CorrectCadDialog.tsx
  - frontend/src/components/cad/CadInUseNotice.tsx
  - frontend/src/components/cad/CadHistoryDialog.tsx
  - frontend/src/pages/CostSheetList.tsx
  - frontend/src/pages/CostSheetDetail.tsx
  - frontend/src/components/cost-sheet/CadCorrectionBanner.tsx
  - frontend/src/components/requirements/RequirementDecision.tsx
  - backend/src/services/cad-correction.service.ts
  - backend/src/schemas/cadPlanning.schema.ts
route: /cad-planning
---

## When to use this

An approved Costing or Raw Mat CAD row turns out to be wrong — the layer length, the size breakup, the greige or the cuttable width — and cost sheets or orders may already be built on it. **Correct…** fixes the row and carries the fix down the chain: fabric price per metre → cost sheet → order BOM → requirements. Nobody has to undo anything by hand.

Reject no longer works once an approved cost sheet or an order's BOM uses the CAD. Correct is the way to change it.

## Steps — correct the CAD (merchant)

1. Open **Pre-Production > CAD Planning** in the sidebar and click **Open CAD** on the style.
2. On the **CAD Spreadsheet** tab, find the approved **Costing** or **Raw Mat** row.
3. Open the row menu (three dots) > **Correct…**. The **Correct CAD** window opens. Its top line shows the row's purpose, part, greige, width and current average. Nothing changes until you check the impact and submit.
4. Change only what is wrong:
   - **Layer length (m)**
   - **Size breakup** — click the button, set the pieces per size in the popup and click **Save**
   - **Greige** — only greiges of the row's own generic greige are listed
   - **Cuttable width (in)**
5. Type the **Reason** * — at least 3 characters. It is kept in the CAD history.
6. Click **Check impact**. The result appears under the fields (see the next section).
7. Click the last button. Its label tells you what will happen:
   - **Submit correction** — nothing approved uses this CAD yet. The row is corrected at once and stays approved. You see "CAD corrected." If the price per metre changed, the row's fabric price approval is cleared — approve it again on **Pre-Production > Costing Options**.
   - **Send for approval** — an approved cost sheet or an order's BOM uses this CAD. The CAD row is NOT changed yet. A new cost sheet version is made for each approved cost sheet and waits for an admin. You see "Correction sent for approval — … Orders and requirements update when it is approved."
8. When sent for approval, the row shows a **Correction pending** badge. Hover it to see who corrected it, when and why.

## What Check impact shows

- **CAD average**: old → new
- **Greige**: old → new (only when you changed it)
- **Fabric price** per metre: old → new, with the rate slab it was priced at
- **Fabric per piece**: old → new
- Whether the price per metre changes
- **Cost sheets**: each version, its purpose and status, and what happens to it — "a new version is made for the admin to approve" (approved sheets) or "updated in place" (sheets not approved yet)
- **Orders**: each order, its BOM version, the greige metres old → new, and its requirements with their state (open, from stock, or on a PO / job work). A locked BOM reads "locked — skipped until unlocked"
- A line saying cutting is not affected
- **Needs an admin's approval** or "Nothing approved uses this CAD yet — it is corrected straight away."

If it says **Nothing to correct**, the CAD and everything built on it already agree, and the submit button stays greyed out.

If the CAD already shows the right values but a cost sheet or order still has the old ones, open **Correct…**, change nothing, give a reason and click **Check impact**. It says "The CAD already reads these values — this carries them to the cost sheets and orders below." Then submit.

## Steps — approve or reject the new cost sheet version (admin)

Only an admin can approve or reject a cost sheet.

1. Open **Pre-Production > Cost Sheets**. Set **Approval Status** to **Pending** and find the style's new version.
2. Click **View**. The **Cost Sheet Details** page shows a box **Made by a CAD correction**: the old → new CAD average, who corrected it, when, and the reason. It also says what approving does.
3. Check the fabric line and the totals.
4. Click **Approve** and confirm in **Approve Cost Sheet**. Or click **Reject**, enter the **Rejection Notes** (required) and click **Reject**.

## What updates by itself when the admin approves

- The CAD row takes the corrected values and stays approved.
- If the row has a fabric costing, its new price per metre is saved and its fabric price approval is given (the admin saw the price on the sheet).
- Every running order built on the previous cost sheet version gets a new Order BOM version from the new sheet, already approved.
- Each of those orders' requirements is recalculated. Requirement numbers stay the same. Stock already reserved stays reserved, and what is no longer needed is given back.
- A PO or job work that already exists is never changed:
  - if the new BOM needs more, the difference appears as its own requirement with status **Needs Decision**;
  - if it needs less, the PO row shows a note "… more than now needed" under its quantity.
- The **Correction pending** badge goes away.

If an order's BOM is locked, that order is skipped. The CAD row badge then reads **Correction partly applied**, and the box on the Cost Sheet Details page lists the order and the reason. Unlock the order BOM, then the admin clicks **Retry** in that box.

## What happens when the admin rejects

- The previous cost sheet version is restored and stays in use.
- The CAD row, the order BOMs and the requirements are not changed.
- The badge goes away. The box on the rejected version reads "The correction was rejected — the CAD was not changed."
- To try again, make a new correction.

## What the team still decides

A **Needs Decision** requirement cannot go on a PO until someone chooses **Order the extra** or **Don't order more** on **Procurement > Requirements**. The order's page shows it on the PO step as "N need a decision (extra quantity)" with a **Decide** button. See the guide "Decide on extra quantity after a BOM change".

## Where to see what happened

Row menu (three dots) > **History**. Each step is a **Corrected** entry with the person, date and time and the reason:
- when it was made — the old → new values (CAD average, layer length, pieces, width, greige, sizes), and "Waiting for the admin to approve the new cost sheet version" when it went for approval;
- "Approved — the CAD now reads the corrected values" when the admin approved;
- "Rejected by the admin — the CAD was not changed" when the admin rejected.

## Traps

- **Correct… only shows on approved Costing and Raw Mat rows.** A pending or rejected row is edited directly. A Production CAD is never corrected: row menu > **Reject**, edit the row, then **Approve** it again.
- **One pending correction per row.** While **Correction pending** or **Correction partly applied** shows, **Correct…** is hidden. The admin must approve or reject the waiting version first ("This CAD already has a correction waiting for approval. Approve or reject it first.").
- **Nothing changes until the admin approves.** Until then the CAD row, the cost sheets (approved or not), the order BOMs and the requirements keep the old figures. On approval, cost sheets that were not approved yet take the corrected figures too.
- **Rejecting the version keeps the old CAD.** It does not reject the CAD row.
- **Cutting is not affected.** Cutting cuts to each received lot's own Production CAD. If that lot's marker is wrong too, fix the Production row separately.
- **Two approved cost sheets (Costing and Raw material) make two new versions.** The CAD row changes as soon as the first one is approved, and the badge stays **Correction pending** until the second is decided. Rejecting the second one then keeps that cost sheet on its previous figures; the CAD stays corrected.
- **"An order is built on this CAD but no approved cost sheet is — approve (or discard) the pending cost sheet first, then correct."** Decide the pending cost sheet on the Cost Sheets page, then correct again.
- **"The corrected marker gives no CAD average — enter a layer length and a size breakdown."** Fill in both.
- **The submit button stays greyed out** until you have clicked **Check impact** and typed a **Reason** of at least 3 characters.
- **Changing a value after Check impact clears the result.** Click **Check impact** again.
- **The correction's cost sheet version cannot be deleted** ("… made by a CAD correction that is waiting for a decision. Reject it …"). **Reject** it instead — that restores the previous version.
- **Reject says "This CAD is already in use — it cannot be rejected".** That is expected once a cost sheet or order uses the CAD. Click **Correct instead** (row Reject) or use row menu > **Correct…**.
