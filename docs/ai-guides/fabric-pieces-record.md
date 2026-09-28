---
slug: fabric-pieces-record
title: Record or check the rolls & thans of a fabric lot
keywords:
  - rolls and thans
  - record rolls and thans
  - record rolls & thans
  - check rolls and thans
  - check rolls & thans
  - view rolls and thans
  - roll list
  - than list
  - dyed fabric rolls
  - printed fabric thans
  - fabric lot pieces
  - pieces column
  - no list
  - list out of step
  - end piece
  - which rolls went to cutting
  - kapde ke roll
  - kapde ke than
  - roll ginti
  - than ginti
  - roll ki list
  - than list nahi hai
  - kaunsa roll cutting mein gaya
  - रोल
  - थान
  - कपड़े के रोल
  - रोल की सूची
  - थान की सूची
  - रोल गिनती
  - फैब्रिक स्टॉक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/FabricAvailableStock.tsx
  - frontend/src/components/fabric/FabricLotPiecesDialog.tsx
  - frontend/src/components/job-work/RecordLotPiecesDialog.tsx
  - frontend/src/components/job-work/ReceiptDetailRows.tsx
  - frontend/src/components/job-work/lot-rows.ts
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/services/fabricStockService.ts
  - backend/src/schemas/fabricStock.schema.ts
  - backend/src/routes/fabric-stock.routes.ts
  - backend/src/controllers/fabric-stock.controller.ts
  - backend/src/services/fabric-lot-pieces.service.ts
  - backend/src/services/helpers/lot-pieces.helper.ts
route: /fabric-stock
---

A dyed or printed fabric lot keeps the list of its rolls or thans. A lot received back from a processor **Than-wise**, **Bale-wise** or **Roll-wise** gets the list automatically, with the tag numbers typed on the receipt. Cutting picks rolls and thans from this list. Nothing on this page ever changes a lot's metres.

## Read the list
1. Open **Inventory → Fabric Stock** in the sidebar (page **Finished Fabric Stock**).
2. Read the **Rolls / thans** column for each lot:
   - "26 thans" — all listed pieces are on the rack;
   - "12 of 20 thans left" — the rest went out (to cutting, an embroidery job or a smocking send-out);
   - "All 12 thans gone" — the list is used up but metres are still on hand;
   - "No list" — the lot never had one (received as Total Meters, or entered by hand);
   - amber "List out of step — … m listed, … m on hand" — metres left the lot without naming pieces.
3. When a lot was counted at a fold length, **L (cm)** and **Counted @ L** sit beside **Quantity (actual)**: roll and than tags are counted metres, the lot is in actual metres.

## See where each roll went
1. Click **View** on the lot's row.
2. The **Rolls & thans** dialog lists every piece: **Metres left**, **Status** (**On the rack**, **Part left** or **Gone**), **Where it went** (the challan and the cutting batch or job, with the metres, and "cut", "at cutting" or "back … on <challan>") and **From** (**Receipt**, **Counted** or **End piece**).
3. An **End piece** ("End · CB-…") is what a cutting batch sent back that was not a whole roll.

## Record rolls & thans (a lot with no list)
1. On the lot's row click **Record rolls & thans**. (It shows when the lot has metres on hand and no list, or its list is used up.)
2. Pick the **Entry Mode**: **Than-wise**, **Bale-wise** or **Roll-wise**.
3. Add a row for every piece on the rack now and type its tag metres. **Than No.** / **Roll No.** and **Bale No.** are optional.
4. Check the line under the rows: the count must land within 1% of the metres on hand.
5. Click **Save**. The pieces are listed for picking from then on.

## Check rolls & thans (the list is out of step)
1. On the lot's row click **Check rolls & thans** (or **View**, then **Check rolls & thans**).
2. Every piece still on the list starts ticked **On the rack**. Untick each one that is not there (**Tick all** / **Untick all** help).
3. Add any piece on the rack that is not listed, as in Record.
4. Click **Save the check**. Unticked pieces leave the list, marked "Not on the rack at the count of <date>".

## Traps
- The count must be within 1% of the metres on hand; otherwise it is refused ("… more than 1% apart"). If the metres themselves are wrong, correct the lot first with **Adjust Stock** (the triangle icon on the same row), then count.
- A lot with nothing on hand cannot be counted.
- You need permission to change fabric stock; without it the Record and Check buttons do not show.
- Tag metres are counted at the lot's fold length — type them as printed on the tag.
- An **Embroidery** job order that took metres from the lot without naming rolls leaves the list out of step. Put it right from the job instead: open the job order and click **Record rolls sent** — it names the rolls that went with that job (the metres do not move). Use **Check rolls & thans** for anything else.
