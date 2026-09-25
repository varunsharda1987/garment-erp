---
slug: delivery-note-pod
title: Record Proof of Delivery (POD)
keywords:
  # English
  - proof of delivery
  - POD
  - delivery confirmation
  - received confirmation
  - delivery status
  - customer GRN
  - shortage
  - rejection
  - partial delivery
  - received quantity
  - short received
  # Hinglish
  - POD kaise dale
  - delivery confirm karna
  - maal pahuncha
  - delivery note complete
  - goods received
  - kam maal pahuncha
  - partial delivery kaise dale
  # Devanagari
  - पीओडी
  - प्रूफ ऑफ डिलीवरी
  - डिलीवरी कन्फर्म
  - माल पहुंचा
  - डिलीवरी स्टेटस
  - रिसीव्ड कन्फर्मेशन
  - कम माल पहुंचा
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DispatchPODForm.tsx
  - frontend/src/pages/DispatchDeliveryNoteDetail.tsx
  - frontend/src/types/dispatch.types.ts
route: /manufacturing/dispatch
---

## Before you start

You need a delivery note that is **In Transit** status. POD cannot be recorded for notes that are still Draft, Pending, or already Delivered.

## Steps

1. Open **Manufacturing -> Dispatch** in the sidebar.

2. Find the delivery note you want to confirm delivery for.

3. Click **View** to open the delivery note detail page.

4. Click the **Record POD** button (only visible when status is In Transit).

5. In the **Proof of Delivery Details** section, fill in:
   - **Delivery Date** (required) - when goods were delivered
   - **Delivery Time** (optional) - time of delivery
   - **Received By** (required) - name of person who received the goods
   - **Designation** (optional) - receiver's job title (e.g. Store Manager)

6. Select the **Delivery Status**:
   - **Delivered** - all items received in full
   - **Partial** - some items missing. A **Received on each line** table appears (Style, Colour, Size, Sent, **Received**): type what actually arrived on each line. The **Short** total is worked out for you.
   - **Rejected** - delivery refused (you must enter **Rejection Reason**)

7. Tick **Customer sign-off received** if the customer signed the delivery documents.

8. In the **Customer GRN Details** section (optional):
   - **Customer GRN Number** - the GRN number issued by customer
   - **Customer GRN Date** - date when customer issued the GRN

9. Add any **Remarks** if needed.

10. Click **Record POD** to save.

## Traps

- You cannot record POD if the delivery note is not **In Transit**. The note must first be dispatched.
- If you select **Partial** delivery, every line needs a **Received** quantity between 0 and what was sent, and at least one line must be short — if everything arrived, choose **Delivered** instead.
- If you select **Rejected**, you must provide a rejection reason or the save will fail.
- Once POD is recorded, the delivery note moves to **Delivered** status and cannot be changed.

## After saving

- The delivery note status changes to **Delivered**.
- The POD details (delivery date, received by, status, customer GRN) are saved and visible on the delivery note detail page.
- For **Partial** deliveries, each line's received quantity is saved (shown in the **Received** column on the delivery note). The short pieces of each size go back into finished-goods stock and, when the note was booked against a sale order, off that line's **Dispatched** quantity.
- For **Rejected** deliveries, the rejection reason is stored for follow-up. The goods go back into finished-goods stock and, when the note was booked against a sale order, that order's **Dispatched** quantity goes back down.
- Once delivered, **Create Invoice** appears on the delivery note — it bills what was received (not for a rejected delivery).

- The **Buyer PO** card on the delivery note shows the customer's PO number, delivery location and PO date, with a **View PO** link to open their PO document — useful for checking what was actually ordered before confirming delivery. It appears on notes booked against a sale order — raised from the sale order, or for a production order linked to one.
