---
slug: embroidery-dashboard
title: Use the Embroidery Piece Dashboard
keywords:
  # English
  - embroidery dashboard
  - piece tracking
  - kadai dashboard
  - embroidery pieces
  - cut piece tracking
  - embroidery status
  - overdue embroidery
  - pending embroidery
  - receive embroidery
  # Hinglish
  - embroidery dashboard dekhna
  - kadai status
  - embroidery piece kaise dekhe
  - kadai ka kaam track karna
  - embroidery pending check
  # Devanagari (MANDATORY)
  - एम्ब्रॉयडरी डैशबोर्ड
  - कढ़ाई स्टेटस
  - एम्ब्रॉयडरी पीस ट्रैकिंग
  - कढ़ाई का काम
  - पेंडिंग कढ़ाई
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/EmbroideryPieceDashboard.tsx
route: /embroidery-stock/pieces
---

## Steps

1. Press **Ctrl+K** and type "Embroidery Pieces" or navigate to **Manufacturing > Embroidery** in the sidebar.

2. The dashboard shows cut pieces sent for embroidery work (post-cutting stage, not fabric meters).

3. **View summary cards** at the top:
   - **Total Sent** - All send-outs with total pieces count
   - **Pending** - Batches still with the vendor (status: SENT)
   - **Partial** - Partially received back
   - **Received** - Fully received
   - **Overdue** - Past expected return date (highlighted in red)

4. **Search and filter:**
   - Use the search box to find by batch number, vendor name, or work order number
   - Use the Status dropdown to filter: All Status, Sent, Partially Received, Received, Cancelled

5. **Review the table** showing:
   - **Batch #** - Unique identifier for the send-out
   - **Work Order** - Associated work order number
   - **Embroidery** - Design name
   - **Vendor** - Embroidery contractor name
   - **Sent** - Quantity sent (PCS)
   - **Received** - Quantity received back (PCS)
   - **Send Date** - When pieces were sent
   - **Return Date** - Expected or actual return date (overdue shows in red)
   - **Days** - Days elapsed (running count if not received)
   - **Status** - Current status badge

6. **Actions available:**
   - Click **Receive** to record pieces returned from the vendor (available for SENT or PARTIALLY_RECEIVED)
   - Click the **X** icon to cancel a send-out (only for SENT status, requires a reason)

7. **Create new send-out:** Click **+ New Piece Send-Out** button in the top-right corner.

## Understanding the metrics

| Card | Meaning |
|------|---------|
| Total Sent | All embroidery piece send-outs ever created |
| Pending | Pieces currently at the vendor |
| Partial | Vendor returned some pieces, balance pending |
| Received | All pieces received back |
| Overdue | Pending/Partial past expected return date |

The **Days** column shows:
- Completed send-outs: actual days taken (send to receive)
- In-progress: days since send date, followed by "..."

## Traps

- **Overdue highlight**: Rows past their expected return date appear with a red background. Follow up with the vendor immediately.

- **Cancel vs Receive**: You cannot cancel a partially received send-out. Either complete the receive or adjust quantities.

- **This is NOT fabric stock**: This dashboard tracks cut garment pieces sent for embroidery work. Fabric meter tracking is in Embroidery Stock under Inventory.

- **Permission required**: Requires the `embroideryStock` permission to access this page.
