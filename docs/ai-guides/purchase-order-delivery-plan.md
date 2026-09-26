---
slug: purchase-order-delivery-plan
title: Change where a Purchase Order is delivered (one place, split, or to be advised)
keywords:
  - change delivery
  - delivery place
  - deliver to
  - split delivery
  - split po
  - two places
  - part to dyer
  - direct to dyer
  - delivery instruction
  - to be advised
  - decide at dispatch
  - amendment
  - delivery point
  - receive here
  - maal kahan jayega
  - aadha dyer ko aadha godown
  - dyer ko seedha bhejo
  - delivery badlo
  - po ka address badlo
  - डिलीवरी बदलें
  - डिलीवरी कहां
  - माल कहां भेजना है
  - आधा डायर को
  - सीधा डायर के पास
  - स्प्लिट डिलीवरी
  - डिलीवरी निर्देश
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/components/purchase-orders/DeliveryPlanCard.tsx
  - frontend/src/components/purchase-orders/DeliveryPlanDialog.tsx
  - frontend/src/components/purchase-orders/DeliverySplitEditor.tsx
  - frontend/src/lib/delivery-plan.ts
  - backend/src/schemas/purchaseOrder.schema.ts
  - backend/src/services/helpers/po-delivery-plan.helper.ts
  - backend/src/services/document-data/po-ship-to.ts
route: /procurement/purchase-orders
---

## When to use this
A purchase order delivers to **one place**, to **several places** with a quantity for each (for example part of the greige straight to a dyer and the rest to Kashaya Fabs), or it is **to be advised** — sent without a place, decided before the supplier dispatches. You can change it until the order is fully received, closed short or cancelled.

## Steps
1. Open **Procurement → Purchase Orders** in the sidebar and click the PO number.
2. Find the **Deliver To** card. Its badge says **One place**, **Split · N places** or **To be advised**, and an **Amendment N** badge appears once the delivery was changed after sending.
3. Click **Change delivery** (it reads **Set delivery** when the PO is to be advised).
4. Choose one of:
   - **One place** — pick the store or the processor's unit in **Deliver to**. A processor's place is its **<Name> - Processing Unit**.
   - **Split across places** — a grid opens: one row per item, one column per place. Pick each place at the top of its column and type how much of each item goes there. **Add a place** adds a column (up to 10). The **Balance** column shows what is still unplaced; **Put the balance into place 1** moves it there. Place 1 is the one the PO header shows.
   - **To be advised** — the PO prints "to be advised before dispatch". Not offered once any goods have arrived.
5. Type the **Reason** — required once the PO has been sent (optional on a draft). It is kept in the history, never printed for the supplier.
6. Click **Save delivery**. The history under **Changes so far** lists every change with who, when and why.
7. Tell the supplier: on the **Deliver To** card click **Delivery instruction** — a one-page PDF with each place's address, GSTIN and quantity, and the rule "one tax invoice and one e-way bill per delivery". Or share the whole PO again: its printout lists every place under **03 — Delivery Points** and says "Amendment N — supersedes earlier copies".
8. When a delivery arrives, click **Receive here** on that place in the **Deliver To** card. The GRN form opens with the PO and the place chosen.

## Finding POs with no place yet
- On **Purchase Orders**, the filter **Delivery: to be advised** lists them; each row carries a **Delivery: to be advised** badge, amber when the PO is due within 3 days.
- The PO page shows an amber warning, and the **Manufacturing Control Center** shows **PO Delivery Place Not Decided**, for a sent PO due within 3 days with no place.

## Validation traps
- Every item must be fully placed: the places of each item must add up to what the PO orders. The save stays disabled and lists what is short or over.
- A place that has already received goods cannot be removed or given less than it received; its column says "Has received goods — it stays". Metres already received cannot be moved to another place.
- Once anything has arrived, the PO cannot go back to **To be advised**, and a split PO cannot be turned back into **One place**.
- On a split PO, each GRN must say which place it is for (**Delivery point**). Receiving more than a place's share, or booking it at another warehouse, is allowed but shows a warning after saving.
- Goods delivered straight to a processor's unit are booked as ours, held by that processor, with a job-work challan dated the receipt day — no "delivered straight there?" question when the PO already names that unit.
