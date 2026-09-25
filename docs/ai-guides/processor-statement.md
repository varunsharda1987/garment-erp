---
slug: processor-statement
title: Reconcile what is lying with a processor, and get them to confirm it
keywords:
  - processor statement
  - delivered straight to dyer
  - maal seedha dyer ke paas
  - सीधा डायर को माल
  - reconciliation
  - reconcile with mill
  - statement to processor
  - hisab
  - hisab milana
  - milan
  - balance with dyer
  - how much greige is with the mill
  - kitna maal mill mein hai
  - maal kahan hai
  - outstanding at processor
  - confirm with processor
  - agreed shrinkage
  - short or over
  - closing balance at processor
  - greige wise
  - प्रोसेसर स्टेटमेंट
  - हिसाब
  - मिलान
  - प्रोसेसर के पास कितना माल
  - बकाया
  - सिकुड़न
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/ProcessorStatement.tsx
  - frontend/src/pages/JobWorkDashboard.tsx
  - frontend/src/services/processorStatement.service.ts
  - frontend/src/components/SupplierCombobox.tsx
  - backend/src/routes/job-work-statutory.routes.ts
  - backend/src/controllers/job-work-statutory.controller.ts
  - backend/src/services/processor-statement.service.ts
route: /processing/processor-statement
---

## Steps
1. Open **Manufacturing → Processor Statement** in the sidebar, or click **Processor Statement** on the Job Work Dashboard.
2. Pick the **Processor** — the list holds dyers, printers, embroidery and other job-work vendors.
3. Set **From** and **To**. It opens on the current month.
4. Click **Generate**.
5. Read the four tiles: **Opening with them**, **Sent in period**, **Received back** and **Closing with them**.
6. Each material is one row. Click a row to fold its jobs open or shut — they open automatically after you generate.
7. Click **Print / PDF** to open the copy you send to the processor. It has a signature block for their name, stamp and date.

## What the columns mean
- **Opening** — what our records say was already lying with them on the From date.
- **Sent** — what went out in this period, whether on a job work challan, a plain transfer challan, or the challan raised when a supplier delivered straight to the processor. That last one counts from the day the processor received the goods, even if the challan itself is dated later.
- **Received** — what came back processed, one line per delivery. A job received in parts shows each part with its own GRN number and date.
- **Returned** — greige that came back unprocessed.
- **Agreed shrinkage** — the percentage quoted on that job, turned into metres. This is not a claim against the processor; it is what we accepted when we placed the work.
- **Short / Over** — what came back measured against what was due after that agreed shrinkage. "short" is ours to chase; "over" means they returned more than due.
- **Closing** — still with them, unprocessed or in process. This is the figure you are asking them to confirm.

Closing = opening + sent − received − returned − agreed shrinkage − short/over. A job that finished exactly on its agreed shrinkage leaves nothing behind, so its balance reads zero.

## Jobs under each material
Every job line shows its number (click it to open the order), process, sent date, challan numbers, the agreed shrinkage and the quantity due back, then each delivery received. A job whose greige was already lying at the processor is marked **already at processor** — no challan moved because the cloth was already there. Its earlier transfer challan, or the challan raised when the supplier delivered straight to the processor, is the send. The job is still listed from the day it took the cloth, and its balance shows what it holds. Where a job went past its agreed tolerance, the line also shows **Over the agreed tolerance** and the abnormal loss. That warning is on screen only and is deliberately left off the printed copy.

## Before you send it
If anything was recorded loosely, a yellow **Worth checking before you send this** panel appears above the tables. It flags a job recorded as sent with no issued challan behind it, a job marked returned unprocessed whose inward challan is missing, a material it could not identify, and a job with no agreed shrinkage recorded — where the whole gap is shown as short, which will read as a complaint the processor did not sign up to. Fix those on the job first; the statement is only as good as the challans behind it.

## What the printed copy leaves out
The PDF is the processor's copy, so it carries quantities, dates, document numbers and the agreed shrinkage — and no tolerance verdict, abnormal-loss split or debit-note amount. Those stay on this screen.
