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
  - जीआरएन
  - अप्रूव
  - मंजूरी
  - स्टॉक
  - माल जांच
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
---

## Before you start
The GRN must already exist and be in **Pending QC** status. Approve and Reject buttons do not appear on any other status. Approval is what actually creates stock, so check the physical goods first.

## Steps
1. Open **Procurement → GRN (Goods Receipt)** in the sidebar.
2. Set the status filter to **Pending QC** to see everything waiting, or search by GRN number, PO number or supplier.
3. Click the GRN number to open it.
4. Check the summary tiles — **Total Items**, **Total Received**, **Total Accepted**, **Total Rejected** — and the **Received Items** table. Than, bale and roll breakdowns are shown under each material.
5. Click **Approve**.
6. If the GRN has no warehouse yet, the **Select Warehouse to Approve** box appears. Pick **Warehouse *** and click **Approve**.
7. If the GRN already has a warehouse, confirm on the **Approve GRN** dialog by clicking **Approve**.
8. For a processing receipt the **Approve Processing GRN - Quality Check** dialog opens instead. Fill **Quality Grade *** (A - Good, B - Minor Defects, Reject), **Color Match**, **Defect Meters**, **Defect Type**, **Actual Rate (per meter)** and **QC Remarks**, then click **Approve & Create Stock**.

## What approval does
- GRN status becomes **Accepted** and your name is stamped as approver.
- Accepted quantity is added to stock: greige goes to greige stock, fabric to fabric stock, lace to lace stock, thread to thread stock, and other materials to Stock Levels for the chosen warehouse. A Stock In movement is recorded for the audit trail.
- The PO receiving status is recomputed — it becomes Partially Received or Received.
- Rejected quantity is taken back off the PO's received counter so the shortfall can be re-ordered, and is logged as an adjustment-out movement.
- Receiving greige can automatically ready the linked processing work.
- If fabric was waiting for a production run, a banner appears with **Go to Cutting Chart** or **View Cutting**.

## Rejecting instead
Click **Reject**, type a **Rejection Reason *** (required, it cannot be blank) and click **Reject**. This reverts the received quantities on the purchase order and creates no stock.

## Traps
- Approval is one-way from this screen — you cannot re-approve or re-edit an Accepted GRN here.
- If two people approve the same GRN at once, the second one gets "GRN is no longer PENDING_QC". Refresh and check the status.
- An inactive warehouse is rejected. Pick an active one.
- A GRN made against a job work order will not approve if that job was cancelled or closed after the GRN was saved. The message says its stock was already credited back. Reject the GRN, or ask the office to re-open the job first.
