---
slug: goods-in-transit-challan
title: Issue a challan for goods on the way to a processor (goods-in-transit challan)
keywords:
  # English
  - goods in transit
  - goods on the way
  - challan before arrival
  - challan for dyer
  - rule 45 challan
  - direct delivery challan
  - supplier sends straight to dyer
  - issue challan goods on the way
  - transit challan
  - receive against challan
  - against our challan
  - not against a challan
  - cancel transit challan
  - truck never came
  - received by job worker
  - despatched by supplier
  - e-way bill
  - lr number
  - than list on challan
  # Hinglish
  - maal raste mein hai
  - dyer ko challan chahiye
  - challan pehle banana
  - maal pahuchne se pehle challan
  - supplier seedha dyer ko bhej raha
  - challan ke against receive
  - gaadi nahi aayi
  - dyer inward challan
  # Devanagari
  - माल रास्ते में
  - रास्ते में माल
  - डायर को चालान
  - पहले चालान
  - माल पहुंचने से पहले चालान
  - सीधा डायर को
  - चालान के खिलाफ रिसीव
  - गाड़ी नहीं आई
  - ई-वे बिल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/components/purchase-orders/DeliveryPlanCard.tsx
  - frontend/src/components/purchase-orders/TransitChallanDialog.tsx
  - frontend/src/components/job-work/ReceiptDetailRows.tsx
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/pages/ChallanDetail.tsx
  - frontend/src/types/challan.types.ts
  - backend/src/schemas/challan.schema.ts
  - backend/src/services/helpers/direct-supply-challan.helper.ts
  - backend/src/services/helpers/transit-challan-state.ts
  - backend/src/services/grn.service.ts
  - backend/src/services/document-data/challan.doc-data.ts
route: /procurement/purchase-orders
---

## When to use this
The supplier is sending goods **straight to a processor** (a dyer or printer) on our purchase order, and the processor needs **our job-work challan** to inward them. Issue the challan when the supplier despatches — before the goods arrive. When they arrive, file the receipt (GRN) against that challan: it picks the challan up. Do **not** file the receipt early just to get a challan.

It is optional: goods that reach the processor before you issue one still get their challan when the receipt is approved, as before.

## Before you start
- The purchase order must be **Sent**, **Acknowledged** or **Partially Received**, and be for **Greige**, **Greige Lace**, **Lace** or **Fabric**.
- Its **Deliver To** must name the processor's place (**<Name> - Processing Unit**) — one place, or one of the places of a split. Set it with **Change delivery** first (guide "Change where a Purchase Order is delivered").
- Keep the supplier's papers at hand: invoice number and date, the than / bale / roll list, vehicle and LR number, e-way bill number.

## Issue the challan
1. Open **Procurement → Purchase Orders** and click the PO number.
2. On the **Deliver To** card, find the processor's place and click **Issue challan — goods on the way**.
3. Fill in **Despatched on *** (the day the supplier sent the goods — today or earlier), **Supplier invoice no.**, **Invoice date**, **Vehicle no.**, **LR no.**, **E-way bill no.** and **E-way bill date**.
4. For each line (tick the ones on this truck):
   - **Supplier's list**: **Total metres**, **Than-wise**, **Bale-wise** or **Roll-wise** (greige and fabric only).
   - For a list: add each than / roll with its metres (and its printed **Than No.** / **Roll No.**; **Add bale** and **Bale No.** for bale-wise). **Quantity despatched** then adds itself up.
   - For **Total metres**: type **Quantity despatched** as on the supplier's paper.
   - **Fold L (cm)** when the thans are folded short — the actual metres show next to it.
5. Click **Issue challan**. The challan opens to print — give it with the goods. It is dated today and lists every than / bale / roll with its metres, the supplier's invoice, **Despatched by Supplier**, and says the goods must be returned within one year of the day they reach the processor.
6. Under the place, the challan now reads **CH… · <quantity> · On the way since <date>**, with **Print**, **Receive** and **Cancel**.

## When the goods arrive — receive against it
1. On the **Deliver To** card click **Receive** on that challan (or **Receive here** on the place — it picks the challan when only one is open). Or open the challan and click **Receive against this challan**.
2. The GRN form opens with **Against our challan *** already chosen, and fills the invoice, each line's quantity, fold and the than / bale / roll list as despatched.
3. Change the figures to what **actually arrived** (remove a than that did not come, correct metres), set the **Receiving Date** to the day it arrived, and save.
4. Approve the GRN into the processor's unit as usual (guide "Approve a GRN"). The challan then shows **Received by Job Worker** with the quantity, the date and the GRN; the one-year return clock runs from that day.

The challan itself never changes: it keeps what was despatched. If less arrived, the GRN shows the actual quantity, and the difference is for the supplier to settle.

## The goods never came — cancel it
On the **Deliver To** card click **Cancel** on the challan (or **Cancel challan** on the challan page), type why, and click **Cancel challan**. Only possible while nothing has been received against it. A cancelled challan is left out of ITC-04; if its quarter has already ended you are reminded to tell the CA.

## Traps
- **A receipt at that processor must say which challan it is.** While a challan is on the way to a processor, the GRN form asks **Against our challan *** for that place: pick it, or choose **Not against a challan** if these goods came some other way. Saving without choosing is refused — two challans for the same goods would be counted twice in ITC-04.
- One challan, one receipt: once a GRN is filed against it, a second GRN against the same challan is refused. Goods on a second truck need their own challan.
- The receipt cannot be dated before the challan. If the goods reached the processor first, receive them without the challan (the receipt makes one) and cancel the transit challan.
- A receipt against the challan must be approved into **that processor's unit** — approving it into our store or another processor is refused ("reject it to release the challan").
- Goods received against the challan cannot be marked **received as ready fabric**.
- You cannot issue more than can still come to that place (planned, less received, less what is already on the way).
- While goods are on the way the PO cannot be **cancelled** or **closed short**, and its place cannot be removed from the delivery plan or given less than what is on the way.
- A challan for goods on the way is never received with the challan page's **Receive** button — it has none; its arrival is the GRN.
- If a GRN against it is rejected, or an approved one is reversed before any of it went on a job, the challan goes back to **On the way** — it is never cancelled by that.
- The **Manufacturing Control Center** shows **Goods On The Way Too Long** when a challan is still on the way 10 days after the supplier despatched (Settings: "Goods on the way — alert after").
