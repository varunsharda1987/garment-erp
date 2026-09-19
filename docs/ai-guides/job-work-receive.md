---
slug: job-work-receive
title: Receive processed material back from a processor
keywords:
  - job work receive
  - JWO receive
  - receive from processor
  - receive and add to stock
  - receive via GRN
  - job work return
  - mill se maal aaya
  - maal wapas
  - kapda wapas
  - dyed fabric receive
  - printed fabric receive
  - shrinkage
  - abnormal loss
  - debit note
  - close order
  - greige
  - greage
  - dyed lace
  - lace receive
  - receiving date
  - than count
  - fold length
  - inward challan
  - रिसीव फ्रॉम प्रोसेसर
  - मिल से माल आया
  - लेस वापस
  - माल वापस
  - रिसीव
  - प्रोसेसर
  - जॉब वर्क
  - जॉब वर्क रिटर्न
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
  - frontend/src/components/job-work/ReceiveFromProcessorDialog.tsx
  - frontend/src/services/jobWorkOrder.service.ts
  - frontend/src/pages/GRNList.tsx
  - frontend/src/pages/GRNDetail.tsx
  - backend/src/schemas/jobWorkOrder.schema.ts
  - backend/src/schemas/grn.schema.ts
  - backend/src/routes/grn.routes.ts
  - backend/src/controllers/job-work-order.controller.ts
  - backend/src/services/grn.service.ts
  - backend/src/services/helpers/jwo-arriving-material.helper.ts
  - backend/src/services/helpers/jwo-status.helper.ts
route: /job-work-orders
---

## Before you start
The job work order must already be out with the processor — status **Issued**, **In Transit**, **At Processor** or **Partial Receipt** (the Dyeing & Printing page shows it as **At Mill**). A **Draft** or **Approved** order has not been sent yet: use **Issue to Processor** (or **Send to Mill**) first. A **Cancelled** or **Closed** order cannot be received — its material was already credited back to stock.

Receiving is one action on the job. There is no GRN form to fill and no separate approval step: the receipt is filed for you, already accepted, and the stock is booked in the same moment.

## Fabric or dyed lace coming back in metres (dyeing, printing, finishing)

### Open the dialog
Any of these opens the same dialog, titled **Receive from** followed by the processor's name:
- Open the job work order and click **Receive from processor** in the Actions card.
- On **Manufacturing → Dyeing & Printing**, **Job Work Orders** tab, click the green **Receive from processor** icon in the Actions column on the job showing **At Mill** (the name shows when you hover). The same icon is on the Dyeing page and the Printing page.

### Fill it in
1. Read **Expected back** (or **Expected dyed lace**) — the quantity due back: the greige sent minus the expected shrinkage. **Maximum you can receive** appears once you start typing a quantity.
2. **How much came back (MTR) \*** — type the metres. Or leave it blank and give **Than count** and **Fold length (cm, under 1000)** — the metres are worked out from those.
3. **Measured width (inches)** — the finished width you measured. It is stamped onto the finished fabric. (Not shown for lace — lace width lives on the master.)
4. **Their challan no.** — the processor's challan number.
5. **Into warehouse \*** and **Date received \*** (defaults to today). The date becomes the receipt date, the job's received date and the inward challan date.
6. **Quality (optional)** — **A - Good**, **B - Minor Defects** or **Reject** — and **Defect metres** if any.
7. If the quantity is short beyond the job's tolerance, a warning appears naming the metres beyond the allowance and saying a debit note against the processor will be needed before the job can close. You can still go ahead.
8. Click **Receive & add to stock**. The button stays disabled until you have a quantity, a warehouse and a date.

### What that one click does
- Files the receipt, already accepted. It appears on **Procurement → GRN (Goods Receipt)** badged **Job work return**, and the job shows **Return receipt GRN-…** in its Actions card.
- Books the finished fabric into fabric stock (dyed lace into lace stock) in the warehouse you chose, at the processing rate plus the greige cost.
- Raises the **Inward** challan from the processor — the GST document for goods back from a job worker. **Print Inward Challan** appears on the job.
- Writes the actual shrinkage %, than count, fold length, width and quality onto the job and moves it to **Stock Updated**.
- Splits the loss into normal and abnormal, and advances any material requirement the job was covering.

## Piece work coming back (stitching, washing, handwork, kaaj-button)
1. Open **Manufacturing → Job Work Dashboard**, click **Job Work Orders**, then open the order.
2. Click **Receive Material**.
3. Enter **Quantity Received**. It must be more than zero. The expected figure and the **Tolerance** percentage are shown for reference.
4. Click **Receive & Calculate Loss**.

## After receiving
- If there is abnormal loss you are told when you receive, and an **Abnormal Loss Detected** banner shows on the job work order. A debit note against the processor is required.
- Click **Close Order** on the job work order and enter **Processor Invoice Number \*** to finish the order. Closing is refused while abnormal loss has no debit note.
- If the count was wrong, ask an admin to reverse the receipt: that takes the lot back and cancels the inward challan, and is refused once any of that material has been used or reserved.

## Traps
- **Receive from processor** only shows once the job has gone out (**Issued**, **In Transit**, **At Processor**, **Partial Receipt**; **At Mill** on the Dyeing & Printing page). A **Draft** job has not been sent — use **Issue to Processor** first.
- One receipt per job. A job that has already been received is refused with "has already been received" — do not click again after a slow response; open the job and check its status.
- **Fold length (cm)** must be under 1000. Typing metres or millimetres there is refused with "Fold length is in cm and must be under 1000".
- Receiving more than **Maximum you can receive** is refused; the message shows the maximum.
- A receipt with no quantity is refused with "Received quantity must be greater than 0" — nothing is written.
- **Receive Material** never appears on a metre-based fabric or lace job — those show **Receive from processor**, because only that action creates the stock lot. A piece-based (PCS) job is the mirror image. If an older screen or link still posts a metre job to **Receive Material**, it is refused and the job is left untouched, so you can still receive it properly.
- A job linked to a purchase order is refused — receive it against that purchase order on the GRN form.
- A job whose finished fabric cannot be identified is refused with a message asking you to link the job to its greige lot or requirement, or set its finished fabric, then receive again. A lace job with no dyed variant is refused the same way.
- A dyed lace receipt lands on the **dyed variant**, not on the greige — the greige left stock when it was issued. Its cost per metre is all the greige money plus all the dyeing money, spread over the metres that actually came back.
- A cancelled job blocks receiving. The error says the stock was already credited back; if the mill really returned material, ask the office to re-open the job first.
- If the order was cancelled after material was issued, a disposition dialog appears asking what happened to the material. Complete that step first.
- The old **Or receive against a Job Work Order (no PO)** box on the GRN form is gone. That form only receives purchased goods against a purchase order now; it shows a note pointing you to the job work order.
