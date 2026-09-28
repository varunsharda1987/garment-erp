---
slug: smocking-send-receive
title: Send and Receive Smocking Work
keywords:
  # English
  - smocking
  - smocking send
  - smocking receive
  - smocking send out
  - smocking wip
  - smocking work in progress
  - smocking external process
  - smocking vendor
  - smocking tracking
  - smocking overdue
  # Hinglish
  - smocking bhejana
  - smocking wapas
  - smocking ka kaam
  - smocking vendor ko bhejo
  - smocking receive karna
  - smocking pending
  # Devanagari
  - स्मॉकिंग
  - स्मॉकिंग भेजना
  - स्मॉकिंग वापस
  - स्मॉकिंग का काम
  - स्मॉकिंग वेंडर
  - स्मॉकिंग पेंडिंग
  - स्मॉकिंग रिसीव
  - smocking roll
  - smocking ke roll
  - kaunse roll bheje smocking
  - स्मॉकिंग रोल
  - स्मॉकिंग के थान
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/SmockingDashboard.tsx
  - frontend/src/pages/SmockingSendOut.tsx
  - frontend/src/pages/SmockingReceive.tsx
  - frontend/src/components/job-work/ThanPicker.tsx
  - backend/src/services/external-process.service.ts
route: /manufacturing/smocking
---

## View smocking dashboard

1. Go to **Manufacturing** > **Smocking**
2. The dashboard shows summary cards:
   - **Total Sent** - all send-outs created
   - **Pending** - awaiting return from vendor
   - **Partial** - partially received
   - **Received** - fully received
   - **Overdue** - past expected return date
3. A **By Vendor** table shows pending/received/overdue counts per vendor
4. The main table lists all smocking send-outs with status badges
5. Use the search box to find by batch number, vendor, or work order
6. Use the status dropdown to filter: Sent, Partially Received, Received, Cancelled

## Send out for smocking

1. Go to **Manufacturing** > **Smocking**
2. Click **New Send-Out** button (top right)
3. **Step 1 - Select Work Order**: Choose a work order (shows PENDING or IN_PRODUCTION orders)
4. **Step 2 - Select Job Work Order**: Select the SMOCKING job work order linked to this work order
   - If none exist, first generate one from the work order's service requirements
5. **Step 3 - Select Source**: Choose where the material comes from:
   - **Cutting Batch (Cut Pieces)** - for cut garment pieces
   - **Fabric Stock (Meters)** - for uncut fabric
6. Select the specific cutting batch or fabric stock lot
7. **Fabric Stock only — the lot's rolls / thans**: if the lot has a roll / than list (dyed or printed fabric received roll-wise or than-wise), it opens under the lot. Tick the rolls or thans you are sending — type the **Quantity (meters)** first, then **Pick rolls for me** ticks them in order for it (the last one can be a part) and **Best fit (whole rolls)** ticks whole rolls only. The ticked pieces decide the quantity sent: the **Quantity (meters)** box then shows what they come to and cannot be typed (the line under the list says "The quantity sent is what the ticked pieces come to."). Tick nothing to send a typed quantity without naming pieces. A lot with no list says so and goes by quantity.
8. **Step 4 - Enter Quantities per SKU** (cutting batch only):
   - Enter quantity to send for each color/size combination
   - Total is auto-calculated
9. **Step 5 - Send-Out Details**:
   - **Agreed Rate** - rate per piece or meter (required)
   - **Send Date** - date sent to vendor (required)
   - **Expected Return Date** - when work should return (optional)
   - **Remarks** - any notes (optional)
10. Review the summary showing vendor, quantity, rate, and estimated total
11. Click **Create Send-Out**
12. System redirects to dashboard with success message. The outward challan names the fabric lot the metres left, and the ticked rolls / thans are marked sent to this job.

## Receive smocking work

### From the dashboard
1. Go to **Manufacturing** > **Smocking**
2. Find the send-out with status **Sent** or **Partially Received**
3. Click **Receive** button in the Actions column

### From a direct link
1. The receive page can be opened directly with the send-out ID

### Enter receipt details
1. Review the **Send-Out Details** card showing:
   - Batch number, vendor, work order, style
   - Quantity sent, send date, agreed rate
2. **Receive by SKU** (if pieces were sent):
   - **Received** - enter actual quantity returned per color/size
   - **Damaged** - enter any damaged pieces
   - **Good** column shows received minus damaged
   - Total row shows overall counts
3. **Receive Quantities** (if fabric was sent):
   - **Quantity Received** - actual meters returned
   - **Quantity Damaged** - damaged meters (if any)
4. **Receipt Details**:
   - **Return Date** - actual date received (required)
   - **Actual Cost** - leave blank to use agreed rate, or enter actual cost
   - **Invoice Number** - vendor invoice reference (optional)
   - **Invoice Date** - vendor invoice date (optional)
   - **Remarks** - quality notes or comments (optional)
5. Click **Record Receipt**
6. System redirects to dashboard with success message

## Cancel a send-out

1. Go to **Manufacturing** > **Smocking**
2. Find a send-out with status **Sent**
3. Click the **X** (cancel) icon in Actions column
4. Enter a cancellation reason (required)
5. Click **Cancel Send-Out**
6. Stock deductions are reversed — the rolls / thans this send-out took go back on the lot's list — and the status becomes **Cancelled**

## Traps

- **No Job Work Order**: You cannot send out without a SMOCKING job work order. Generate one first from the work order's service requirements page
- **Source selection**: Cutting batch shows pieces (good for garment work), fabric stock shows meters (good for fabric-level work) - choose the right type
- **Roll list out of step**: if the lot's roll / than list does not match its metres, a warning shows above the list. Tick what goes or send by quantity, then fix the list with **Check rolls & thans** on the Fabric Stock page
- **A ticked roll with a blank or too-large metres** blocks the send-out — fix the metres or untick it
- **Quantity limits**: When entering SKU quantities, you cannot exceed the available count from the cutting batch
- **Overdue tracking**: Send-outs past their expected return date are highlighted in red on the dashboard
- **Partial receives**: If you receive less than sent, status becomes **Partially Received** and you can receive more later
- **Cancel only SENT**: You can only cancel send-outs that are still in SENT status - once any quantity is received, cancellation is blocked
