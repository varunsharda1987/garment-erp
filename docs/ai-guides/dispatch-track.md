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
  # Hinglish
  - dispatch status dekhna
  - shipment kahan hai
  - delivery track karna
  - dispatch list kholna
  - maal kahan pahuncha
  - truck kahan hai
  - delivery note dekhna
  # Devanagari
  - डिस्पैच स्टेटस
  - शिपमेंट ट्रैकिंग
  - डिलीवरी स्टेटस
  - डिस्पैच लिस्ट
  - पेंडिंग डिस्पैच
  - इन ट्रांजिट
  - डिलीवरी नोट
  - प्रूफ ऑफ डिलीवरी
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
   - **Cancelled** - voided deliveries
4. Click **Search** or press Enter.

## Understanding delivery note statuses

| Status | Meaning |
|--------|---------|
| **Pending** | Delivery note created but not yet dispatched. Transport can be assigned. |
| **In Transit** | Goods dispatched and on their way to customer. POD can be recorded. |
| **Delivered** | Customer has received goods. Proof of Delivery recorded. |
| **Cancelled** | Delivery note was cancelled. |

## Viewing delivery note details

1. Find the delivery note in the list.
2. Click the **eye icon** in the Actions column.
3. The detail page shows:
   - **Delivery Details** card: Order number, Customer, Dispatch Date, Total Pieces, Cartons, ASN reference, Remarks
   - **Transport** card: Transporter name, Vehicle number and type, Driver name and phone, LR No, Expected Delivery date
   - **Proof of Delivery** card (if delivered): Delivery date, Received By, Delivery status, Customer GRN, Shortage qty, Rejection reason
   - **Items** table: Style, Buyer Ref, Color, Size, Quantity

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

### For In Transit delivery notes
- **Check icon** - Record Proof of Delivery

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

- The **Buyer PO** card on a delivery note shows the customer's own purchase orders for that sale order — PO number, delivery location and PO date — with a **View PO** link that opens their PO document. It only appears on notes raised from a sale order; a note raised from a production order has no sale-order link and shows nothing. Opening the PO needs you to be signed in.
