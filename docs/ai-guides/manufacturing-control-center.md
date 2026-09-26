---
slug: manufacturing-control-center
title: Use the Manufacturing Control Center
keywords:
  - control center
  - control centre
  - manufacturing alerts
  - overdue
  - vendor tracker
  - variance
  - kya pending hai
  - alert kaise dekhe
  - dashboard
  - कंट्रोल सेंटर
  - अलर्ट
  - पेंडिंग
  - देरी
  - मिल में माल
  - delivery place not decided
  - to be advised po
  - po kahan deliver hoga
  - डिलीवरी तय नहीं
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/ManufacturingControlCenter.tsx
  - frontend/src/services/manufacturingAlerts.service.ts
  - backend/src/config/control-center-panels.ts
route: /manufacturing
---

The Control Center is a read-only overview page. It shows what is late or stuck, and links straight to the screen where you fix it. Nothing is created here.

## Open it
1. Open **Manufacturing → Control Center** in the sidebar. The **Manufacturing Control Center** page opens with the line "What needs your attention right now".
2. The page refreshes itself every minute. **Last updated** shows the time. Click **Refresh** to reload now.

## Read the four stat cards
3. **Total Alerts**, **Items with Vendors**, **Due This Week** and **Overdue**. They turn red or amber only when the count is above zero.

## Alerts Requiring Action
4. This list shows only alert types that currently have items, and only the ones your role works on. Possible rows are **Overdue Lab Dips**, **Overdue Job Work Orders**, **Overdue Smocking / Handwork**, **Stuck Cutting Batches**, **Quality Failures**, **Pending Buyer Approvals**, **Overdue Challans** and **PO Delivery Place Not Decided** — a sent purchase order due within 3 days whose delivery place is still "to be advised", so the supplier is about to dispatch with nowhere to deliver.
5. Each row shows the count and **Oldest: N days**. Red means the oldest item is 14 days or more, amber means 7 to 13 days.
6. Click any row. It opens the matching list, for example **Overdue Job Work Orders** opens Job Work Orders and **PO Delivery Place Not Decided** opens Purchase Orders filtered to **Delivery: to be advised**. Open the PO and use **Set delivery** on its **Deliver To** card; the alert clears as soon as a place is set.
7. If nothing is pending the card shows **All Clear!**.

## Materials with External Vendors
8. This table tracks goods lying with mills and processors: **Vendor**, **Type**, **Items**, **Qty**, **Oldest**, **Expected Back** and **Status**.
9. **Status** reads **On Track**, **Due Soon** or **Overdue**. Overdue rows are highlighted. Use the arrow button on the right to open that vendor's process list.

## Variance Watchtower
10. Items that crossed the variance threshold, grouped as **Cutting Variance**, **GRN Over-Receipt**, **GRN Under-Receipt** and **Cost Variance**.
11. Only the first five rows per group are listed, with a "+N more" line below. Click a row to open that document and investigate.

## Notes
- Counts are calculated live from the other modules. To clear an alert you must fix it in that module, not here.
- Stitching and finishing delays do not appear here. Check the **Size-wise Status** tab on those pages instead.
