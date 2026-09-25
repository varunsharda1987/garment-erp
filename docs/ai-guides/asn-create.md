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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ASNCreateForm.tsx
  - frontend/src/pages/ASNDetail.tsx
route: /manufacturing/dispatch/asn/new
---

## Before you start

- You need an existing production order (Work Order) that has items ready for dispatch.
- Orders with status CANCELLED or SPLIT are not available for ASN creation.
- If the order has size/colour breakup, you can plan quantities per SKU. If not, only total quantity is recorded.

## Steps

1. Open **Manufacturing → Dispatch** in the sidebar.

2. Click **Create ASN** (or navigate directly to the ASN creation page).

3. In the **Select Order** card, click the search dropdown and search for your order by order number or customer name.

4. Select the order. The system displays:
   - **Order Number**
   - **Customer** name
   - **Total Quantity** (in pieces)
   - **Expected Delivery** date

5. In the **SKU Breakdown** table, review each line showing:
   - **Style** (name and code)
   - **Color** (with colour swatch if available)
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
- The ASN page then shows **Dispatched against this ASN**: per colour and size, **Planned**, **Dispatched** and **Variance**, an overall badge (**Not dispatched**, **Fully reconciled**, **Over**, **Under**) and links to its delivery notes. A note counts once it is dispatched; a pending or cancelled note does not.
- Shipping more or less than the buyer approved is not blocked — the variance shows it.

## Traps

- If the order has no size/colour breakup, the ASN records only the total quantity (no per-SKU detail). The system shows an alert: "This order has no size/colour breakup yet, so the ASN can only record the total quantity."
- You cannot mix SKU lines with and without breakup in the same ASN. If some lines have no size breakup, either set their planned quantity to 0 or add sizes to the order first.
- The planned quantity cannot exceed the order quantity for any line.
- An ASN with zero total planned quantity cannot be created.
