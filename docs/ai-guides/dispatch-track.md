---
slug: dispatch-track
title: Track Dispatch Status
keywords:
  # English
  - dispatch status
  - shipment tracking
  - delivery status
  - dispatch list
  - pending dispatch
  - in transit
  - delivery note status
  - asn status
  - delivery tracking
  - proof of delivery
  - pod status
  - cancel delivery note
  - delivery note galti se bana
  - cancelled delivery note
  # Hinglish
  - dispatch status dekhna
  - shipment kahan hai
  - delivery track karna
  - dispatch list kholna
  - maal kahan pahuncha
  - truck kahan hai
  - delivery note dekhna
  - delivery note cancel karna
  # Devanagari
  - डिस्पैच स्टेटस
  - शिपमेंट ट्रैकिंग
  - डिलीवरी स्टेटस
  - डिस्पैच लिस्ट
  - पेंडिंग डिस्पैच
  - इन ट्रांजिट
  - डिलीवरी नोट
  - प्रूफ ऑफ डिलीवरी
  - डिलीवरी नोट रद्द करें
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DispatchList.tsx
  - frontend/src/pages/DispatchDeliveryNoteDetail.tsx
  - frontend/src/types/dispatch.types.ts
route: /manufacturing/dispatch
---

## Steps

1. Open **Manufacturing > Dispatch** in the sidebar.
2. The page shows **summary cards** at the top:
   - **Total Deliveries** - all delivery notes
   - **Pending** - notes not yet dispatched
   - **In Transit** - goods currently shipping
   - **Delivered** - completed deliveries
   - **ASN Pending** - ASN applications awaiting action
3. Use the **tabs** to switch between:
   - **Delivery Notes** - actual shipments
   - **ASN Applications** - advance shipping notices

## Finding a specific delivery

1. In the **Delivery Notes** tab, use the search box.
2. Search by delivery note number (DN #), order number, or customer name.
3. Use the **status filter** dropdown to narrow results:
   - **All Statuses**
   - **Pending** - ready to dispatch
   - **In Transit** - shipped, awaiting delivery
   - **Delivered** - confirmed received
   - **Cancelled** - pending notes that were cancelled (the record is kept)
4. Click **Search** or press Enter.

## Understanding delivery note statuses

| Status | Meaning |
|--------|---------|
| **Pending** | Delivery note created but not yet dispatched. Transport can be assigned. |
| **In Transit** | Goods dispatched and on their way to customer. POD can be recorded. |
| **Delivered** | Customer has received goods. Proof of Delivery recorded. |
| **Cancelled** | A pending note undone before the goods left. Its stock and the sale order's Dispatched quantity were handed back; the note keeps its number and shows who cancelled it, when and why. |

## Viewing delivery note details

1. Find the delivery note in the list.
2. Click the **eye icon** in the Actions column.
3. The detail page shows:
   - **Delivery Details** card: Order number, Customer, Dispatch Date, Total Pieces, Cartons, ASN reference, Remarks
   - **Transport** card: Transporter name, Vehicle number and type, Driver name and phone, LR No, Expected Delivery date
   - **Proof of Delivery** card (if delivered): Delivery date, Received By, Delivery status, Customer GRN, Shortage qty, Rejection reason
   - **Items** table: Style, Buyer Ref, Color, Size, Quantity, and **Received** once the proof of delivery is recorded
   - A red box on a **Cancelled** note (when, and the reason), and a note if an administrator let it ship past finished-goods stock
4. Buttons at the top: **Cancel Delivery Note** (Pending), **Record POD** (In Transit), **Create Invoice** (Delivered, not yet invoiced), or **Invoice INV…** to open the invoice already raised.

## Cancelling a delivery note made by mistake

1. Only a **Pending** note can be cancelled — once it is dispatched, record its proof of delivery as **Rejected** instead.
2. Click the **X icon** on its row (or **Cancel Delivery Note** on the note).
3. Type a **Reason \*** and click **Cancel Delivery Note**.
4. The pieces go back into finished-goods stock and come off the sale order's Dispatched quantity. The note stays in the list, marked **Cancelled**.

## Checking ASN application status

1. Switch to the **ASN Applications** tab.
2. Search by ASN number or order number.
3. Filter by status:
   - **Pending** - ASN created, not yet applied
   - **Applied** - Submitted to customer, awaiting response
   - **Approved** - Customer approved the shipment window
   - **Rejected** - Customer rejected the request
   - **Rescheduled** - Appointment moved to a new date
4. The table shows: ASN #, Order, Requested Ship Date, Planned Qty, Cartons, Appointment (date and time), Status.

## Table columns explained

### Delivery Notes table
- **DN #** - Delivery note number
- **Order** - Production order number
- **Customer** - Customer name
- **Dispatch Date** - When goods were/will be shipped
- **Qty** - Total pieces in the shipment
- **Cartons** - Number of cartons
- **Status** - Current delivery status
- **Customer GRN** - Customer's goods receipt number (after delivery)

### ASN Applications table
- **ASN #** - Advance shipping notice number
- **Order** - Production order number
- **Requested Ship Date** - Date you want to ship
- **Planned Qty** - Number of pieces planned
- **Cartons** - Number of cartons planned
- **Appointment** - Confirmed delivery slot (date and time)
- **Status** - ASN workflow status

## Quick actions from the list

### For Pending delivery notes
- **Truck icon** - Assign transport (vehicle, driver, transporter)
- **Send icon** - Mark as dispatched (moves to In Transit)
- **X icon** - Cancel the note (asks for a reason; the record is kept)

### For In Transit delivery notes
- **Check icon** - Record Proof of Delivery

### For Delivered delivery notes
- **Document icon** - Invoice: opens the note with **Create Invoice** (or its invoice, if already raised)

### For Pending ASN applications
- **Send icon** - Apply ASN (submit to customer)

### For Applied ASN applications
- **Check icon** - Approve ASN
- **Calendar icon** - Reschedule appointment
- **X icon** - Reject ASN

### For Approved ASN applications
- **Package icon** - Create Delivery Note from ASN

## Traps

- The **Customer GRN** column only shows data after POD is recorded. If blank, it means either delivery is pending or POD was not captured.
- **In Transit** does not automatically change to **Delivered**. Someone must record the POD.
- ASN **Approved** status means the customer accepted the shipment window. You still need to create the actual Delivery Note.
- Use the **Refresh** button (top right) to see the latest status if shipments were recently updated.

- The **Buyer PO** card on a delivery note shows the customer's own purchase orders for that sale order — PO number, delivery location and PO date — with a **View PO** link that opens their PO document. It appears on every note booked against a sale order — raised from the sale order, or for a production order linked to one; a production order with no sale order shows nothing. Opening the PO needs you to be signed in.
