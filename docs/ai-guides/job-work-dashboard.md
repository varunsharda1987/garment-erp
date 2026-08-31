---
slug: job-work-dashboard
title: Track job work at processors
keywords:
  - job work dashboard
  - JWO tracking
  - track job work
  - maal kahan hai
  - outstanding at processor
  - section 143
  - ITC-04
  - ageing
  - processing batches
  - जॉब वर्क
  - ट्रैक
  - डैशबोर्ड
  - प्रोसेसर
  - बकाया
  - माल कहाँ है
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/JobWorkDashboard.tsx
  - frontend/src/pages/JobWorkOrderList.tsx
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/pages/StockMovementDashboard.tsx
---

## Steps
1. Open **Manufacturing → Job Work Dashboard** in the sidebar.
2. Read the four tiles at the top: **Active Batches**, **Quantity In Process**, **Quantity In Transit** and **Total Cost**.
3. The **Active Processing Batches** table lists **Batch #**, **Material**, **In Process** and **In Transit**. Click **View** on a row to open that batch, or **View All Batches** to open the full list.
4. Click **Job Work Orders** (top right) to see the orders themselves.

## On the Job Work Orders list
1. Four tiles show **Outstanding at Processors**, **Section 143 Warnings**, **Over Tolerance (Debit Due)** and **By Process Type**.
2. Search by JWO number, processor or style, or use the **Process Type** dropdown to filter to Dyeing, Printing, Embroidery, Stitching and so on.
3. The table shows **JWO Number**, **Process**, **Processor**, **Style**, **Greige**, **Fabric**, **Width**, **Qty Received**, **Sent Date**, **Need By**, **Status** and **Section 143**.
4. **Need By** turns red when the date has passed and nothing has come back. Closed and cancelled orders never turn red.
5. The **Section 143** column shows days out with a colour: green is OK, yellow is a warning past 270 days, red is critical past 300 days and breached past 365 days.
6. Click any row to open the order, or use the **⋯** menu for **View Details**, **Print JWO** and **Send via WhatsApp**.

## Inside one order
The detail page shows **Order Details**, **Quantities** (Greige, Fabric, Qty Received, Abnormal Loss), the four width figures, **Sent Date**, **Need By**, **Received Date**, **Days Outstanding**, and a **Reconciliation** table with **Sent Out**, **Received Back**, **With Processor** and **Abnormal Loss** per material. From this page you can **Approve**, **Issue to Processor**, **Receive Material**, **Compute Totals**, **Close Order**, or **Cancel**.

## Statutory reports
On the Job Work Dashboard, click **Ageing PDF**, **ITC-04 PDF** or **Vendor PDF** to open the statutory report as a PDF. ITC-04 and Vendor cover the last three months.

## Also useful
Open **Inventory → Movement Dashboard** for the **Pending Inward** and **Pending Outward** tabs. Pending Inward lists everything still lying at a processor with **Days Out**, and each row has a button that jumps straight to the screen where you act on it. Tick **Overdue only** to see just the late ones.
