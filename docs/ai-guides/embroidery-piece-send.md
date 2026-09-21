---
slug: embroidery-piece-send
title: Send Cut Pieces for Embroidery
keywords:
  # English
  - embroidery send out
  - send pieces
  - kadai send
  - embroidery dispatch
  - piece send out
  - cut pieces embroidery
  - embroidery pieces
  # Hinglish
  - embroidery ke liye bhejana
  - kadai bhejana
  - pieces bhejana
  - embroidery ka kaam
  - kadai ke liye
  # Devanagari
  - कढ़ाई भेजना
  - पीस भेजना
  - एम्ब्रॉयडरी डिस्पैच
  - कढ़ाई का काम
  - कटे पीस भेजना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/EmbroideryPieceSendOut.tsx
  - frontend/src/pages/EmbroideryPieceDashboard.tsx
route: /embroidery-stock/piece-send-out
---

## Before you start

1. **Work Order** must exist with status PENDING or IN_PRODUCTION
2. **Job Work Order** for EMBROIDERY must be created for that work order (generate from work order's service requirements)
3. **Cutting batch** must be COMPLETED with good pieces available
4. Know the **agreed rate per piece** with the embroidery vendor

## Steps

1. Open the **Embroidery Pieces** dashboard:
   - Press **Ctrl+K** and search "Embroidery Pieces"
   - Or navigate via Manufacturing > Embroidery > click link to Pieces

2. Click **New Piece Send-Out** button (top right)

3. **Step 1 - Select Work Order:**
   - Click the **Select work order...** dropdown
   - Choose the work order (shows: WO number, style code, style name, quantity)

4. **Step 2 - Select Job Work Order & Design:**
   - **Job Work Order (Required):** Select from dropdown (shows: JWO number, vendor name, status)
   - **Embroidery Design (Optional):** Select embroidery design if applicable (shows: code and design name)

5. **Step 3 - Select Cutting Batch:**
   - Click **Select cutting batch...** dropdown
   - Choose a COMPLETED batch (shows: batch number and status)

6. **Step 4 - Enter Quantities per SKU:**
   - Table shows: Color, Size, Available (good pieces from cutting)
   - Enter **Qty to Send** for each SKU (cannot exceed Available)
   - Total pieces count shown at bottom

7. **Step 5 - Send-Out Details:**
   - **Agreed Rate (per piece)** - required, enter the rate in rupees
   - **Send Date** - defaults to today, adjust if needed
   - **Expected Return Date** - optional, for tracking overdue returns
   - **Remarks** - optional notes

8. Review the summary box showing: Vendor, Quantity (PCS), Estimated Total

9. Click **Create Send-Out**

## Traps

- **No Job Work Order found:** You must first generate an EMBROIDERY job work order from the work order's service requirements page
- **No cutting batch available:** Cutting must be completed first with good pieces recorded
- **Qty exceeds Available:** Cannot send more pieces than available in the cutting batch
- **Missing required fields:** Work Order, Job Work Order, Cutting Batch, Agreed Rate, and Send Date are all required

## After saving

- Send-out record created with status **SENT**
- Pieces tracked under the selected job work order
- View all send-outs on the Embroidery Pieces dashboard
- Dashboard shows: Total Sent, Pending, Partial Received, Received, Overdue counts
- When pieces return, use the **Receive** button to record receipt
- Overdue returns highlighted in red on the dashboard
