---
slug: job-work-receive
title: Receive processed material back from a processor
keywords:
  - job work receive
  - JWO receive
  - receive from processor
  - receive via GRN
  - receive via grn button
  - mill se maal aaya
  - maal wapas
  - kapda wapas
  - job work GRN
  - dyed fabric receive
  - printed fabric receive
  - shrinkage
  - abnormal loss
  - close order
  - greige
  - greage
  - dyed lace
  - lace receive
  - receiving date
  - than count
  - fold length
  - inward challan
  - रिसीव वाया जीआरएन
  - मिल से माल आया
  - लेस वापस
  - माल वापस
  - रिसीव
  - प्रोसेसर
  - जॉब वर्क
  - कपड़ा वापस
  - रंगा हुआ कपड़ा
  - इनवर्ड चालान
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/ProcessingList.tsx
  - frontend/src/pages/DyeingList.tsx
  - frontend/src/pages/PrintingList.tsx
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/pages/JobWorkOrderList.tsx
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/pages/GRNList.tsx
  - frontend/src/pages/GRNDetail.tsx
  - backend/src/schemas/jobWorkOrder.schema.ts
  - backend/src/schemas/grn.schema.ts
  - backend/src/controllers/job-work-order.controller.ts
  - backend/src/services/grn.service.ts
  - backend/src/services/helpers/jwo-arriving-material.helper.ts
  - backend/src/services/helpers/jwo-status.helper.ts
route: /procurement/grn/new
---

## Before you start
The job work order must already be issued to the processor (status **Issued**, **In Transit**, **At Processor** or **Partial Receipt** — on the Dyeing & Printing page the job shows **At Mill**). A **Cancelled** or **Closed** order cannot be received at all — its material was already credited back to stock. There are two different receive paths — pick the right one or you get an error.

The old **Receive**, **Quality Check** and **Update Stock** buttons on the Dyeing and Printing pages no longer exist. Processed fabric and dyed lace are received, and booked into stock, only through a GRN.

## Fabric or dyed lace coming back in metres (dyeing, printing, finishing)
Anything measured in metres is received through a GRN, so the stock lot gets created — cloth into fabric stock, dyed lace into lace stock.

### Open the GRN form with the job selected
Any of these:
- Open the job work order itself and click **Receive via GRN** in the Actions card. The GRN form opens with that job already selected. This is the whole button for a metre job — there is no **Receive Material** on a fabric or lace order, because that action books no stock.
- Open **Manufacturing → Dyeing & Printing** in the sidebar and click the **Job Work Orders** tab. On the job showing **At Mill**, click the green **Receive via GRN** icon button in the Actions column (the name shows when you hover). The GRN form opens with that job already selected. The same button is on the Dyeing page and the Printing page.
- Or open **Procurement → GRN (Goods Receipt)**, click **+ Create GRN**, and in the box **Or receive against a Job Work Order (no PO)** pick the job. Each entry shows the JWO number, processor, process type, quantity due back, quantity sent and style.

### Fill the receipt
1. Read the line under the dropdown: **Expected fabric** (or **Expected dyed lace** with the shade name) is the quantity due back — the greige sent minus the expected shrinkage.
2. Choose the **Entry Mode**: **Total Meters**, **Than-wise** or **Bale-wise**.
3. In **Total Meters** mode, fill **Received Meters**. If you only have than and fold, leave meters blank and fill **Than Count** and **Fold Length (cm)** instead — one or the other is required.
4. In **Than-wise** mode, click **Add Than** for every than that came back and type its metres. In **Bale-wise** mode, click **Add Bale** for each bale, then **Than** inside the bale, and type the metres of each than. The green **Detail sum** shows the running total.
5. Fill **Fold Length (cm)** — it is centimetres and must be under 1000 — and **Width (inches)**. The measured width is stamped onto the finished fabric.
6. Fill **Vendor Challan Ref** with the processor's challan number.
7. Lower down the page, choose **Warehouse** and set **Receiving Date** — the date the goods actually came back (defaults to today). Both apply to this receipt, as do **Invoice Number**, **Invoice Date** and **Notes**. A warehouse is needed at approval in any case, so pick it now if you know it.
8. Click **Save GRN for [JWO number]** — the button inside the job work box, not the **Save GRN** button at the top of the page (that one is for purchase orders).
9. The GRN is created in **Pending QC** and you land on the GRN list. Nothing is in stock yet.

