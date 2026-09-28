---
slug: grn-approve
title: Approve a GRN and update stock
keywords:
  - delivered straight to processor
  - dyer sold us and keeps it
  - supplier is the processor
  - retained at your premises
  - dyer ne becha aur apne paas rakha
  - डायर ने बेचा और रखा
  - direct delivery
  - dyer ke paas seedha
  - सीधे प्रोसेसर
  - grn approve
  - approve goods receipt
  - qc pass
  - pending qc
  - stock update
  - grn reject
  - job work grn approve
  - inward challan
  - जीआरएन
  - अप्रूव
  - मंजूरी
  - स्टॉक
  - माल जांच
  - इनवर्ड चालान
  - quality check
  - grn approval kaise kare
  - greige stock
  - job work challan on grn
  - delivery point
  - डिलीवरी पॉइंट
  - thread receipt
  - cones received
  - धागा प्राप्त
  - accessories
  - label packaging stock
  - accessories stock kahan gaya
  - एक्सेसरीज़
  - grn cannot be approved
  - po cancelled grn
  - cancelled purchase order
  - po cancel ho gaya
  - grn approve nahi ho raha
  - कैंसिल पीओ
  - जीआरएन अप्रूव नहीं हो रहा
  - awaiting qc
  - po close short nahi ho raha
  - po cancel nahi ho raha
  - पीओ कैंसिल नहीं हो रहा
  - invoice to follow
  - add invoice
  - bill baad mein aaya
  - invoice add karna
  - बिल जोड़ें
  - इनवॉइस बाद में
  - edit roll numbers
  - edit than numbers
  - roll number galat
  - than number badalna
  - रोल नंबर
  - थान नंबर
  - held for order
  - linked order receipt
  - allocated to orders
  - earliest delivery first
  - order ke liye rakha maal
  - ऑर्डर के लिए रखा माल
  - grn reverse refused
  - grn reverse nahi ho raha
  - जीआरएन रिवर्स नहीं हो रहा
sources:
  - backend/src/services/helpers/direct-supply-challan.helper.ts
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/GRNList.tsx
  - frontend/src/pages/GRNDetail.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - backend/src/schemas/grn.schema.ts
  - backend/src/services/grn.service.ts
  - backend/src/services/purchaseOrder.service.ts
  - backend/src/services/helpers/po-delivery-plan.helper.ts
  - backend/src/services/thread-stock.service.ts
  - backend/src/services/helpers/stock-routing.helper.ts
  - backend/src/services/helpers/receipt-invoice.helper.ts
  - frontend/src/lib/receipt-invoice.ts
  - backend/src/services/helpers/receipt-allocation.helper.ts
  - backend/src/services/helpers/po-allocation.helper.ts
route: /procurement/grn
---

## Before you start
The GRN must already exist and be in **Pending QC** status. Approve and Reject buttons do not appear on any other status. Approval is what actually creates stock, so check the physical goods first.

## Steps
1. Open **Procurement → GRN (Goods Receipt)** in the sidebar. The page title is **Goods Receiving Notes**.
2. Pick **Pending QC** in the **All statuses** dropdown to see everything waiting, or type in the search box: GRN number, the supplier's invoice number, the PO or job work order number, the material's name or code, supplier, warehouse, or the style — including the buyer's own style code. Typing several words narrows the list, since each word must match something. You can also narrow by **All suppliers** and by the **Inward date** From / To range; the **Clear N filters** button resets them.
3. Click the GRN number to open it. The **PO / JWO** column shows which purchase order or job work order the GRN belongs to. On the GRN page, **PO Status** shows the purchase order's status — if it reads **CANCELLED**, do not approve: reject the GRN instead (see *Traps*). **Received at** shows the warehouse it was booked into; on a PO split across several places, **Delivery point** shows which of the PO's places it delivered against (flagged "Booked away from the planned place" when the warehouse differs).
4. Check the summary tiles — **Total Items**, **Total Received**, **Total Accepted**, **Total Rejected** — and the **Received Items** table. Than, bale and roll breakdowns are shown under each material.
5. Click **Approve**.
6. If the GRN has no warehouse yet, the **Select Warehouse to Approve** box appears. Pick **Warehouse *** and click **Approve**.
7. If the GRN already has a warehouse, confirm on the **Approve GRN** dialog by clicking **Approve**.
   If the warehouse is a processor's unit (e.g. **Aryan Dyeing - Processing Unit**), a second question appears: **Delivered straight to *<processor>*?** Click **Yes — delivered straight to *<processor>*** only if the supplier really delivered the goods to the processor. The goods are then recorded as ours, **held by that processor**, and one job-work challan dated the receipt day is raised automatically for everything on the receipt — greige, lace, ready fabric, trims or accessories. A later greige or lace job at that processor uses it where it lies, with no second challan. If the goods came to our store, click **Go back** and approve into our store instead. The question is skipped when the purchase order already delivers to that processor's unit — its one place, or one of its places when the delivery is split. After approval the GRN page shows the challan under **Job-work challan** (click it to open the challan).

   If the supplier on the GRN **is** that processor (the dyer sold us the goods and keeps them to process), the question is instead **<processor> sold us this and keeps it to process?** Click **Yes — <processor> keeps it to process** only if that is true. The goods are recorded as ours, held by that processor, and the job-work challan reads "Purchased from you and retained at your premises for job work". This question is always asked, even when the purchase order delivers to that unit. A job at that processor can then use the goods where they lie. Goods bought from a processor and delivered to **our store** still cannot be issued back to that processor on a job.
