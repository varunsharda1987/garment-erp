---
slug: purchase-order-close-short
title: Close a Purchase Order Short, Cancel it, or Delete a Draft
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
  - cancel po
  - cancel purchase order
  - po cancel karna
  - po cancel kaise kare
  - order cancel
  - cancel reason
  - force cancel
  - admin cancel
  - galat po
  - delete po
  - delete draft po
  - draft delete
  - po hatana
  - पीओ कैंसल
  - पर्चेस ऑर्डर कैंसल
  - ऑर्डर रद्द
  - रद्द करना
  - ड्राफ्ट डिलीट
  - पीओ डिलीट
  - गलत पीओ
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/components/purchase-orders/CancelPoDialog.tsx
  - frontend/src/types/purchaseOrder.types.ts
  - frontend/src/hooks/usePermissions.ts
  - backend/src/schemas/purchaseOrder.schema.ts
  - backend/src/services/purchaseOrder.service.ts
route: /procurement/purchase-orders
---

## Which action ends the order?
The right action depends on the PO's status:

| Status | What happened | Action |
|--------|---------------|--------|
| **Draft** | Never sent to the supplier | **Delete** |
| **Sent** or **Acknowledged** | Nothing has arrived, and nothing will | **Cancel** |
| **Partially Received** | Some goods arrived, the balance will not | **Close Short** |
| **Partially Received**, balance still coming | — | Do nothing yet; receive it with **Receive Goods** |
| **Partially Received** or **Received**, raised by mistake | — | **Force cancel (admin)** — ADMIN role only |

A delivery that comes within the **Under-receipt tolerance** (a setting, 5% unless changed) of the ordered quantity already closes the PO as **Received** on its own — there is nothing to close short. Close Short is for a real shortfall, where the PO stays **Partially Received**.

Closing short ends the *ordering* only. It moves no stock, and it does not write anything off. Material a processor short-returned is still settled through the job work order and a debit note.

## Close Short — steps
1. Open **Procurement → Purchase Orders** in the sidebar.
2. Find the order. The **Material** column shows what each PO is for, and the search box finds a PO by its material, PO number, supplier or style. Its status must read **Partially Received**. (From the row's **…** (actions) menu, **Close Short** opens the order page with the Close Short box already open. If the order has changed since — for example it is now fully received — a message says there is nothing left to close short.)
3. Click the PO number to open it, then click **Close Short** in the top bar.
4. The box **Close <PO number> Short** lists every line with **Ordered**, **Received** and **Balance** in its own unit, and a **Then** column saying what will happen to it: **Returns to plan** (nothing arrived on that line), **Balance dropped**, or **Balance carried forward**. Check these are the real numbers before continuing.
5. Type a **Reason** — for example "Supplier could not supply the balance this season". This is required.
6. Leave the checkbox **unticked** if the balance is no longer needed. This is the normal case.
7. Tick **Still need the balance on the part-delivered lines — carry it forward as a new requirement so it can be ordered again** only if the material is still wanted. A fresh requirement is created for the balance so it can be ordered again on a new PO.
8. Click **Close Short**. (**Keep Order Open** leaves without closing.)

### What happens
- The order's status becomes **Closed Short**. It is final — the order cannot be edited, received against or cancelled afterwards.
- Lines the supplier never delivered against go back to the material plan on their own, so they can be ordered again.
- A part-delivered requirement is closed at what actually arrived, and records both the short quantity and your reason.
- On a Greige PO, any Processing PO that was waiting for that greige is released and its quantity trimmed to the greige that really arrived.
- On a PO split across several delivery places, closing short ends every place's balance at once. The **Deliver To** card keeps showing what each place received, but no longer offers **Receive here** or **Change delivery**.

## Cancel a Sent or Acknowledged PO
1. Open the PO and click **Cancel** in the top bar. Or, on the Purchase Orders list, open the row's **…** (actions) menu and click **Cancel PO**. Only Sent and Acknowledged POs offer it.
2. The box **Cancel <PO number>?** explains that the supplier should not deliver against it, and what it was ordered for goes back to its requirements so it can be ordered again. It cannot be undone.
3. Type a **Reason** — required, up to 500 characters (the counter under the box shows how many are used).
4. Click **Cancel Order**. **Keep Order** leaves without cancelling.
5. If the cancel is refused, the box stays open with your reason still typed and a message saying why. Fix the cause and click **Cancel Order** again.

The status becomes **Cancelled**, and the reason is added to the PO's **Notes**.

## Delete a Draft
A Draft was never sent to anyone, so it is deleted, not cancelled.
1. On the PO page click **Delete**. The box **Delete draft purchase order** asks you to confirm; click **Delete** (or **Keep Draft** to leave it).
2. Or, on the list, open the row's **…** (actions) menu and click **Delete**, then **Delete** again to confirm.
Anything the draft was ordered for goes back to be ordered again.

## Force cancel (admin)
Only to correct a genuine mistake on a PO goods have already been received against. Users with the ADMIN role see **Force cancel (admin)** on the page of a **Partially Received** or **Received** PO; nobody else sees it.
1. Click **Force cancel (admin)**.
2. The box explains: what arrived stays booked, the balance not yet delivered goes back to its requirements so it can be ordered again, the normal exit for a part-delivered order is Close Short, and this cancellation is logged with your name.
3. Type a **Reason** (required) and click **Force Cancel**.

## Validation traps
- **Close Short only appears on a Partially Received order.** A Draft, Sent or fully Received order does not offer it, and the server refuses it too.
- **A reason is required** for Close Short, Cancel and Force cancel. The button stays disabled until you type one.
- **Finish QC first.** If a GRN for this order is still awaiting QC, both Close Short and every cancel (forced or not) are refused and name the GRN. Approve or reject it first, so the delivered quantity is final.
- **Close the job work order first.** If an open job work order is linked to this PO, closing short is refused and names it. Short-returned material must be settled there.
- **A plain cancel is refused once goods have arrived**: "Goods have been received against … — use Close Short to end it at what arrived." A fully received PO "cannot be cancelled".
- **A Draft cannot be cancelled** — "… is a draft that was never sent — delete it instead of cancelling it."
- **A Closed Short order cannot also be cancelled**, and a Cancelled one cannot be cancelled again.
- **Only an ADMIN can force-cancel** — anyone else is refused.
- **The PO changed meanwhile** (for example a GRN was saved while you were cancelling): the cancel is refused with "reload it and try again". Reopen the PO and check its status first.
