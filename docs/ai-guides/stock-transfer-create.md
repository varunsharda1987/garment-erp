---
slug: stock-transfer-create
title: Transfer Stock Between Warehouses
keywords:
  # English
  - stock transfer
  - warehouse transfer
  - move stock
  - inter-warehouse
  - transfer material
  - shift stock
  - relocate inventory
  # Hinglish
  - stock transfer karna
  - godown se godown
  - maal shift karna
  - warehouse transfer kaise kare
  - stock move karna
  - ek godown se dusre godown
  # Devanagari
  - स्टॉक ट्रांसफर
  - गोदाम ट्रांसफर
  - माल शिफ्ट
  - वेयरहाउस ट्रांसफर
  - स्टॉक मूव
  - गोदाम से गोदाम
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockTransferForm.tsx
  - frontend/src/pages/StockMovementList.tsx
route: /stock/transfers/new
---

## Before you start

- The source warehouse must have stock of the material you want to transfer
- The destination warehouse must already exist in the system
- You need the **stockMovements** permission

## Steps

1. Open **Inventory > Material Movements** in the sidebar.

2. Click the **New Movement** button (top-right corner).

3. Select **Transfer** from the dropdown menu.

4. In the **From Warehouse** field, select the source warehouse using the dropdown.
   - After selecting, the Material dropdown will load with available stock from this warehouse.

5. In the **To Warehouse** field, select the destination warehouse.
   - Use the swap button (arrows icon) between the two fields to quickly swap source and destination.

6. In the **Material** dropdown, select the material to transfer.
   - The dropdown shows each material with its available quantity, e.g., "BTN-001 - Metal Button (Avail: 500.00 PCS)".
   - Only materials with quantity > 0 appear in the list.

7. After selecting a material, an info banner shows the available quantity in the source warehouse.

8. Enter the **Quantity to Transfer**.
   - Must be greater than 0 and cannot exceed available stock.

9. The **Unit** field auto-fills from the selected material (read-only).

10. Optionally add **Remarks** (reason for transfer, reference numbers, etc.).

11. Click **Transfer Stock** to complete the transfer.

12. On success, the system shows "Stock transfer created successfully!" and redirects to the Material Movements list.

## Traps

- Source and destination warehouses must be different. The system blocks transfers to the same warehouse.
- You cannot transfer more than the available quantity. The system shows the exact available amount if you try.
- The Material dropdown stays disabled until you select a source warehouse.
- If no stock exists in the source warehouse, the dropdown shows "No stock available in source warehouse".

## After saving

- Stock quantity decreases in the source warehouse
- Stock quantity increases in the destination warehouse
- The transfer appears in the Material Movements list with direction "TRANSFER" (blue badge)
- Both warehouses' stock levels update immediately
