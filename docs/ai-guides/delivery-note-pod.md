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
  # Hinglish
  - POD kaise dale
  - delivery confirm karna
  - maal pahuncha
  - delivery note complete
  - goods received
  # Devanagari
  - पीओडी
  - प्रूफ ऑफ डिलीवरी
  - डिलीवरी कन्फर्म
  - माल पहुंचा
  - डिलीवरी स्टेटस
  - रिसीव्ड कन्फर्मेशन
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DispatchPODForm.tsx
  - frontend/src/pages/DispatchDeliveryNoteDetail.tsx
  - frontend/src/types/dispatch.types.ts
route: /dispatch/delivery-notes
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
   - **Partial** - some items missing (you must enter **Shortage Quantity**)
   - **Rejected** - delivery refused (you must enter **Rejection Reason**)

7. Tick **Customer sign-off received** if the customer signed the delivery documents.

8. In the **Customer GRN Details** section (optional):
   - **Customer GRN Number** - the GRN number issued by customer
   - **Customer GRN Date** - date when customer issued the GRN

9. Add any **Remarks** if needed.

10. Click **Record POD** to save.

## Traps

- You cannot record POD if the delivery note is not **In Transit**. The note must first be dispatched.
- If you select **Partial** delivery, you must enter the shortage quantity or the save will fail.
- If you select **Rejected**, you must provide a rejection reason or the save will fail.
- Once POD is recorded, the delivery note moves to **Delivered** status and cannot be changed.

## After saving

- The delivery note status changes to **Delivered**.
- The POD details (delivery date, received by, status, customer GRN) are saved and visible on the delivery note detail page.
- For **Partial** deliveries, the shortage quantity is recorded for reconciliation.
- For **Rejected** deliveries, the rejection reason is stored for follow-up.

- The **Buyer PO** card on the delivery note shows the customer's PO number, delivery location and PO date, with a **View PO** link to open their PO document — useful for checking what was actually ordered before confirming delivery. It appears only on notes raised from a sale order.
