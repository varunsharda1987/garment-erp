---
slug: requirements-use-stock
title: Use stock for a requirement (Use Stock / Allocate from Stock)
keywords:
  # English
  - use stock
  - allocate from stock
  - allocate stock
  - reserve stock
  - stock is there but PO required
  - why PO required when stock available
  - can fulfill
  - fulfilled from stock
  - partially from stock
  - current stock
  - hold stock for order
  - take from stock
  # Hinglish
  - stock use karna
  - stock se lena
  - stock allocate karna
  - stock hai phir bhi PO required
  - stock reserve karna
  - maal stock mein hai
  - order ke liye stock rakhna
  # Devanagari
  - स्टॉक यूज़ करना
  - स्टॉक से लेना
  - स्टॉक अलॉट करना
  - स्टॉक रिज़र्व
  - स्टॉक है फिर भी पीओ
  - माल स्टॉक में है
  - held for other orders
  - stock held for another order
  - on a PO cannot use stock
  - dusre order ke liye rakha
  - दूसरे ऑर्डर के लिए रखा
  - two use stock buttons
  - which use stock button
  - two requirement numbers on one row
  - 2 requirements
  - do use stock button
  - kaunsa use stock dabana
  - दो यूज़ स्टॉक बटन
  - कौन सा यूज़ स्टॉक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/components/requirements/OrderStyleLabelView.tsx
  - frontend/src/components/requirements/requirement-list-options.ts
  - frontend/src/types/mrp.types.ts
  - backend/src/services/mrp.service.ts
  - backend/src/services/helpers/stock-reservation.helper.ts
  - frontend/src/components/requirements/OpenPOSupplyNote.tsx
route: /procurement/requirements
---

## How stock and requirements work

When an order's requirements are calculated, the system **shows** how much stock could be used, but it does **not** hold it for the order. A requirement stays **PO Required** until someone clicks **Use Stock**. Only then is the stock reserved for that order, and the row becomes **Fulfilled from Stock** (all of it covered) or **Partially from Stock** (part covered, the rest still to buy).

This way two orders can never both count the same cloth.

Goods that arrived on a PO linked to another order are **held for that order** too. They are not counted as free stock, and **Current Stock** leaves them out.

## Steps

1. Open **Procurement > Requirements** in the sidebar.
2. On the **Material Requirements** tab, find the requirement. The page opens on **Show: Order & Style** — open the order + style card (for a sized label, click the label's heading to see its sizes). To find one material quickly, pick the order in **All orders** or type the material in the search box. The **Current Stock** column shows the free stock. In the **Material**, **Vendor** and **List** views a green **Can Fulfill** badge means the stock covers the whole shortfall.
3. Click **Use Stock** on the row. The button shows only when there is free stock and the row is **PO Required** or **Partially from Stock**. (If an amber note says an open PO has room for it — "PO… · N free · not linked" — a **Link** button beside it links the row to that PO instead; see the guide on allocating a PO to orders.)
   - **A row with two requirements has two buttons.** In **Order & Style**, one material of one order + style is one row even when it has several requirements — the **Requirement #** column lists every number, with "2 colours" (two colours of a label size) or "2 requirements" (for example one greige cut for two parts) under them. Each requirement keeps its own **Use Stock** and **Cancel**, named by what tells them apart and its quantity: the part — **Use Stock · Kurta (1,300 m)** and **Use Stock · Kurta + Pallazo (6,952.17 m)**, where "Kurta + Pallazo" is a marker that cuts both parts together — or the colour, for example **Use Stock · Black (…)**. Click the one for the part or colour you are covering.
4. The **Allocate from Stock** window shows the Material, Required, Current Shortfall and Available in Stock.
5. Check **Quantity to Allocate**. It is filled in with the most you can take (the shortfall or the free stock, whichever is less; the **Max** is shown under the box).
6. Click **Allocate Stock**.
7. The row now reads **Fulfilled from Stock** or **Partially from Stock**, and its Shortfall drops by what you took. A fully covered row leaves the **Needs action** list — choose **Received / from stock** in the status box to see it.

## Traps

- **Stock showing is not stock held.** Until you click **Use Stock**, another order can take the same stock.
- **"Only … is free on the lots … may use"** — part of the stock is already held for other requirements. Allocate the smaller quantity it names, and buy the rest.
- **Trims (buttons, labels, elastic, packaging…) are capped at their free stock** — "Only … of … is free — … of the … on hand is held for other orders" (or "Only … is in stock"). Held means taken with Use Stock, or arrived on a PO linked to another order. Allocate what it says is free and buy the rest.
- **A row that is on a PO cannot use stock** — "… is on PO… — its goods come on that PO. To cover it from stock instead, undo its allocation on the PO first." Undo it on the PO page (**Allocated to orders** → **Undo**) before its goods arrive, then click **Use Stock**.
- **"… changed while stock was being allocated — a PO or another Use Stock took it. Reload and try again."** — someone covered the row meanwhile. Reload the page and look again.
- **Greige and lace are taken from the store and from the processor this order's job will go to.** Stock held at a different processor does not count.
- **Cancelling a requirement gives its stock back.** So does a smaller new BOM version, and so does sending the stock out on the job work.
- **A requirement that already holds stock keeps it** when the order's BOM changes. If the new BOM needs more, the extra shows as still short; click **Use Stock** again or order it.
