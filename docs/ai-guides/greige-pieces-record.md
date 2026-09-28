---
slug: greige-pieces-record
title: Record the bales, thans or rolls of a greige lot
keywords:
  - record bales and thans
  - record bales & thans
  - than list
  - bale list
  - roll list
  - no than list
  - than list nahi hai
  - than ginti
  - than count karna
  - gaanth ginti
  - roll ginti
  - pieces column
  - which bale to send
  - kaunsa than bheje
  - total meters lot
  - lot ke than
  - थान
  - थान की सूची
  - गांठ
  - रोल
  - थान गिनती
  - गांठ गिनती
  - थान दर्ज करें
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/GreigeAvailableStock.tsx
  - frontend/src/components/job-work/RecordLotPiecesDialog.tsx
  - frontend/src/components/job-work/ReceiptDetailRows.tsx
  - frontend/src/components/job-work/GreigeLotRows.tsx
  - frontend/src/components/job-work/lot-rows.ts
  - backend/src/schemas/fabricStock.schema.ts
  - backend/src/routes/greige-stock.routes.ts
  - backend/src/services/greige-stock.service.ts
route: /greige-stock
---

## Why
When a greige lot is issued to a dyer or printer, the Issue screens let you tick which bales, thans or rolls go — but only if the lot has a list of its pieces. A lot received on its GRN as **Total Meters**, typed in by hand, or split off another lot has no list, and goes by quantity. Record its pieces once, and every later issue can pick them.

## Where to see which lots have a list
1. Open **Inventory → Greige Stock** in the sidebar. The page shows **Generic Greige Stock**.
2. Click a greige's row to expand it. Each lot shows a **Pieces** column: **No list**, "25 rolls", "64 of 109 thans left · 7 bales", or "All 25 rolls gone". A lot counted at a fold length also shows **L (cm)** and **Counted @ L** beside **Qty Avail (actual)**: the counted figure is what its than tags add up to (actual × 100/L), so type tag metres against that, not against the actual.

## Record the pieces on hand
1. On a lot with **No list** (or whose list is used up), click the **Record bales & thans** button (list-with-ticks icon) in its Actions. The same dialog opens from the line "… has no bale, than or roll list — it goes by quantity" on the **Issue to Processor**, **Dispatch to Processor** and **Send to Mill** screens.
2. The dialog **Record bales & thans — <greige code>** shows **On hand** — the lot's metres now.
3. Pick **Entry Mode**: **Than-wise** (loose thans), **Bale-wise** (thans in bales) or **Roll-wise**. A lot that came in rolls starts on Roll-wise.
4. Add the pieces that are physically on the rack now:
   - **Than-wise** — **Add than** for each than; type its metres and, if you like, the **Than No.** on its tag.
   - **Bale-wise** — **Add bale**, type the **Bale No.** printed on the bale, then **Add than** inside it for each than.
   - **Roll-wise** — **Add roll** for each roll, with its metres and **Roll No.**
   Type the metres written on the tag (counted). If the lot has a fold length, the summary converts them: "Counted … at fold L=98 = … actual".
5. Check the summary line under the list: a green "✓ matches the lot", an amber note when it is off by up to 1% (allowed — the lot keeps its metres), or red when it is more than 1% away.
6. Add **Remarks** if useful, then click **Save N thans** (or rolls).

The lot's metres never change — this only records its pieces. From then on its pieces open on every Issue screen, with **Pick thans for me** and **Best fit**.

## Traps
- More than 1% away from what the lot holds is refused: "These … come to … m actual …, but … holds … m — more than 1% apart. Check the count, or correct the lot's quantity first with Adjust Stock on the Greige Stock page." Recount, or fix the lot with **Adjust Stock** first.
- A lot that still lists pieces cannot be counted again: "… already lists … — A lot is counted only when its list is empty". If pieces left on an order without being named, name them on that order with **Record thans sent**.
- Pieces recorded now are the ones on the rack now. An order that already left before the count can never be given these pieces — they were still in the godown.
- Every row needs its metres before it can be saved. You need permission to edit greige stock; others do not see the button.
