---
slug: job-work-receive
title: Receive processed material back from a processor
keywords:
  - job work receive
  - JWO receive
  - receive from processor
  - maal wapas
  - kapda wapas
  - job work GRN
  - shrinkage
  - abnormal loss
  - close order
  - greige
  - greage
  - माल वापस
  - रिसीव
  - प्रोसेसर
  - जॉब वर्क
  - कपड़ा वापस
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/pages/JobWorkOrderList.tsx
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/pages/GRNList.tsx
  - backend/src/schemas/jobWorkOrder.schema.ts
  - backend/src/schemas/grn.schema.ts
  - backend/src/controllers/job-work-order.controller.ts
---

## Before you start
The job work order must already be issued to the processor (status **Issued**, **At Processor** or **Sent to Mill**). There are two different receive paths — pick the right one or you get an error.

## Fabric coming back in meters (dyeing, printing, finishing)
Cloth is received through a GRN, so the fabric stock lot gets created.

1. Open **Procurement → GRN (Goods Receipt)** in the sidebar.
2. Click **+ Create GRN**.
3. Find the box **Or receive against a Job Work Order (no PO)** and select the JWO. The list shows the JWO number, processor, quantity due back and quantity sent.
4. Fill **Received Meters**. If you only have than and fold, leave meters blank and fill **Than Count** and **Fold Length (cm)** instead — one or the other is required.
5. Fill **Width (inches)** and **Vendor Challan Ref**.
6. Choose **Warehouse *** and **Receiving Date *** lower down the page — they apply to this receipt too.
7. Click **Save GRN for [JWO number]**.
8. The GRN is created in Pending QC. Approve it from the GRN list to create the stock.

## Piece work coming back (stitching, washing, handwork, kaaj-button)
1. Open **Manufacturing → Job Work Dashboard**, click **Job Work Orders**, then open the order.
2. Click **Receive Material**.
3. Enter **Quantity Received**. It must be more than zero. The expected figure and the **Tolerance** percentage are shown for reference.
4. Click **Receive & Calculate Loss**.

## After receiving
- The system splits the loss into normal process loss and abnormal loss automatically.
- If there is abnormal loss you get a warning and an **Abnormal Loss Detected** banner. A debit note against the processor is required.
- Click **Close Order** and enter **Processor Invoice Number *** to finish the order. Closing is refused while abnormal loss has no debit note.

## Traps
- Trying to use **Receive Material** on a meter-based fabric job gives "Fabric job work is received through a GRN". Use the GRN path above.
- If the JWO does not appear in the GRN dropdown, it has not been issued yet, or it has already been received.
- Receiving does not create stock on its own — the GRN must be approved.
