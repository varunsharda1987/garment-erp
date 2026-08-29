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
  - fresh stock
  - stock in receipt
  - new movement
  - ग्रेज बिना पीओ
  - माल आया बिना आर्डर
  - ग्रेज स्टॉक
  - ओपनिंग स्टॉक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/GRNForm.tsx
  - frontend/src/pages/GRNList.tsx
  - frontend/src/pages/GRNDetail.tsx
  - frontend/src/pages/StockInForm.tsx
  - frontend/src/pages/StockMovementList.tsx
  - frontend/src/pages/PurchaseOrderForm.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
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
2. Click **Create PO**. The page title reads **Create Purchase Order**.
3. Set **PO Category** to **Greige** first. The supplier box stays locked until a category is chosen.
4. Under **Supplier**, search and pick your greige supplier. Only suppliers with category Greige Supplier appear.
5. Fill **Expected Delivery Date** (required). **Delivery Location** is optional.
6. In the **Order Items** card, use the **Add Greige Fabric** search box and pick the greige you received. You can add several greige types to one PO.
7. In the items table, enter **Fold L (cm)** if the cloth is folded short, plus **Quantity** and **Unit Price**. GST and totals calculate automatically.
8. Click **Save & Send** to create and send the PO in one step. Or click **Save as Draft** and later use **Send to Supplier** on the PO page.
9. Now open **Procurement → GRN (Goods Receipt)**.
10. Click **+ Create GRN**. Under **Purchase Order**, search and select your new PO.
11. Fill the received quantities and click **Save GRN**.
12. Open the saved GRN and click **Approve** — stock is added only after approval.

### Why this is better
- Payment liability is tracked — you will see how much you owe the supplier.
- GST input credit is recorded properly.
- Full audit trail from PO to GRN to stock.
- Costing flows correctly to fabric and style.

---

## Option 2: Stock In (Opening balance, corrections, or backdated entries)

Use this for opening stock, physical count adjustments, or backdated entries when PO → GRN is not practical.

### Steps

1. Press **Ctrl+K** and search **Stock In**, or open **Inventory → Material Movements**, click **New Movement** and choose **Stock IN (Receipt)**.
2. Keep **Source Type** as **Fresh Stock**.
3. In **Step 1: Select Supplier**, search and pick your supplier (choose a Greige Supplier).
4. In **Step 2: Warehouse & Reference**, pick the **Warehouse** where the greige is stored.
5. Fill **Challan/DC Number** or **Supplier Invoice** from the supplier papers.
6. Set **Received Date** if backdating (leave blank for today) and **Invoice Date** from the supplier bill.
7. In **Step 3: Add Items**, pick **Greige Fabric** as the Material Type if the type tiles are shown. A greige-only supplier selects it automatically.
8. Search and pick the greige, then enter **Quantity** and **Unit** (usually Meter).
9. Optional per item: **Rate (₹)**, **Lot/Batch Number**, **Than Count**, **Fold Length (cm)** and **Roll Numbers** (comma-separated). A fold length below 100 cm shows the adjusted actual meters.
10. Use **Add Another Greige Fabric** to receive more items in the same entry.
11. Add **Remarks** explaining why there is no PO.
12. Click **Create Stock IN**.

### Limitations
- No payment liability is created — accounting will not show you owe the supplier.
- No GST input credit is captured.
- Entry is flagged for supervisor review.
- For regular purchases, PO → GRN is still recommended.

---

## Common mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Using Stock In for every greige arrival | No supplier linkage, accounting gap, audit risk | Create PO → GRN instead |
| Leaving remarks blank on Stock In | Auditor will question the entry | Always write why there is no PO |
| Forgetting to approve the GRN | Stock is not added until approval | Open the GRN and click Approve |

---

## Related guides
- **Create a GRN** — receiving against an existing PO
- **Create a Purchase Order** — raising a new PO for materials
- **Enter Greige Stock** — the old page now redirects to Stock In
