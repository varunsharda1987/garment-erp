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
  - जॉब वर्क
  - प्रोसेसर
  - माल भेजना
  - रंगाई
  - कढ़ाई
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/JobWorkOrderList.tsx
  - frontend/src/components/JobWorkOrderCreateDialog.tsx
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/components/job-work/GreigeLotRows.tsx
  - frontend/src/pages/DispatchToProcessor.tsx
  - backend/src/schemas/jobWorkOrder.schema.ts
---

## Before you start
The processor must exist as a supplier. To actually send greige, the greige must already be in stock (its purchase order received).

## Create the order
1. Open **Manufacturing → Job Work Dashboard** in the sidebar, then click **Job Work Orders**.
2. Click **New Job Work Order**. The **New Job Work Order** dialog opens.
3. Pick **Process Type *** — Dyeing, Printing, Embroidery, Washing, Finishing, Cutting, Stitching / CMT, Handwork, Smocking, Kaaj-Button, Transportation.
4. **Style (optional)** — type the style code and click it in the list.
5. **Processor *** — select the supplier doing the work.
6. **Quantity *** — in the unit shown (MTR, PCS or TRIP). Must be more than zero.
7. **Rate *** — must be more than zero. Not shown for Kaaj-Button.
8. **Expected Return** — the date you need it back.
9. **Remarks** — optional, up to 500 characters.
10. Click **Create Draft JWO**.

## Extra fields by process type
- **Dyeing / Printing / Finishing with no style** (a stock job): fill **Colour**, **Finished Width (inches)** and **Expected Shrinkage (%)**. Colour is required for Dyeing and Printing.
- **Embroidery**: pick **Fabric Lot** and **Embroidery Design (optional)**.
- **Kaaj-Button**: fill **Buttonholes (count)**, **Rate/buttonhole**, **Buttons (count)**, **Rate/button**. At least one count must be more than zero.

## Send the material out
1. Open the new order from the list. It is in **Draft**.
2. Click **Approve**.
3. Click **Issue to Processor**.
4. Under **Greige Lots ***, pick the lot and quantity. Use **Add lot** to split across lots, or **Auto-fill**. The total must match the order, shown as "matches the order".
5. Fill **Vehicle Number** if you know the truck. You do not type a challan number — the system assigns it.
6. Click **Issue & Create Challan**. The confirmation shows the challan number that was created.

## Traps
- Dyeing or Printing **with** a style shows a message pointing to **Go to Processing** — that flow is created on the Processing page instead. Clear the Style field to raise it here as a stock job.
- **Expected Shrinkage** must be under 100.
- All lot rows must be the same greige. One job work order sends one cloth.
- Sending several orders to one processor on one truck? Use **Manufacturing → Dispatch to Processor** instead, and click **Send on one challan**.
