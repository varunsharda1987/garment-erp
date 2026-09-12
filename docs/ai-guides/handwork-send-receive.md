---
slug: handwork-send-receive
title: Send and Receive Handwork
keywords:
  # English
  - handwork
  - hand embroidery
  - handwork send
  - handwork receive
  - handwork send out
  - handwork dashboard
  - external process
  - stitching issue
  - handwork vendor
  # Hinglish
  - handwork bhejana
  - handwork lena
  - haath ka kaam
  - haath ka kaam bhejein
  - vendor ko bhejein
  # Devanagari
  - हैंडवर्क
  - हाथ का काम
  - हैंडवर्क भेजना
  - हैंडवर्क लेना
  - वेंडर को भेजना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/HandworkDashboard.tsx
  - frontend/src/pages/HandworkSendOut.tsx
  - frontend/src/pages/HandworkReceive.tsx
route: /handwork
---

Handwork is an external process done after stitching (post-stitching, pre-finishing). This guide covers sending stitched pieces to a handwork vendor and receiving them back.

## View handwork dashboard

1. Go to **Manufacturing** in the sidebar
2. Click **Handwork**
3. See the dashboard with:
   - **Summary cards**: Total Sent, Pending, Partial, Received, Overdue
   - **By Vendor** table: breakdown of work at each vendor
   - **Send-outs list**: all handwork batches with status and actions

## Send out for handwork

1. Go to **Manufacturing > Handwork**
2. Click **New Send-Out** button (top right)
3. **Step 1 - Select Work Order**: Choose a work order (PENDING or IN_PRODUCTION status)
4. **Step 2 - Select Job Work Order**: Choose a HANDWORK-type job work order for that work order
   - If no job work order exists, create one first from the work order's service requirements
5. **Step 3 - Select Stitching Issue**: Choose which stitching issue to send pieces from
6. **Step 4 - Enter Quantities per SKU**: Enter the quantity to send for each color/size combination
   - Available quantity shows what can be sent
   - Total shows sum of all quantities entered
7. **Step 5 - Send-Out Details**:
   - Enter **Agreed Rate** (per piece) - required
   - Confirm **Send Date** - required
   - Enter **Expected Return Date** - optional
   - Add **Remarks** - optional
8. Review the summary (Vendor, Quantity, Rate, Estimated Total)
9. Click **Create Send-Out**

## Receive handwork

### From the dashboard
1. Go to **Manufacturing > Handwork**
2. Find the send-out with status SENT or PARTIALLY_RECEIVED
3. Click **Receive** button in the Actions column

### From a direct link
1. Navigate to `/manufacturing/handwork/receive/:id` where :id is the send-out ID

### Recording the receipt
1. If not pre-selected, choose the pending send-out from the dropdown
2. Review the send-out details (batch, vendor, work order, style, qty sent, send date, agreed rate)
3. In the **Receive by SKU** table:
   - Enter **Received** quantity for each color/size
   - Enter **Damaged** quantity if any pieces are damaged
   - **Good** quantity calculates automatically (Received - Damaged)
4. Fill in **Receipt Details**:
   - Enter **Return Date** - required
   - Enter **Actual Cost** - optional (leave blank to use agreed rate)
   - Enter **Invoice Number** - optional
   - Enter **Invoice Date** - optional
   - Add **Remarks** - optional (e.g., quality notes)
5. Click **Record Receipt**

## Cancel a send-out

1. Go to **Manufacturing > Handwork**
2. Find a send-out with status SENT
3. Click the red X button in the Actions column
4. Enter a cancellation reason (required)
5. Click **Cancel Send-Out**
   - This reverses stock deductions and marks the send-out as CANCELLED

## Filter and search

- Use the **search box** to find by batch number, vendor name, or work order
- Use the **Status dropdown** to filter by: All Status, Sent, Partially Received, Received, Cancelled
- **Overdue** items are highlighted in red in the list

## Status meanings

| Status | Meaning |
|--------|---------|
| Draft | Not yet sent |
| Sent | With vendor, awaiting return |
| Partial | Some pieces received, more pending |
| Received | All pieces returned |
| Cancelled | Send-out was cancelled |

## Traps

- **No Job Work Order**: You must create a HANDWORK-type job work order for the work order before you can send pieces out. Generate it from the work order's service requirements first.
- **No Stitching Issue**: Handwork source is always a stitching issue. The stitching must be issued before handwork can be sent.
- **Quantity limits**: You cannot send more than the available quantity from the stitching issue.
- **Damaged pieces**: Enter damaged quantity separately from received - the system calculates good pieces automatically.
- **Overdue tracking**: If expected return date passes and status is still SENT or PARTIALLY_RECEIVED, the row turns red.
