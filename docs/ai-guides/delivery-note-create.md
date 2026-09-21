---
slug: delivery-note-create
title: Create a Delivery Note (DN) for Dispatch
keywords:
  # English
  - delivery note
  - dispatch
  - DN
  - shipment
  - shipping
  - delivery
  - send goods
  - finished goods dispatch
  - customer delivery
  - create DN
  # Hinglish
  - delivery note kaise banaye
  - dispatch karna
  - maal bhejana
  - shipment banana
  - customer ko maal bhejna
  - DN banana
  # Devanagari
  - डिलीवरी नोट
  - डिस्पैच
  - माल भेजना
  - शिपमेंट
  - डीएन बनाना
  - ग्राहक को माल भेजना
  - तैयार माल भेजना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DispatchDeliveryNoteForm.tsx
  - backend/src/schemas/dispatch.schema.ts
route: /manufacturing/dispatch/delivery/new
---

## Before you start

1. The **Order** must exist in the system with at least one item that has size breakup (Style / Color / Size / Quantity).
2. The **Customer** must be linked to the order (or you can select a different customer).
3. **Finished Goods (FG) Stock** should be available for the SKUs you want to dispatch. If stock is short, the system will still create the note but show a warning.

## Steps

1. Open **Manufacturing > Dispatch** in the sidebar.

2. Click **+ Create Delivery Note** (top-right button) or use the **Create Delivery Note** action from an existing ASN.

3. In the **Delivery Details** card:
   - Select the **Order *** by searching with order number or customer name. The box lists the 50 most recent orders; if it says **Showing the 50 most recent of …**, type part of the order number or the customer name to bring up an older one.
   - The **Customer *** auto-fills from the selected order. You can change it if needed.
   - Set the **Delivery Date *** (defaults to today).

4. In the **Items** card:
   - The system pre-fills items from the order's SKU breakup.
   - For each row, verify or select:
     - **Style** (from styles on the order)
     - **Color** (from the selected style's color options)
     - **Size** (from the selected style's size options)
     - **Quantity** (number of pieces to dispatch)
   - Click **Add Item** to add more rows.
   - Click the trash icon to remove a row.

5. Optionally, add notes in the **Remarks** field.

6. Click **Create Delivery Note** to save.

## Creating from an ASN

When you click **Create Delivery Note** from an approved ASN:
- The form opens with `?asnId=...` in the URL.
- The order and items are pre-filled from the ASN's shipment plan.
- The remarks auto-populate with "Against ASN {number}".
- The delivery note links to the ASN for tracking.

## Traps

- Every item row must have **Style**, **Color**, and **Size** selected. Leaving any blank will show an error.
- **Quantity** must be a positive whole number (no decimals, no zero).
- You need at least one item row with valid data. An empty items list blocks submission.
- If FG stock is insufficient, the note still gets created but you will see a **warning toast** listing the shortfalls (e.g., "requested 50, deducted 30").
- Changing the **Style** on a row clears the Color and Size selections because they depend on the style.

## After saving

- The delivery note is created with status **PENDING**.
- You return to the Dispatch list page.
- From the list, you can:
  - **Dispatch** the note (mark it as in-transit).
  - **Record POD** (Proof of Delivery) when the customer receives the goods.
  - **Print** the delivery note document.
- The dispatched quantity updates on the linked order.