8. A GRN badged **Job work return** in the **PO / JWO** column never needs approving: it was filed already **Accepted** by the job's **Receive from processor** action, which recorded the quality and booked the stock in the same step. Only a GRN against an old Processing purchase order still opens the **Approve Processing GRN - Quality Check** dialog: fill **Quality Grade *** (A - Good, B - Minor Defects, Reject), **Color Match**, **Defect Meters**, **Defect Type**, **Actual Rate (per meter)** and **QC Remarks**, pick **Warehouse *** if the GRN has none, then click **Approve & Create Stock**.

## What approval does
- GRN status becomes **Accepted** and your name is stamped as approver.
- Accepted quantity is added to stock: greige goes to greige stock, fabric to fabric stock, lace to lace stock, thread to thread stock, and other materials to Stock Levels for the chosen warehouse. Trims (buttons, zippers, elastic …) and accessories (labels and packaging) also get their own stock lot, so they show on every stock screen; a label that comes in sizes is stocked size by size. A Stock In movement is recorded for the audit trail.
- Buttons received in gross are stocked in pieces: 16 gross accepted = 2,304 pcs in stock at the price per piece. The GRN and the PO keep showing gross.
- Thread received in boxes is stocked in cones or tubes: 2 boxes of Cone 3-ply accepted = 20 cones, at the price per cone. Each pack is its own stock item ("… - Cone 3-ply", "… - Tube 3-ply"), never added together. The GRN and the PO keep showing boxes.
- The PO receiving status is recomputed — it becomes Partially Received or Received.
- If the PO line is allocated to running orders, the accepted quantity goes to those orders first — the order with the **earliest delivery** is filled first, so a part delivery may cover only the first orders. Goods that arrive for a linked order are **held for that order** (greige, lace, trims and accessories), not left as free stock; only what arrives beyond what was allocated to them is free. The PO page's **Allocated to orders** card shows what each order has received and holds (see *Allocate a sent PO to running orders*).
- Rejected quantity is taken back off the PO's received counter so the shortfall can be re-ordered, and is logged as an adjustment-out movement.
- Receiving greige can automatically ready the linked processing work.
- If fabric was waiting for a production run, a banner appears with **Go to Cutting Chart** or **View Cutting**.
- A GRN with a line received at a fold length shows both figures on its page in their own columns: **Received (counted)** and **Accepted (counted)** are the supplier's counted figures, and **Actual accepted (after L)** is the metres booked into stock (e.g. 9,810.78, with "counted × 98/100" under it). On the GRN list, **Qty (counted)** and **Actual (after L)** sit side by side ("@ L=98" under the actual; "—" where no L applies). Approving books the actual metres into stock; the **Rate** and **Value** columns and the printed GRN (its **Actual** column) use the actual metres too.
- For a **Job work return** there is nothing to do here: the finished fabric lot (or dyed lace lot), the inward challan, the job's shrinkage, than, fold, width and quality, the loss split and the **Stock Updated** status were all written when it was received on the job. Click the job work order in the **PO / JWO** column to see them.
- A fabric line received than-wise, bale-wise or roll-wise gives its fabric lot the same roll / than list, with the fold it was counted at — on a **Job work return** and on a fabric purchase order alike. Cutting picks from that list, and **Inventory → Fabric Stock** shows it.

