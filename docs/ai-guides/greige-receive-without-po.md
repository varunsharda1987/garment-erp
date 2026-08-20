---
slug: greige-receive-without-po
title: Receive Greige Without a Purchase Order
keywords:
  - greige without po
  - greige no po
  - greige bina po
  - receive greige
  - inward greige
  - greige aaya bina order
  - maal aaya bina po
  - direct greige entry
  - opening stock greige
  - ग्रेज बिना पीओ
  - माल आया बिना आर्डर
  - ग्रेज स्टॉक
  - ओपनिंग स्टॉक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/pages/StockInForm.tsx
  - frontend/src/pages/PurchaseOrderForm.tsx
  - backend/src/schemas/grn.schema.ts
  - backend/src/schemas/stockMovement.schema.ts
  - docs/STOCK_DOORS_GUIDE.md
---

## Which method to use?

| Situation | Method |
|-----------|--------|
| Regular purchase from supplier (even if PO was not made earlier) | **Create PO first, then GRN** |
| Opening stock when system went live | Stock In |
| Physical count found extra greige | Stock In |
| Sample greige from supplier (no payment) | Stock In with remarks |

**Recommended:** Always create a Purchase Order first, then receive via GRN. This gives you full audit trail, payment tracking and GST compliance.

---

## Option 1: Create PO first, then GRN (Recommended)

Use this for any greige you bought from a supplier, even if you forgot to make the PO before it arrived.

### Steps

1. Open **Procurement → Purchase Orders** in the sidebar.
2. Click **+ New PO**. The page title reads **Create Purchase Order**.
3. Under **Supplier ***, search and pick your greige supplier. Only suppliers with category Greige Supplier appear.
4. Set **PO Category *** to **Greige**.
5. Fill **PO Date** (can be backdated to the actual order date), **Expected Delivery** and **Payment Terms**.
6. In the **Order Items** card, click **Add Greige Fabric** and search for the greige you received.
7. Enter **Quantity**, **Unit Price** and **Fold L (cm)** if known. GST and totals calculate automatically.
8. Click **Save as Draft**, then **Submit** to move the PO to Sent status.
9. Now open **Procurement → GRN (Goods Receipt)**.
10. Click **+ Create GRN**, select your new PO, and fill the received quantities.
11. Click **Save GRN**, then get it approved to add stock.

### Why this is better
- Payment liability is tracked — you will see how much you owe the supplier.
- GST input credit is recorded properly.
- Full audit trail from PO to GRN to stock.
- Costing flows correctly to fabric and style.

---

## Option 2: Stock In (Opening balance or corrections only)

Use this **only** for opening stock or physical count adjustments — not for regular purchases.

### Steps

1. Open **Inventory → Stock In** in the sidebar.
2. Under **Material Type**, select **Greige Fabric**.
3. In **Select Material**, search and pick the greige.
4. Enter **Quantity** and **Unit** (usually Meters).
5. Pick the **Warehouse** where the greige is stored.
6. Optionally select the **Supplier** (for reference only — no payment is created).
7. Add a clear **Remarks** explaining why there is no PO, for example "Opening balance at system go-live".
8. Click **Save Stock In**.

### Limitations
- No payment liability is created — accounting will not show you owe the supplier.
- No GST input credit is captured.
- Entry is flagged for supervisor review.
- Should not be used for regular purchases.

---

## Common mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Using Stock In for every greige arrival | No supplier linkage, accounting gap, audit risk | Create PO → GRN instead |
| Leaving remarks blank on Stock In | Auditor will question the entry | Always write why there is no PO |
| Forgetting to get GRN approved | Stock is not added until approval | Approve the GRN after saving |

---

## Related guides
- **Create a GRN** — receiving against an existing PO
- **Create a Purchase Order** — raising a new PO for materials
- **Enter Greige Stock** — legacy direct entry (use Stock In instead)
