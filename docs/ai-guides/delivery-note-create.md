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
  - dispatch sale order
  - ship sale order
  - dispatched quantity
  - over shipment
  - extra pieces
  # Hinglish
  - delivery note kaise banaye
  - dispatch karna
  - maal bhejana
  - shipment banana
  - customer ko maal bhejna
  - DN banana
  - sale order ka maal bhejna
  - extra maal bhejna
  - dispatched quantity nahi badh rahi
  # Devanagari
  - डिलीवरी नोट
  - डिस्पैच
  - माल भेजना
  - शिपमेंट
  - डीएन बनाना
  - ग्राहक को माल भेजना
  - तैयार माल भेजना
  - सेल ऑर्डर का माल भेजना
  - ज़्यादा माल भेजना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DispatchDeliveryNoteForm.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - backend/src/schemas/dispatch.schema.ts
  - backend/src/controllers/dispatch.controller.ts
  - backend/src/services/helpers/sale-order-dispatch.helper.ts
route: /manufacturing/dispatch/delivery/new
---

## Before you start

1. The **Order** must exist in the system with at least one item that has size breakup (Style / Color / Size / Quantity).
2. The **Customer** must be linked to the order (or you can select a different customer).
3. **Finished Goods (FG) Stock** should be available for the SKUs you want to dispatch. If stock is short, the system will still create the note but show a warning.

## Steps

1. Open **Manufacturing > Dispatch** in the sidebar.

2. Click **+ Create Delivery Note** (top-right button) or use the **Create Delivery Note** action from an existing ASN.
   From a sale order you can also open **Actions** → **Create Delivery Note** on the sale order page (see *Dispatching a sale order* below).

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

## Dispatching a sale order

On the sale order page, open **Actions** and click **Create Delivery Note** (shown while the order is Confirmed, Partially/Fully Allocated or Partially Dispatched).
- If a production order is linked to the sale order, the form opens with that **Order** already selected.
- If there is no production order (goods sold from finished-goods stock), the form opens with the **Sale Order** shown in place of the Order box, and the items are pre-filled with what each sale order line still has to ship. A line ordered without a colour is filled with the style's colour when the style has only one.

Either way the page says **Booked against sale order …**: when you click **Create Delivery Note**, the sale order's **Dispatched** quantities go up and its status moves to Partially Dispatched / Dispatched. A delivery note for a production order that is linked to a sale order is always booked against that sale order, even when you start from **Manufacturing > Dispatch**.

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
- Stock reserved (allocated) for this sale order is used first. Stock reserved for a **different** sale order is never taken, even if it is on the shelf.
- A size cannot ship more than the buyer ordered — unless the customer has an **Over-shipment allowed (%)** set on the Customer page (for example 5 lets 100 ordered ship as up to 105). Anything above that is refused, naming the size and how many can still go.
- Against a sale order, every row must match one of its lines (same style and size; the colour must match, or the line was ordered without a colour). A size the sale order does not carry is refused.
- Changing the **Style** on a row clears the Color and Size selections because they depend on the style.

## After saving

- The delivery note is created with status **PENDING**.
- You return to the Dispatch list page.
- From the list, you can:
  - **Dispatch** the note (mark it as in-transit).
  - **Record POD** (Proof of Delivery) when the customer receives the goods.
  - **Print** the delivery note document.
- When the note is booked against a sale order, that sale order's **Dispatched** quantity and status update straight away (the House of Kasya B2B app sees the same numbers).
