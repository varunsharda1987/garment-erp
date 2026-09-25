---
slug: invoice-from-delivery-note
title: Create an Invoice from a Delivered Delivery Note
keywords:
  # English
  - invoice from delivery note
  - create invoice from DN
  - bill a delivery
  - invoice after delivery
  - invoice for shipment
  - invoice received quantity
  - partial delivery invoice
  - delivery note invoice
  # Hinglish
  - delivery note se invoice banana
  - maal pahunchne ke baad bill
  - DN ka invoice
  - dispatch ka bill banana
  - jitna pahuncha utna bill
  # Devanagari
  - डिलीवरी नोट से इनवॉइस
  - डिलीवरी का बिल
  - माल पहुंचने के बाद बिल
  - डीएन का इनवॉइस
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DispatchList.tsx
  - frontend/src/pages/DispatchDeliveryNoteDetail.tsx
  - frontend/src/pages/InvoiceDetail.tsx
  - frontend/src/services/invoice.service.ts
  - backend/src/services/invoice.service.ts
  - backend/src/schemas/invoice.schema.ts
route: /manufacturing/dispatch
---

## Before you start

1. The delivery note must be **Delivered** — its proof of delivery (POD) is recorded. An invoice is not raised before that.
2. A delivery the buyer **Rejected** has nothing to invoice.
3. Each style needs a selling price: the sale order line's price, or — for a production order with no sale order — the production order's unit price.
4. You need the **Invoices** permission.

## Steps

1. Open **Manufacturing > Dispatch** in the sidebar.
2. On a **Delivered** row, click the **document icon** (Invoice) — or open the delivery note and click **Create Invoice** at the top.
3. In **Create Invoice for DN-…**:
   - **Invoice Date \*** — today by default.
   - **Due Date \*** — today plus the customer's credit days (30 if none are set).
   - Check the **Billed (what the buyer received)** table: Style, Colour, Size, Qty. For a partial delivery each line shows the quantity received on the POD, not the quantity sent.
   - **Remarks** — optional.
4. Click **Create Invoice**. The invoice opens.

## Traps

- **Create Invoice** only shows on a Delivered note that has no invoice yet. Once invoiced, the button becomes **Invoice INV…**, which opens the invoice.
- One invoice per delivery note — a second attempt is refused, naming the invoice already raised.
- "No selling price for …" means the style has no price on the sale order or production order — set it there, then try again.
- GST (CGST + SGST, or IGST) is worked out from the customer's billing state; the customer must have a billing state.

## After saving

- The invoice page shows the **Delivery Note** it came from (click to open the note), the order, and the buyer's PO.
- From there: record payments, generate the e-invoice (IRN), push to Tally, or share the PDF — as for any invoice.
