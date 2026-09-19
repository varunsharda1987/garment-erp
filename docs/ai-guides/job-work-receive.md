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
  - partial receipt
  - receive in parts
  - final delivery
  - two deliveries
  - aadha maal aaya
  - kishton mein
  - रिसीव फ्रॉम प्रोसेसर
  - आधा माल आया
  - किश्तों में
  - आखिरी डिलीवरी
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
  - frontend/src/components/job-work/ReceiptDetailRows.tsx
  - frontend/src/components/WarehouseCombobox.tsx
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
The job work order must already be out with the processor — status **Issued**, **In Transit**, **At Processor** or **Partial Receipt** (the Dyeing & Printing page shows these as **At Mill**, or **Partial Receipt** once a first part is in). A **Draft** or **Approved** order has not been sent yet: use **Issue to Processor** (or **Send to Mill**) first. A **Cancelled** or **Closed** order cannot be received — its material was already credited back to stock.

Receiving is one action on the job. There is no GRN form to fill and no separate approval step: the receipt is filed for you, already accepted, and the stock is booked in the same moment.

## Fabric or dyed lace coming back in metres (dyeing, printing, finishing)

### Open the dialog
Any of these opens the same dialog, titled **Receive from** followed by the processor's name:
- Open the job work order and click **Receive from processor** in the Actions card.
- On **Manufacturing → Dyeing & Printing**, **Job Work Orders** tab, click the green **Receive from processor** icon in the Actions column on the job showing **At Mill** or **Partial Receipt** (the name shows when you hover). The same icon is on the Dyeing page and the Printing page.

