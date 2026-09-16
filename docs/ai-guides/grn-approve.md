---
slug: grn-approve
title: Approve a GRN and update stock
keywords:
  - grn approve
  - approve goods receipt
  - qc pass
  - pending qc
  - stock update
  - grn reject
  - job work grn approve
  - inward challan
  - जीआरएन
  - अप्रूव
  - मंजूरी
  - स्टॉक
  - माल जांच
  - इनवर्ड चालान
  - quality check
  - grn approval kaise kare
  - greige stock
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/GRNList.tsx
  - frontend/src/pages/GRNDetail.tsx
  - backend/src/schemas/grn.schema.ts
  - backend/src/services/grn.service.ts
  - backend/src/services/helpers/jwo-arriving-material.helper.ts
route: /procurement/grn
---

## Before you start
The GRN must already exist and be in **Pending QC** status. Approve and Reject buttons do not appear on any other status. Approval is what actually creates stock, so check the physical goods first.

## Steps
1. Open **Procurement → GRN (Goods Receipt)** in the sidebar. The page title is **Goods Receiving Notes**.
2. Use the status dropdown to filter by **Pending QC** to see everything waiting, or search by GRN number, the supplier's invoice number, the PO or job work order number, supplier, warehouse, or the style — including the buyer's own style code. Typing several words narrows the list, since each word must match something. You can also filter by supplier using the supplier dropdown.
3. Click the GRN number to open it. The **PO / JWO** column shows which purchase order or job work order the GRN belongs to.
4. Check the summary tiles — **Total Items**, **Total Received**, **Total Accepted**, **Total Rejected** — and the **Received Items** table. Than, bale and roll breakdowns are shown under each material.
5. Click **Approve**.
6. If the GRN has no warehouse yet, the **Select Warehouse to Approve** box appears. Pick **Warehouse *** and click **Approve**.
7. If the GRN already has a warehouse, confirm on the **Approve GRN** dialog by clicking **Approve**.
8. A GRN made against a job work order (dyed or printed fabric, or dyed lace coming back), or against an old Processing purchase order, opens the **Approve Processing GRN - Quality Check** dialog instead: fill **Quality Grade *** (A - Good, B - Minor Defects, Reject), **Color Match**, **Defect Meters**, **Defect Type**, **Actual Rate (per meter)** and **QC Remarks**. If the GRN has no warehouse yet, pick **Warehouse *** in the same dialog. Then click **Approve & Create Stock**. This is where the quality of processed goods is recorded — the Dyeing and Printing pages no longer have a Quality Check step of their own.

## What approval does
- GRN status becomes **Accepted** and your name is stamped as approver.
- Accepted quantity is added to stock: greige goes to greige stock, fabric to fabric stock, lace to lace stock, thread to thread stock, and other materials to Stock Levels for the chosen warehouse. A Stock In movement is recorded for the audit trail.
- The PO receiving status is recomputed — it becomes Partially Received or Received.
- Rejected quantity is taken back off the PO's received counter so the shortfall can be re-ordered, and is logged as an adjustment-out movement.
- Receiving greige can automatically ready the linked processing work.
- For a GRN against a job work order: the finished fabric lot (or dyed lace lot) is created in the chosen warehouse, dated with the GRN's Receiving Date, and the job moves to **Stock Updated**. For a fabric job the actual shrinkage %, than count and fold length are written onto the job and an **Inward** challan from the processor is raised automatically. The job's loss split runs here, so an abnormal loss shows on the job work order afterwards, and any material requirement the job was covering is advanced.
- If fabric was waiting for a production run, a banner appears with **Go to Cutting Chart** or **View Cutting**.

## Rejecting instead
Click **Reject**, type a **Rejection Reason *** (required, it cannot be blank) and click **Reject**. This reverts the received quantities on the purchase order and creates no stock.

## Traps
- Approval is one-way from this screen — you cannot re-approve or re-edit an Accepted GRN here.
- If two people approve the same GRN at once, the second one gets "GRN is no longer PENDING_QC". Refresh and check the status.
- An inactive warehouse is rejected. Pick an active one.
- A GRN made against a job work order will not approve if that job was cancelled or closed after the GRN was saved. The message says its stock was already credited back. Reject the GRN, or ask the office to re-open the job first.
- A job work GRN is also refused if the job's finished fabric cannot be identified (no greige lot, requirement, lab dip or fabric on the job). The message asks you to link the job to its greige lot or requirement, or set its finished fabric, and then receive again.
