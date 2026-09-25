---
slug: grn-create
title: Create a GRN (Goods Receipt)
keywords:
  - weaver
  - weaver not known
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
route: /procurement/grn/new
---

## Before you start
A Purchase Order must already exist and be in **Sent**, **Acknowledged** or **Partially Received** status — Draft POs do not appear in the list. This form is only for goods you **bought**. Processed fabric or dyed lace coming back from a processor is not received here: open the job work order and click **Receive from processor** — one action that books it into stock (see *Receive processed material back from a processor*).

## Steps
1. Open **Procurement → GRN (Goods Receipt)** in the sidebar. The page title is **Goods Receiving Notes**.
2. Click **+ Create GRN**. The page title reads **Create Goods Receiving Note**. (Shortcut: from the PO page click **Receive Goods** and the PO is already selected.)
3. Under **Purchase Order Selection**, search by PO number, supplier, material or style, or use the category chips, then pick the PO in **Purchase Order ***.
4. If you came here to receive from a processor, stop: under the PO list the form says **Receiving from a processor? Open the job work order and click Receive from processor**. There is no job work box on this form any more.
5. Choose **Warehouse *** and confirm **Receiving Date *** (defaults to today).
6. Fill **Invoice Number** and **Invoice Date** if the supplier sent an invoice. Both are optional.
7. In **Items to Receive**, each pending line shows Ordered, Already Rcvd and Pending. Enter **This Receipt** for the lines you actually received. **Accepted** fills automatically as Received minus Rejected.
8. If something is damaged, enter **Rejected** and a reason. Accepted plus Rejected must equal Received.
9. For Fabric and Greige POs, set **Entry Mode** — Total Meters, Than-wise, Bale-wise or Roll-wise. Than/Bale/Roll modes let you click **Add Than**, **Add Bale** or **Add Roll** and enter meters per piece; the total is summed into This Receipt automatically. Also fill **L / Fold (cm)** (it comes pre-filled from the PO line — change it if the mill delivered at a different L) and **Width (inches)**. In **Bale-wise** mode each bale has a **Bale No.** box for the number printed on the bale, and each than a **Than No.** box for its tag; in **Than-wise** mode each row has **Than No.**, and in **Roll-wise** mode **Roll No.** All are optional — blank bales show as Bale 1, 2, 3. Forgot them? Open the GRN and click **Edit bale / than numbers** on the greige line; it changes only the numbers, never the metres. Type the quantity exactly as the mill counted it (the figure on their bill and than tags). When **L / Fold (cm)** is under 100, a blue line under the quantity shows the conversion, e.g. "10,011 m counted @ L=98 → 9,810.78 m". The actual metres are what go to stock, what the PO counts as received, and what the value is worked out on.
10. For Fabric and Greige POs also set **Weaver *** — whose cloth actually arrived. It comes pre-filled from the PO line; change it if the supplier's challan names a different mill, or type a new name and click **Add "…" as a new weaver**. If nobody knows, tick **Weaver not known**. The save is refused until each greige/fabric line has one or the other: "Name the weaver of … — or tick Weaver not known." The stock lot carries this weaver; lots of every weaver stay under the same greige.
11. On a Greige PO only, if the supplier actually sent finished fabric, switch on **Received as Ready Fabric (not greige)** and choose **One-time exception** or **Permanent change**. This cancels the linked Processing PO.
12. Add anything else in **Notes**, then click **Save GRN**.

## Validation traps
- PO, Warehouse and Receiving Date are required, and at least one item must have a received quantity.
- The PO quantity is in actual metres, so over-receipt is checked on the actual metres, not the counted figure — a delivery counted at L=98 that matches the PO after conversion is not an over-receipt.
- Over-receipt is allowed only up to the tolerance shown on the **Items to Receive** card.
- A PO line counts as fully received once the actual metres received are within the **Under-receipt tolerance** (Settings, 5% unless changed) of the ordered quantity. The PO then closes as Received on its own — a delivery a few centimetres short never needs a short-close. A bigger shortfall leaves it Partially Received. Beyond that the save is blocked with the maximum allowed quantity in the message.
- Accepted + Rejected must equal Received on every line, or the save fails.
- Lines that are already fully received do not appear — only pending quantity is shown.
- A Processing PO whose linked job was cancelled refuses the save — that material was already credited back to stock. If the mill really returned goods, ask the office to re-open the job first.

## After saving
The GRN is created with status **Pending QC**. Stock is NOT added yet — it is added only when the GRN is approved. (A **Job work return** is different: it is filed already accepted by the job's **Receive from processor** action, with the stock booked in the same step.)
