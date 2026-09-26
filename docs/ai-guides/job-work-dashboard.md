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
  - held at processor
  - no challan
  - maal dyer ke paas kitne din se
  - प्रोसेसर के पास माल
  - processing batches
  - lace dyeing
  - dyed lace
  - जॉब वर्क
  - ट्रैक
  - डैशबोर्ड
  - लेस
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
  - frontend/src/lib/section143.ts
  - backend/src/services/job-work-statutory.service.ts
  - backend/templates/kf/report-job-work-ageing.hbs
route: /job-work-orders
---

## Steps
1. Open **Manufacturing → Job Work Dashboard** in the sidebar.
2. Read the four tiles at the top: **Active Batches**, **Quantity In Process**, **Quantity In Transit** and **Total Cost**.
3. The **Active Processing Batches** table lists **Batch #**, **Material**, **In Process** and **In Transit**. Click **View** on a row to open that batch, or **View All Batches** to open the full list.
4. Click **Job Work Orders** (top right) to see the orders themselves.

## On the Job Work Orders list
1. Four tiles show **Outstanding at Processors**, **Section 143 Warnings**, **Over Tolerance (Debit Due)** and **By Process Type**.
2. Search by JWO number, challan number, processor, style, buyer style code or fabric, or use the **Process Type** dropdown to filter to Dyeing, Printing, Embroidery, Stitching and so on. Typing several words narrows the list — each word must match something, so a processor name and a style code together find exactly that job.
3. The table shows **JWO Number**, **Process**, **Processor**, **Style**, **Greige**, **Fabric**, **Width**, **Qty Received**, **Sent Date**, **Need By**, **Status** and **Section 143**.
4. **Need By** turns red when the date has passed and nothing has come back. Closed and cancelled orders never turn red.
5. The **Section 143** column shows days out with a colour: green is OK, yellow is a warning past 270 days, red is critical past 300 days and breached past 365 days. The days count from the day the processor received the goods. For cloth the supplier delivered straight to the processor and the job took where it lay, that is the delivery day, not the job's Sent Date.
6. Click any row to open the order, or use the **⋯** menu for **View Details**, **Print JWO** and **Send via WhatsApp**.

## Inside one order
The detail page shows **Order Details**, **Quantities** (Greige, Fabric, Qty Received, Abnormal Loss), the four width figures, **Sent Date**, **Need By**, **Received Date**, **Days Outstanding**, and a **Reconciliation** table with **Sent Out**, **Received Back**, **With Processor** and **Abnormal Loss** per material. A lace dyeing order reads differently: **Greige Lace** and **Dyed Variant** in place of Greige/Fabric, quantities labelled **Greige Lace Sent** and **Dyed Lace Expected Back**, and no width figures — lace width lives on the master and dyeing does not change it. From this page you can **Approve**, **Issue to Processor**, **Compute Totals**, **Close Order**, or **Cancel**. Once the order is out with the processor there is also a receive button, and which one you get depends on how the work is measured: a metre-based fabric or lace order shows **Receive from processor**, a dialog that books the returned material into stock in one step and files the receipt, while piece-based work shows **Receive Material**. A return may come in parts: each delivery is its own receipt, and the job shows **Partial Receipt** with **Received so far … of … expected — … still to come** in the Quantities card until the final delivery is in. While it is at **Partial Receipt**, **Close short — nothing more is coming** appears under **Receive from processor**: it closes the job on what was received, after a confirmation that names the shortfall. After receiving, **Return receipts** (one line per delivery with its date and metres) and **Print Inward Challan** appear in the Actions card, and the Quantities card gains **Than Count**, **Fold Length**, **Quality Grade** and **Defect Metres**.

## Statutory reports
On the Job Work Dashboard, click **Ageing PDF**, **ITC-04 PDF** or **Vendor PDF** to open the statutory report as a PDF. ITC-04 and Vendor cover the last three months.

The **Ageing PDF** lists every order still out (an order already received in full, whose only shortfall is the processing loss, is settled and no longer listed), with **Since** (the day the one-year period started; a * means the cloth was at the processor before the order was sent). A second table, **Held at processors — on no job yet**, lists our greige lying at a processor that no job has taken yet: delivered straight there, parked by a Stock-Out, or left after a cancelled job. It shows the days held and the challan the goods are there under. **No challan** means goods at a job worker with no challan covering them — raise one. The **ITC-04 PDF** includes the challans for goods a supplier delivered straight to a processor, and Stock-Out challans that sent greige to a processor. Goods brought back to our store from a processor (Stock In → **Processor Return**) appear in its returns table against the challan they went out under.

## Also useful
Open **Inventory → Movement Dashboard** for the **Pending Inward** and **Pending Outward** tabs. Pending Inward lists everything still lying at a processor with **Days Out**, and each row has a button that jumps straight to the screen where you act on it. Tick **Overdue only** to see just the late ones.
