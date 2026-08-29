---
slug: production-status-track
title: Track Production Progress
keywords:
  - production status
  - track production
  - progress
  - status dashboard
  - WIP
  - production run status
  - kitna ban gaya
  - production ka status kaise dekhe
  - प्रोडक्शन
  - स्थिति
  - ट्रैक
  - प्रगति
  - कटिंग
  - सिलाई
  - delayed orders
  - kanban board
  - board view
  - compact view
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/ProductionStatus.tsx
  - frontend/src/components/status/StatusFilterBar.tsx
  - frontend/src/components/status/StatusSummaryCards.tsx
  - frontend/src/pages/WorkOrderList.tsx
  - frontend/src/pages/WorkOrderDetail.tsx
  - frontend/src/pages/CuttingList.tsx
  - backend/src/schemas/workOrder.schema.ts
---

There are three screens for progress. Use the one that matches your question.

## A. Overall picture (all orders)
1. Click **Production Status** in the sidebar. It sits at the top, above the groups. The page is titled **Production Status Dashboard**.
2. Use the toggle at the top right: **By Order** (default) or **By Style**.
3. Next to it, pick how the list is drawn: **Detailed** (full cards), **Compact** (one line per order), or **Board** (a kanban board grouped by stage). The Compact and Board views work in the By Order view.
4. Read the five cards: **Total Orders**, **Running**, **Delayed**, **Needs Attention**, **Completed**.
5. Narrow the list with the **Filters & Search** bar. Click its header to expand or collapse it; **Clear all** removes every filter at once.
   - **Search** — style code, buyer or brand.
   - **Status** — All Status, Running, Completed, Delayed, Needs Attention.
   - **Production Stage** — for example In Cutting, In Stitching, In Finishing, In Printing, Ready to Ship.
   - **CAD Status** — Pending, In Progress, Approved.
   - **Sort By** — Order Date, Delivery Date, Status, Progress, Order Value. **Sort Order** switches between Descending (newest first) and Ascending (oldest first).
   - **Order Date** and **Delivery Date** — pick a date range.
   - **Quick Filter** — **Due this week** or **Overdue** set the delivery-date range in one click.
6. Click **Refresh** to pull fresh numbers. The same bar shows when the page last updated.

## B. One production run
1. Open **Manufacturing → Production Runs**.
2. Filter by **Status** (Pending, In Production, Completed, Dispatched, Cancelled) or **Priority**, or type in **Search**.
3. The **Quantity** and **Progress** columns show completed versus total pieces and a percent bar.
4. Click any row to open it. The **Status Overview** card repeats status, priority, quantity and progress.
5. Scroll to **Manufacturing Progress**. It shows pieces done at **Cutting**, **Stitching** and **Finishing**, each with its own bar. Use **View Batches** or **View Issues** to drill down.

## C. Size-wise cutting progress
Open **Manufacturing → Cutting** and click the **Size-wise Status** tab. Each running style lists **Planned**, **Cut**, **Good Pcs** and **Pending** per size, plus days in cutting and idle days.

## Notes
- Completed quantity is calculated by the system from packing entries. It cannot be typed in by hand.
- A run past its **Planned End Date** is flagged as overdue; open the list with the overdue filter from the dashboard drill-down to see only those.
- A run marked **Split** is only a container. Production continues in the child runs listed on its page.
