---
slug: grn-create
title: Create a GRN (Goods Receipt)
keywords:
  - delivery point
  - split delivery
  - receive here
  - which delivery
  - kis jagah ki delivery
  - डिलीवरी पॉइंट
  - weaver
  - weaver not known
  - delivered straight to dyer
  - direct to processor
  - dyer ke yahan maal aaya
  - सीधा डायर के पास माल
  - bunkar
  - बुनकर
  - grn
  - goods receipt
  - goods receiving note
  - maal receive
  - maal aaya
  - grn kaise banaye
  - receive via grn
  - job work grn
  - माल
  - रिसीव
  - कपड़ा
  - जीआरएन
  - रिसीव वाया जीआरएन
  - than
  - bale
  - greige
  - greage
  - bale number
  - than number
  - bale no
  - than no
  - bale number kahan likhe
  - बेल नंबर
  - थान नंबर
  - label sizes
  - label receive
  - size wise label receive
  - label ke size
  - लेबल साइज़
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/GRNList.tsx
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/pages/GRNDetail.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - backend/src/schemas/grn.schema.ts
  - backend/src/services/grn.service.ts
  - backend/src/services/purchaseOrder.service.ts
  - frontend/src/components/WeaverCombobox.tsx
  - backend/src/services/helpers/po-delivery-plan.helper.ts
  - frontend/src/lib/label-lines.ts
  - frontend/src/lib/label-line-keys.ts
route: /procurement/grn/new
---

## Before you start
A Purchase Order must already exist and be in **Sent**, **Acknowledged** or **Partially Received** status — Draft POs do not appear in the list. This form is only for goods you **bought**. Processed fabric or dyed lace coming back from a processor is not received here: open the job work order and click **Receive from processor** — one action that books it into stock (see *Receive processed material back from a processor*).

## Steps
1. Open **Procurement → GRN (Goods Receipt)** in the sidebar. The page title is **Goods Receiving Notes**.
2. Click **+ Create GRN**. The page title reads **Create Goods Receiving Note**. (Shortcut: from the PO page click **Receive Goods** and the PO is already selected — or, in the PO's **Deliver To** card, click **Receive here** on a delivery place and that place is chosen too.)
3. Under **Purchase Order Selection**, search by PO number, supplier, material or style, or use the category chips, then pick the PO in **Purchase Order ***.
4. If you came here to receive from a processor, stop: under the PO list the form says **Receiving from a processor? Open the job work order and click Receive from processor**. There is no job work box on this form any more.
5. If the PO is **split across several places**, a **Delivery point *** box appears: pick which of the PO's places this delivery is for. Each option shows that place's planned, received and still-to-come quantity, and picking it fills the Warehouse.
6. Choose **Warehouse *** and confirm **Receiving Date *** (defaults to today). On a PO that delivers to one place, the Warehouse is pre-filled with that place ("The PO delivers here."). If the goods actually arrived somewhere else, change it — an amber note says "The PO plans this delivery for …. Book it here only if the goods actually arrived here." If the supplier delivered straight to a dyer, pick that dyer's **<Dyer> - Processing Unit** as the Warehouse and the day the dyer received it as the Receiving Date. On approval the greige is booked as ours, held at the dyer, with a job-work challan (see *Approve a GRN*).
7. Fill **Invoice Number** and **Invoice Date** if the supplier sent an invoice. Both are optional.
8. In **Items to Receive**, each pending line shows Ordered, Already Rcvd and Pending. Enter **This Receipt** for the lines you actually received. **Accepted** fills automatically as Received minus Rejected.
9. If something is damaged, enter **Rejected** and a reason. Accepted plus Rejected must equal Received.
   **Labels bought in sizes** show as one heading row per label (its code, "N sizes", and the totals of Ordered, Already Rcvd, Pending, This Receipt, Accepted and Rejected across its sizes), with a **Size XS**, **Size S**… row beneath for each size, in size order. Type **This Receipt** on each size row — the heading totals update as you type and cannot be typed into.
   Buttons and snap buttons are received **as the PO ordered them — in gross**: type 16 for 16 gross. Stock is booked in pieces (16 gross = 2,304 pcs) when the GRN is approved.
10. For Fabric and Greige POs, set **Entry Mode** — Total Meters, Than-wise, Bale-wise or Roll-wise. Than/Bale/Roll modes let you click **Add Than**, **Add Bale** or **Add Roll** and enter meters per piece; the total is summed into This Receipt automatically. Also fill **L / Fold (cm)** (it comes pre-filled from the PO line — change it if the mill delivered at a different L) and **Width (inches)**. In **Bale-wise** mode each bale has a **Bale No.** box for the number printed on the bale, and each than a **Than No.** box for its tag; in **Than-wise** mode each row has **Than No.**, and in **Roll-wise** mode **Roll No.** All are optional — blank bales show as Bale 1, 2, 3. Forgot them? Open the GRN and click **Edit bale / than numbers** on the greige line; it changes only the numbers, never the metres. Type the quantity exactly as the mill counted it (the figure on their bill and than tags). When **L / Fold (cm)** is under 100, a blue line under the quantity shows the conversion, e.g. "10,011 m counted @ L=98 → 9,810.78 m". The actual metres are what go to stock, what the PO counts as received, and what the value is worked out on.
11. For Fabric and Greige POs also set **Weaver *** — whose cloth actually arrived. It comes pre-filled from the PO line; change it if the supplier's challan names a different mill, or type a new name and click **Add "…" as a new weaver**. If nobody knows, tick **Weaver not known**. The save is refused until each greige/fabric line has one or the other: "Name the weaver of … — or tick Weaver not known." The stock lot carries this weaver; lots of every weaver stay under the same greige.
12. On a Greige PO only, if the supplier actually sent finished fabric, switch on **Received as Ready Fabric (not greige)** and choose **One-time exception** or **Permanent change**. This cancels the linked Processing PO.
13. Add anything else in **Notes**, then click **Save GRN**.

## Validation traps
- PO, Warehouse and Receiving Date are required, and at least one item must have a received quantity. On a split PO the **Delivery point** is required too: "This PO is split across several places — pick which delivery this is".
- On a split PO, receiving more than a place's share, or booking it at a different warehouse, is allowed — after saving, a warning names the place and its planned quantity. One invoice and one e-way bill per delivery, so make one GRN per delivery.
- The PO quantity is in actual metres, so over-receipt is checked on the actual metres, not the counted figure — a delivery counted at L=98 that matches the PO after conversion is not an over-receipt.
- Over-receipt is allowed only up to the tolerance shown on the **Items to Receive** card.
- A PO line counts as fully received once the actual metres received are within the **Under-receipt tolerance** (Settings, 5% unless changed) of the ordered quantity. The PO then closes as Received on its own — a delivery a few centimetres short never needs a short-close. A bigger shortfall leaves it Partially Received. Beyond that the save is blocked with the maximum allowed quantity in the message.
- Accepted + Rejected must equal Received on every line, or the save fails.
- Lines that are already fully received do not appear — only pending quantity is shown.
- A Processing PO whose linked job was cancelled refuses the save — that material was already credited back to stock. If the mill really returned goods, ask the office to re-open the job first.

## After saving
The GRN is created with status **Pending QC**. Stock is NOT added yet — it is added only when the GRN is approved. (A **Job work return** is different: it is filed already accepted by the job's **Receive from processor** action, with the stock booked in the same step.)
