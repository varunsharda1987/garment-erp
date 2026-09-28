---
slug: embroidery-piece-receive
title: Receive Embroidered Pieces
keywords:
  # English
  - receive embroidery
  - embroidery inward
  - kadai receive
  - embroidery receipt
  - receive cut pieces
  - embroidered pieces
  - embroidery piece receive
  # Hinglish
  - embroidery receive karna
  - kadai wapas aana
  - embroidery pieces wapas
  - kadai ka kaam receive
  - cut piece embroidery receive
  # Devanagari (MANDATORY)
  - कढ़ाई रिसीव
  - एम्ब्रॉयडरी इनवर्ड
  - कढ़ाई का काम वापस
  - एम्ब्रॉयडरी पीस रिसीव
  - कट पीस कढ़ाई वापसी
  - कढ़ाई फ़िल्टर
  # Filter / search
  - filter embroidery send-outs
  - embroidery vendor filter
  - kadai vendor se filter
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/EmbroideryPieceReceive.tsx
  - frontend/src/pages/EmbroideryPieceDashboard.tsx
  - frontend/src/components/filters/FilterBar.tsx
  - frontend/src/components/SupplierCombobox.tsx
route: /embroidery-stock/piece-receive
---

## Before you start

You need pieces that were already sent out for embroidery work. The send-out must have status "Sent" or "Partial" to record a receipt.

## Steps

1. **Open Embroidery Pieces dashboard**
   - Press **Ctrl+K** and search "Embroidery Pieces"
   - Or navigate directly to `/embroidery-stock/pieces`
   - The page title is **Embroidery — Piece Tracking**

2. **Find the send-out to receive**
   - The dashboard shows summary cards: Total Sent, Pending, Partial, Received, Overdue
   - Use the filter row above the table:
     - The search box (**Search batch number, vendor, work order…**) finds a send-out by batch number, vendor or work order
     - The vendor picker (**All vendors**) is searchable — type a vendor name and pick it
     - The status dropdown (**All statuses**) filters to Sent, Partial, Received or Cancelled
   - Click **Clear N filters** to reset every filter and go back to page 1
   - If nothing matches, the table shows "No embroidery piece send-outs match these filters." with a **Clear filters** button
   - Overdue send-outs are highlighted in red

3. **Click Receive button**
   - Find the row with status "Sent" or "Partial"
   - Click the **Receive** button in the Actions column
   - This opens the Embroidery Piece Receive page

4. **Review send-out details**
   - The page shows: Batch number, Vendor, Embroidery design name, Qty Sent, Agreed Rate, Order number
   - Verify this is the correct send-out

5. **Enter quantities by SKU**
   - For each Color/Size combination:
     - **Received**: Enter quantity received (defaults to sent qty)
     - **Damaged**: Enter damaged quantity (defaults to 0)
   - The **Good** column auto-calculates: Received minus Damaged
   - Total row shows aggregate quantities

6. **Enter receipt details**
   - **Return Date** (required): Date pieces were received back
   - **Actual Cost**: Leave blank to use agreed rate, or enter final cost
   - **Invoice Number**: Vendor's invoice number (optional)
   - **Invoice Date**: Vendor's invoice date (optional)
   - **Remarks**: Quality notes or comments (optional)

7. **Save the receipt**
   - Click **Record Receipt** button
   - Success message: "Embroidered pieces received"
   - Page redirects to Embroidery Pieces dashboard

## Alternative: Direct link from send-out

If you have the send-out ID, navigate directly to `/embroidery-stock/piece-receive/{id}` to skip the selection step.

## Traps

- **Total received must be greater than 0**: You cannot record a receipt with zero total quantity
- **Damaged cannot exceed received**: Damaged quantity per SKU cannot be more than received quantity
- **Only pending send-outs**: You can only receive pieces from send-outs with status "Sent" or "Partial"
- **Partial receipts**: If you receive less than sent, the send-out becomes "Partial" until fully received
- **Shortages**: If pieces are lost/missing, record them as damaged or reduce received quantity
- **Rejections**: For quality rejections, enter them in the Damaged column with remarks explaining the issue

## After saving

- Send-out status updates to "Received" (full) or "Partial" (partial)
- Embroidered pieces are added back to inventory
- The dashboard summary cards update to reflect the new counts
- Pieces are available for the next production stage (stitching)
