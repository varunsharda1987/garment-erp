---
slug: purchase-order-close-short
title: Close a Purchase Order Short (supplier sent less)
keywords:
  - close short
  - short close
  - close po short
  - supplier sent less
  - short supply
  - short delivery
  - partial delivery close
  - balance not coming
  - kam maal aaya
  - short maal
  - po band karna
  - baki maal nahi aayega
  - शॉर्ट क्लोज
  - कम माल आया
  - कम सप्लाई
  - बकाया माल
  - ऑर्डर बंद करना
  - पर्चेस ऑर्डर बंद
  - बाकी माल नहीं आएगा
  - shortclose
  - close order short
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/types/purchaseOrder.types.ts
  - backend/src/schemas/purchaseOrder.schema.ts
  - backend/src/services/purchaseOrder.service.ts
---

## When to use this
The supplier delivered part of a purchase order and has told you the rest is not coming. **Close Short** ends the order at the quantity that actually arrived.

Use the right action for the situation:
- **Close Short** — some goods arrived, the balance will not. This is the one below.
- **Cancel** — nothing arrived at all. Cancel is no longer offered once a PO is Partially Received, because it would claim the delivery never happened.
- **Receive Goods** — the balance is still coming. Do nothing yet.

Closing short ends the *ordering* only. It moves no stock, and it does not write anything off. Material a processor short-returned is still settled through the job work order and a debit note.

## Steps
1. Open **Procurement → Purchase Orders** in the sidebar.
2. Find the order. Its status must read **Partially Received**. (From the row's ⋮ menu, **Close Short** takes you to the order page.)
3. Click the PO number to open it, then click **Close Short** in the top bar.
4. The dialog lists every line with **Ordered**, **Received** and **Balance** in its own unit. Check these are the real numbers before continuing.
5. Type a **Reason** — for example "Supplier could not supply the balance this season". This is required.
6. Leave the checkbox **unticked** if the balance is no longer needed. This is the normal case.
7. Tick **Still need the balance — carry it forward as a new requirement** only if the material is still wanted. A fresh requirement is created for the balance so it can be ordered again on a new PO.
8. Click **Close Short**.

## What happens
- The order's status becomes **Closed Short**. It is final — the order cannot be edited, received against or cancelled afterwards.
- Lines the supplier never delivered against go back to the material plan on their own, so they can be ordered again.
- A part-delivered requirement is closed at what actually arrived, and records both the short quantity and your reason.
- On a Greige PO, any Processing PO that was waiting for that greige is released and its quantity trimmed to the greige that really arrived.

## Validation traps
- **Close Short only appears on a Partially Received order.** A Draft, Sent or fully Received order does not offer it, and the server refuses it too.
- **A reason is required.** The button stays disabled until you type one.
- **Finish QC first.** If a GRN for this order is still awaiting QC, closing short is refused and names the GRN. Approve or reject it first, so the delivered quantity is final.
- **Close the job work order first.** If an open job work order is linked to this PO, closing short is refused and names it. Short-returned material must be settled there.
