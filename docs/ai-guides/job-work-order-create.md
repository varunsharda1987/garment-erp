---
slug: job-work-order-create
title: Create a Job Work Order and send material to a processor
keywords:
  - job work order
  - JWO
  - jwo kaise banaye
  - send to processor
  - job work
  - dyeing
  - printing
  - embroidery
  - kaaj button
  - challan
  - lace dyeing
  - greige lace
  - lace rangai
  - dyed lace
  - rate card
  - processor rate
  - shrinkage
  - print type
  - rate kahan se aaya
  - processor ka rate
  - रेट कार्ड
  - श्रिंकेज
  - प्रोसेसर का रेट
  - छपाई का प्रकार
  - जॉब वर्क
  - प्रोसेसर
  - माल भेजना
  - रंगाई
  - कढ़ाई
  - लेस
  - लेस रंगाई
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/JobWorkOrderList.tsx
  - frontend/src/components/JobWorkOrderCreateDialog.tsx
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/components/job-work/GreigeLotRows.tsx
  - frontend/src/pages/DispatchToProcessor.tsx
  - frontend/src/components/GreigeCombobox.tsx
  - frontend/src/services/processorRateCardV2.service.ts
  - backend/src/schemas/jobWorkOrder.schema.ts
  - backend/src/controllers/job-work-order.controller.ts
  - backend/src/services/helpers/jwo-rate.helper.ts
  - backend/src/services/job-work-issuance.service.ts
route: /job-work-orders
---

## Before you start
The processor must exist as a supplier. To actually send greige, the greige must already be in stock (its purchase order received).

## Create the order
1. Open **Manufacturing → Job Work Dashboard** in the sidebar, then click **Job Work Orders**.
2. Click **New Job Work Order**. The **New Job Work Order** dialog opens.
3. Pick **Process Type *** — Dyeing, Printing, Embroidery, Washing, Finishing, Cutting, Stitching / CMT, Handwork, Smocking, Kaaj-Button, Transportation.
4. On **Dyeing**, pick **Material *** — **Fabric (cloth)** or **Lace**. Lace is only offered on Dyeing.
5. **Style (optional)** — type the style code and click it in the list.
6. **Processor *** — select the supplier doing the work.
7. **Quantity *** — in the unit shown (MTR, PCS or TRIP). Must be more than zero. On a lace job this is the **greige lace being sent**, not what comes back.
8. **Rate *** — must be more than zero. Not shown for Kaaj-Button. Dyers are paid per metre **returned**. On a Dyeing or Printing stock job it fills in from the processor's rate card once you have picked the greige (see below) — overwrite it if this processor agreed something else.
9. **Expected Return** — the date you need it back.
10. **Remarks** — optional, up to 500 characters.
11. Click **Create Draft JWO**.

## Extra fields by process type
- **Dyeing with Material = Lace**: pick the **Greige Lace *** you are sending and the **Dyed Variant Expected Back ***. If the shade does not exist yet, type it in the box under the dropdown and click **Create** — the variant is created (or reused if someone already made it) and selected for you. **Expected Shrinkage (%)** is filled from the greige lace master; leave it as is unless this dyer contracted something else. The line under it shows the dyed lace expected back, which is also what the dyer bills for.
- **Dyeing / Printing / Finishing with no style** (a cloth stock job): pick **Greige (cloth going out) *** first, then fill **Colour**, **Finished Width (inches)** and **Expected Shrinkage (%)**. Colour is required for Dyeing and Printing. On **Printing** also pick **Print type *** — Pigment, Procian, Discharge or Pigment + Discharge — because printers quote each separately.

### The rate and the shrinkage fill themselves in
On a Dyeing or Printing stock job, as soon as the **Processor**, the **Greige** (and on printing the **Print type**) are set, the system reads that processor's rate card for that cloth at your quantity and fills in:
- **Expected Shrinkage (%)** — the line under it reads *From this processor's rate card: 8% (1000-1500m)*.
- **Rate** — the line under it reads *Rate card: ₹10.00/m @ 1000-1500m for this quantity*. If you type a different rate the line turns amber and says *differs from the typed rate*; the job keeps your rate and records the card's as the difference.

Both figures stay editable — type over either one and it will not be overwritten again. If the processor has no rate card for that cloth, the shrinkage falls back to the greige's own average (the line says so) and the rate must be typed. Changing the quantity can move the job into another quantity slab and change the rate.
- **Embroidery**: pick **Fabric Lot** and **Embroidery Design (optional)**.
- **Kaaj-Button**: fill **Buttonholes (count)**, **Rate/buttonhole**, **Buttons (count)**, **Rate/button**. At least one count must be more than zero.

## Send the material out
1. Open the new order from the list. It is in **Draft**.
2. Click **Approve**. The status becomes **Approved**.
3. Click **Issue to Processor**. This button only appears while the order is **Approved** — there is no other status that can issue.
4. Under **Greige Lots ***, pick the lot and quantity. Use **Add lot** to split across lots, or **Auto-fill**. The total must match the order, shown as "matches the order". Only lots of the greige the order names are offered — that is the cloth its rate and shrinkage were quoted on. On a lace job the list holds the greige lace lots instead, and every lot must be the lace the order names.
5. Fill **Vehicle Number** if you know the truck. You do not type a challan number — the system assigns it.
6. Click **Issue & Create Challan**. The confirmation shows the challan number that was created.

## Traps
- Dyeing or Printing **with** a style shows a message pointing to **Go to Processing** — that flow is created on the Processing page instead. Clear the Style field to raise it here as a stock job. Lace is the exception: a lace job stays on this dialog whether or not a style is set.
- **Expected Shrinkage** must be under 100.
- The rate and the shrinkage need the processor **and** the greige (and the print type on printing) before they can fill in — pick those first. Until then both fields stay blank.
- Issuing a lot of a different greige than the order names is refused: "Lot … is … , but this order was raised for GRG-0035 … Pick a lot of that greige, or raise a separate job work order."
- All lot rows must be the same greige. One job work order sends one cloth.
- The dyed variant must have been created from the greige lace being sent. Picking a variant of a different lace is refused — use the **Create** box to make the right one.
- A lace job cannot also carry a fabric, and lace is refused on any process type other than Dyeing.
- A cancelled order shows a disposition dialog asking what happened to the material: **Returned to Stock** (credits it back), **At Processor** (keeps it there for future use), **Written Off**, **Transferred** (to another JWO), or **Returned to Supplier**. Complete this step to finish the cancellation.
- Sending several orders to one processor on one truck? Use **Manufacturing → Dispatch to Processor** instead, and click **Send on one challan**.