## Fix the printed roll / than numbers
The **Received Items** table lists each line's thans, bales or rolls. To type the numbers printed on them:
1. Under a greige line, click **Edit bale / than numbers**. Under a fabric line of a **Job work return** or a fabric purchase order, click **Edit roll / than numbers**.
2. Type each **Than No.** or **Roll No.** (and each bale's **Bale No.** on a bale-wise line) and click **Save**.
Only the labels change — never the metres, and it works in any status. The stock lot's thans or rolls take the same numbers at once.

## The invoice came later — add it
A GRN saved with **Invoice not received yet** (or a job work return received the same way) shows **To follow** in the list's **Invoice #** column, and on its page the invoice section reads "Invoice to follow — this delivery came without the supplier's bill" (the processor's, on a job work return). When the bill arrives:
1. Open the GRN and click **Add invoice** in that section.
2. Fill **Invoice Number *** and **Invoice Date *** and click **Save invoice**.
Nothing in stock changes; the invoice now shows on the GRN, its printout and the stock lots it booked. A GRN that already has an invoice shows **Edit** beside it to correct a typo. A reversed or rejected GRN can no longer be changed. You need permission to edit GRNs.

## Rejecting instead
Click **Reject**, type a **Rejection Reason *** (required, it cannot be blank) and click **Reject**. This reverts the received quantities on the purchase order and creates no stock. It is also the only way to settle a GRN whose purchase order has been cancelled.

## Traps
- A GRN whose purchase order is **cancelled** cannot be approved. Approve is refused with "… cannot be approved: purchase order … is cancelled, and its material has been handed back for re-ordering. Reject this receipt instead." The cancel already sent that material back to be ordered again, so approving would buy it twice. Click **Reject** and give the reason.
- A GRN waiting in **Pending QC** holds its purchase order open. Until it is approved or rejected, the PO cannot be closed short (**Close Short** on the PO page) or cancelled — not even with an admin's **Force cancel (admin)**. The refusal names the GRN: "Cannot short-close …: GRN … is still awaiting QC. Complete or reject it first so the delivered quantity is final." Approve or reject the GRN first, then close the PO. Its PO line also cannot be allocated to orders, nor an allocation on it undone, until then ("GRN … on this line is awaiting QC — finish QC first").
- Approval is one-way from this screen — you cannot re-approve or re-edit an Accepted GRN here.
- If two people approve the same GRN at once, the second one gets "GRN is no longer PENDING_QC". Refresh and check the status.
- An inactive warehouse is rejected. Pick an active one.
- Only an admin can reverse an accepted GRN — there is no button for it on this page. The reversal is refused while its goods are in use:
  - its greige, lace, thread, trim or fabric lot is already partly used ("Cannot reverse GRN …: … has already been used …"). Take the used goods back first — cancel or return the issue, or return the fabric from cutting — then reverse;
  - its greige or lace lot is still reserved for an order ("… lot is still reserved — … Release those holds (or give them other cloth) first, then reverse.");
  - an order linked to the PO already issued those goods ("This receipt cannot be reversed: … already issued … Return those goods first.");
  - trims would be left held for orders beyond what is on hand ("… Release or issue those holds first.");
  - the PO is closed short, or cancelled with its goods already credited to orders ("Undoing this receipt is an administrator correction, not a screen action.").
- Reversing a **Job work return** takes back only that receipt's lot and inward challan. A job received in parts keeps its other parts; its total is recomputed, and if the reversed receipt was the final delivery the job goes back to **Partial Receipt** so the last delivery can be entered again.
- A **Job work return** cannot be rejected or re-approved here — it is already accepted. If the count was wrong, ask an admin to reverse it: that takes the lot back and cancels the inward challan, and is refused once any of that material has been used or reserved — including when any of its rolls or thans has gone to cutting, even if it came back ("… its fabric lot has already been used … Take that fabric back first").