### Approve the GRN
1. On **Procurement → GRN (Goods Receipt)**, open the new GRN — filter the status to **Pending QC** or search the JWO number.
2. Click **Approve**. The **Approve Processing GRN - Quality Check** dialog opens: fill **Quality Grade *** (A - Good, B - Minor Defects, Reject), **Color Match**, **Defect Meters**, **Defect Type**, **Actual Rate (per meter)** and **QC Remarks**. If the GRN has no warehouse yet, pick **Warehouse *** in the same dialog. Click **Approve & Create Stock**. This is the only place the quality of a job-work receipt is recorded.
3. Approval books the finished fabric into fabric stock (dyed lace into lace stock) in that warehouse and moves the job to **Stock Updated**. For a fabric job it also writes the actual shrinkage %, than count and fold length onto the job and raises an **Inward** challan from the processor automatically — you do not create that challan yourself. The Receiving Date you entered becomes the job's received date, the stock lot's date and the inward challan date.

## Piece work coming back (stitching, washing, handwork, kaaj-button)
1. Open **Manufacturing → Job Work Dashboard**, click **Job Work Orders**, then open the order.
2. Click **Receive Material**.
3. Enter **Quantity Received**. It must be more than zero. The expected figure and the **Tolerance** percentage are shown for reference.
4. Click **Receive & Calculate Loss**.

## After receiving
- The system splits the loss into normal process loss and abnormal loss automatically — for metre jobs this happens when the GRN is approved.
- If there is abnormal loss you get a warning and an **Abnormal Loss Detected** banner on the job work order. A debit note against the processor is required.
- Click **Close Order** on the job work order and enter **Processor Invoice Number *** to finish the order. Closing is refused while abnormal loss has no debit note.

## Traps
- **Receive via GRN** only shows once the job has gone out — status **Issued**, **In Transit**, **At Processor** or **Partial Receipt** (**At Mill** on the Dyeing & Printing page). A job in **Draft** has not been sent yet — use **Send to Mill** first.
- Until the GRN is approved the job still shows **At Mill** and the button stays. Do not save a second GRN for the same job — open the GRN list and approve the one already there.
- **Fold Length (cm)** must be under 1000. Typing metres or millimetres there is refused with "Fold length is in cm and must be under 1000".
- Receiving more than the expected fabric plus the allowed over-receipt tolerance is refused; the message shows the maximum you can enter.
- **Receive Material** never appears on a metre-based fabric or lace job — those show **Receive via GRN** instead, because only the GRN creates the stock lot. A piece-based (PCS) job is the mirror image: it never appears in the GRN list and is received from the job work order's **Receive Material**. If some older screen or link still posts a metre job to **Receive Material**, it is refused with "Fabric job work is received through a GRN" (or "Lace job work…") and the job is left untouched, so you can still receive it properly afterwards.
- A job that is linked to a purchase order is refused with "…is linked to a purchase order — receive it on a GRN against that PO". It does not appear in the job work box; receive it against the purchase order instead.
- A receipt that records no quantity is refused when you approve it, with "…cannot be approved: this receipt records no quantity". Reject that GRN and create a new one with the metres actually received.
- If the JWO is missing from the GRN dropdown, it has not been issued yet, it has already been received, it was cancelled or closed, it is linked to a purchase order (receive it against that PO), or it is piece-based. If the whole **Or receive against a Job Work Order (no PO)** box is missing, no job is currently receivable.
- A job that was already received on the old Dyeing or Printing page is marked received and cannot be received again — the message says it "has already been received".
- A job whose finished fabric cannot be identified is refused when you save, with a message asking you to link the job to its greige lot or requirement, or set its finished fabric, then receive again. A lace job with no dyed variant is refused the same way.
- A dyed lace receipt lands on the **dyed variant**, not on the greige — the greige left stock when it was issued. Its cost per metre is all the greige money plus all the dyeing money, spread over the metres that actually came back.
- Reversing an approved lace receipt removes the lot it created, and is refused once any of that lace has been used or reserved.
- A cancelled job blocks receiving everywhere — even a GRN saved before the cancellation refuses approval. The error says the stock was already credited back; if the mill really returned material, ask the office to re-open the job first.
- Receiving does not create stock on its own — the GRN must be approved.
- If the order was cancelled after material was issued, a disposition dialog appears asking what happened to the material. Complete that step before trying to receive.
