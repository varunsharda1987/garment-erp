---
slug: asn-create
title: Create an Advanced Shipping Notice (ASN)
keywords:
  # English
  - ASN
  - advanced shipping notice
  - advance shipping notice
  - shipment notification
  - pre-shipment
  - dispatch notification
  - shipping plan
  - create ASN
  - ASN reconciliation
  - dispatched against ASN
  # Hinglish
  - ASN kaise banaye
  - shipping notice
  - shipment advance intimation
  - dispatch notice banana
  - shipment plan
  - ASN ke against kitna gaya
  # Devanagari
  - एएसएन
  - एडवांस शिपिंग नोटिस
  - शिपमेंट सूचना
  - डिस्पैच नोटिस
  - शिपमेंट प्लान
  - एएसएन मिलान
  # No colour
  - ASN without colour
  - style has no colour
  - colour optional
  - no size breakup
  - bina colour ka ASN
  - बिना रंग
  - रंग नहीं है
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/ASNCreateForm.tsx
  - frontend/src/pages/ASNDetail.tsx
  - frontend/src/pages/DispatchList.tsx
  - frontend/src/types/dispatch.types.ts
route: /manufacturing/dispatch/asn/new
---

## Before you start

- You need an existing production order (Work Order) that has items ready for dispatch.
- Orders with status CANCELLED or SPLIT are not available for ASN creation.
- If the order has a size breakup, you plan quantities per SKU (colour and size). Only the size is needed — a style with no colour is planned per size. Without a size breakup, only the total quantity is recorded.

## Steps

1. Open **Manufacturing → Dispatch** in the sidebar.

2. Click **New ASN** (top right). The page **Create ASN** opens.

3. In the **Select Order** card, click the search dropdown and search for your order by order number or customer name.

4. Select the order. The system displays:
   - **Order Number**
   - **Customer** name
   - **Total Quantity** (in pieces)
   - **Expected Delivery** date

5. In the **SKU Breakdown** table, review each line showing:
   - **Style** — the **Buyer Style Code** in bold, with the style name (and our Style Code, when it differs) under it
   - **Color** (with colour swatch if available; **—** for a style with no colour)
   - **Size**
   - **Order Qty** (original order quantity)
   - **Planned Qty** (quantity you plan to ship)

6. Adjust the **Planned Qty** for each SKU line using:
   - The number input field, or
   - The **+** and **-** buttons on the right

7. In the **Shipping Details** card, fill in:
   - **Requested Ship Date** — the date you plan to ship
   - **Cartons Planned** — number of cartons for this shipment (optional)
   - **Remarks** — any additional notes (optional)

8. Review the **Total Planned Quantity** shown at the bottom of the SKU table.

9. Click **Create ASN**.

10. The system creates the ASN with status **Pending** and redirects you to the ASN detail page.

## After saving

- The ASN is created in **Pending** status.
- Click **Submit to Buyer** to send the ASN for buyer approval (changes status to **Applied**).
- Once the buyer responds:
  - **Approve** — Enter appointment date, time, buyer reference number, and approved quantity. Status changes to **Approved**.
  - **Reschedule** — Buyer requests a new date. Status changes to **Reschedule**.
  - **Reject** — Buyer declines with a reason. Status changes to **Rejected**.
- After approval, click **Create Delivery Note** to proceed with actual dispatch. The delivery note is linked to this ASN.
- The ASN page then shows **Dispatched against this ASN**: per colour (**-** for a style with no colour) and size, **Planned**, **Dispatched** and **Variance**, an overall badge (**Not dispatched**, **Fully reconciled**, **Over**, **Under**) and links to its delivery notes. A note counts once it is dispatched; a pending or cancelled note does not.
- Shipping more or less than the buyer approved is not blocked — the variance shows it.

## Traps

- If the order has no size breakup, the ASN records only the total quantity (no per-SKU detail). The system shows an alert: "This order has no size/colour breakup yet, so the ASN can only record the total quantity — not a per-SKU plan." Such lines show **no size breakup** and their Planned Qty cannot be edited. A line that has a size but no colour is NOT one of these — it is planned per SKU as usual.
- You cannot mix SKU lines with and without a size breakup in the same ASN. If some of the order's items have sizes and others do not, **Create ASN** is refused ("Some lines have no size breakup and cannot be planned per SKU…"). The lines without sizes cannot be edited here, so add the sizes to those items on the order first.
- The **+** button stops at the line's **Order Qty**, but a number typed into the box is not capped — check each line against **Order Qty** before saving.
- An ASN with zero total planned quantity cannot be created.