### Fill it in
1. Read **Expected back** (or **Expected dyed lace**) — the quantity due back: the greige sent minus the expected shrinkage. **Maximum you can receive** appears once you start typing a quantity.
2. Choose the **Entry mode**: **Total metres**, **Than-wise** or **Bale-wise**.
3. **Total metres** — type **How much came back (MTR) \***. **Than count** and **Fold length (cm, under 1000)** can be recorded alongside it and are stored with the receipt. Leave the metres blank and the quantity is worked out from than count × fold length instead.
4. **Than-wise** — click **Add than** for every than that came back and type its metres; the **Detail sum** shows the running total. **Bale-wise** — click **Add bale**, then **Add than** inside each bale, and type each than's metres; every bale shows its own subtotal. In both, the than count is the number of rows.
5. **Measured width (inches)** — the finished width you measured. It is stamped onto the finished fabric. (Not shown for lace — lace width lives on the master.)
6. **Their challan no.** — the processor's challan number.
7. **Into warehouse \*** — only physical stores are listed; a processor's own location or "in transit" is never a place to book stock. When the company has a single store it is already filled in. **Date received \*** defaults to today and cannot be before the day the greige was sent.
8. **Quality (optional)** — **A - Good**, **B - Minor Defects** or **Reject** — and **Defect metres** if any.
9. **This is the final delivery** — ticks itself once what you are receiving, together with any earlier parts, reaches the expected quantity (less the processor's tolerance). Untick it if more is still to come: this part is booked into stock and the job stays open as **Partial Receipt**. Tick it yourself to close the job short.
10. If the quantity is short beyond the job's tolerance and the final-delivery box is ticked, a warning appears naming the metres beyond the allowance and saying a debit note against the processor will be needed before the job can close. You can still go ahead.
11. Click **Receive & add to stock** (it reads **Receive part & add to stock** while the box is unticked). The button stays disabled until you have a quantity, a warehouse and a valid date.

### What that one click does
- Files the receipt, already accepted. It appears on **Procurement → GRN (Goods Receipt)** badged **Job work return**, and the job lists it under **Return receipts** in its Actions card with its date and metres.
- Books the finished fabric into fabric stock (dyed lace into lace stock) in the warehouse you chose, at the processing rate plus the greige cost.
- Raises the **Inward** challan from the processor — the GST document for goods back from a job worker. **Print Inward Challan** appears on the job.
- Writes the than count, fold length, width and quality onto the job. On the final delivery it also writes the actual shrinkage % and moves the job to **Stock Updated**; a part leaves it at **Partial Receipt**.
- On the final delivery, splits the loss into normal and abnormal on the total of all parts. Every receipt advances any material requirement the job was covering by its own metres.

## Receiving in parts
A processor often returns a job in more than one delivery. Record each delivery as its own receipt:
1. Open **Receive from processor** and enter the first delivery as above, with its own challan number and date.
2. Untick **This is the final delivery** and click **Receive part & add to stock**. That part is in stock with its own inward challan, and the job shows **Partial Receipt** with **Received so far … of … expected — … still to come** in its Quantities card.
3. For the next delivery open the dialog again. It shows **Received so far** and **Maximum you can still receive**, and the final-delivery box ticks itself once the total is reached. Leave it ticked on the last delivery and click **Receive & add to stock**.
4. The job moves to **Stock Updated**. Shrinkage and the loss split are worked out once, on the total of all parts, and the Actions card lists every **Return receipt**.

If a part was recorded wrongly, an admin reverses that one receipt: its lot and inward challan go, the other parts stay, and the job's total is recomputed. Reversing the final part re-opens the job as **Partial Receipt**, so the last delivery can be entered again.

## Piece work coming back (stitching, washing, handwork, kaaj-button)
1. Open **Manufacturing → Job Work Dashboard**, click **Job Work Orders**, then open the order.
2. Click **Receive Material**.
3. Enter **Quantity Received**. It must be more than zero. The expected figure and the **Tolerance** percentage are shown for reference.
4. Click **Receive & Calculate Loss**.

## After receiving
- If there is abnormal loss you are told when you receive, and an **Abnormal Loss Detected** banner shows on the job work order. A debit note against the processor is required.
- Click **Close Order** on the job work order and enter **Processor Invoice Number \*** to finish the order. Closing is refused while abnormal loss has no debit note.
- If the count was wrong, ask an admin to reverse the receipt: that takes back that receipt's lot and cancels its inward challan (other parts of the same job stay), and is refused once any of that material has been used or reserved.

## Traps
- **Receive from processor** only shows once the job has gone out (**Issued**, **In Transit**, **At Processor**, **Partial Receipt**; **At Mill** or **Partial Receipt** on the Dyeing & Printing page). A **Draft** job has not been sent — use **Issue to Processor** first.
- A job that has had its final delivery is refused with "has already been received" — do not click again after a slow response; open the job and check its status. To receive in parts, untick **This is the final delivery** on every part but the last.
- **Fold length (cm)** must be under 1000. Typing metres or millimetres there is refused with "Fold length is in cm and must be under 1000".
- Receiving more than **Maximum you can receive** is refused; the message shows the maximum. With parts the cap is on the total of all parts, and the message names the metres already received.
- The final-delivery box follows the quantity only until you click it; after that it stays as you set it until the dialog is next opened.
- A receipt with no quantity is refused with "Received quantity must be greater than 0" — nothing is written.
- A return dated before the day the greige was sent is refused: "Date received 27-Aug-2026 is before the day the greige was sent (19-Sep-2026)". The date field will not go earlier than the send day.
- If the warehouse box reads **Could not load — open to retry** (the server was busy for a moment), open it again — the list is fetched afresh. It is never stuck.
- In Than-wise or Bale-wise mode every row needs metres greater than zero before the button enables; an empty row blocks it.
- **Receive Material** never appears on a metre-based fabric or lace job — those show **Receive from processor**, because only that action creates the stock lot. A piece-based (PCS) job is the mirror image. If an older screen or link still posts a metre job to **Receive Material**, it is refused and the job is left untouched, so you can still receive it properly.
- A job linked to a purchase order is refused — receive it against that purchase order on the GRN form.
- A job whose finished fabric cannot be identified is refused with a message asking you to link the job to its greige lot or requirement, or set its finished fabric, then receive again. A lace job with no dyed variant is refused the same way.
- A dyed lace receipt lands on the **dyed variant**, not on the greige — the greige left stock when it was issued. Its cost per metre is all the greige money plus all the dyeing money, spread over the metres that actually came back.
- A cancelled job blocks receiving. The error says the stock was already credited back; if the mill really returned material, ask the office to re-open the job first.
- If the order was cancelled after material was issued, a disposition dialog appears asking what happened to the material. Complete that step first.
- The old **Or receive against a Job Work Order (no PO)** box on the GRN form is gone. That form only receives purchased goods against a purchase order now; it shows a note pointing you to the job work order.
