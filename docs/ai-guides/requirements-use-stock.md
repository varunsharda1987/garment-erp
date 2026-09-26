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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/types/mrp.types.ts
  - backend/src/services/mrp.service.ts
  - backend/src/services/helpers/stock-reservation.helper.ts
route: /procurement/requirements
---

## How stock and requirements work

When an order's requirements are calculated, the system **shows** how much stock could be used, but it does **not** hold it for the order. A requirement stays **PO Required** until someone clicks **Use Stock**. Only then is the stock reserved for that order, and the row becomes **Fulfilled from Stock** (all of it covered) or **Partially from Stock** (part covered, the rest still to buy).

This way two orders can never both count the same cloth.

## Steps

1. Open **Procurement > Requirements** in the sidebar.
2. On the **Material Requirements** tab, find the requirement. The **Current Stock** column shows the free stock. A green **Can Fulfill** badge means the stock covers the whole shortfall.
3. Click **Use Stock** on the row. The button shows only when there is free stock and the row is **PO Required** or **Partially from Stock**.
4. The **Allocate from Stock** window shows the Material, Required, Current Shortfall and Available in Stock.
5. Check **Quantity to Allocate**. It is filled in with the most you can take (the shortfall or the free stock, whichever is less; the **Max** is shown under the box).
6. Click **Allocate Stock**.
7. The row now reads **Fulfilled from Stock** or **Partially from Stock**, and its Shortfall drops by what you took.

## Traps

- **Stock showing is not stock held.** Until you click **Use Stock**, another order can take the same stock.
- **"Only … is free on the lots … may use"** — part of the stock is already held for other requirements. Allocate the smaller quantity it names, and buy the rest.
- **Greige and lace are taken from the store and from the processor this order's job will go to.** Stock held at a different processor does not count.
- **Cancelling a requirement gives its stock back.** So does a smaller new BOM version, and so does sending the stock out on the job work.
- **A requirement that already holds stock keeps it** when the order's BOM changes. If the new BOM needs more, the extra shows as still short; click **Use Stock** again or order it.
