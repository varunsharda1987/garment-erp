---
slug: stock-in-create
title: Record Stock In (Opening/Transfer In)
keywords:
  # English
  - stock in
  - opening stock
  - transfer in
  - receive stock
  - stock receipt
  - material receipt
  - inward entry
  - fresh stock
  - processor return
  - material in
  # Hinglish
  - stock in karna
  - opening stock dalna
  - maal aana
  - stock receive karna
  - material lena
  - godown mein dalna
  # Devanagari
  - स्टॉक इन
  - ओपनिंग स्टॉक
  - माल आना
  - ट्रांसफर इन
  - स्टॉक रसीद
  - मटीरियल रसीद
  - गोदाम में डालना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockInForm.tsx
  - frontend/src/pages/StockMovementList.tsx
route: /inventory/movements/stock-in
---

## Before you start

- The material (greige, fabric, lace, button, thread, etc.) must already exist in the system
- The supplier must be registered with the correct category (Greige Supplier, Fabric Supplier, etc.)
- A warehouse must exist to receive the stock into

## Steps

### Opening the Stock In form

1. Open **Inventory > Material Movements** in the sidebar.
2. Click the **+ New Movement** dropdown button.
3. Select **Stock IN (Receipt)** from the menu.

### Source Type selection

Choose one of two modes:

- **Fresh Stock** - New purchase or direct receipt from a supplier
- **Processor Return** - Receiving greige back from a processor (only shows if processors have pending stock)

---

## Fresh Stock flow

### Step 1: Select Supplier

1. In **Supplier**, search by name or code using the dropdown.
2. Optionally filter by **Category** (Greige Supplier, Fabric Supplier, Trim Supplier, etc.) to narrow the list.
3. Once selected, the system shows the supplier's name and allowed material types.

### Step 2: Warehouse & Reference

1. Select the **Warehouse** where stock will be received.
2. Optionally enter:
   - **Challan/DC Number** - Delivery challan from supplier
   - **Supplier Invoice** - Invoice number for the receipt
   - **Received Date** - Leave blank for today, or backdate if needed
   - **Invoice Date** - Date on the supplier's invoice

### Step 3: Add Items

1. If the supplier handles multiple material types, select the **Material Type** tile (Greige Fabric, Finished Fabric, Lace, Buttons, etc.).
2. Search and select the **Material** from the dropdown.
3. Enter **Quantity** and select the **Unit** (Meter, Gross, Cone, Piece, etc.).
4. Optionally fill in:
   - **Rate** - Cost per unit
   - **Lot/Batch Number** - Supplier's lot reference
   - For fabric/greige only:
     - **Than Count** - Number of thans
     - **Fold Length (cm)** - Actual fold length (shows calculated actual meters)
   - For greige only:
     - **Roll Numbers** - Comma-separated roll identifiers (e.g., R001, R002, R003)

5. To add more items, click **+ Add Item** (or **+ Add Greige Fabric** if supplier is single-category).
6. Remove an item using the trash icon (at least one item must remain).
7. Add any **Remarks** at the bottom.
8. Click **Create Stock IN** to save.

---

## Processor Return flow

Use this when receiving greige fabric back from a processor (dyeing/printing mill).

### Step 1: Select Processor

1. Choose the **Processor** from the dropdown (only processors with pending stock appear).
2. The dropdown shows available quantity at each processor.

### Step 2: Select Greige to Receive

1. Select the specific **Greige stock entry** to receive.
2. Details like code, name, composition, and width are displayed.

### Step 3: Receive Details

1. View **Available at Processor** (read-only).
2. Enter **Receiving Now** quantity (cannot exceed available).
3. See **Balance at Processor After** calculated automatically.
4. Select the **Receive to Warehouse**.
5. Add any **Remarks**.
6. Click **Receive from Processor** to complete.

---

## Material types supported

| Type | Default Unit | Extra Fields |
|------|--------------|--------------|
| Greige Fabric | Meter | Than Count, Fold Length, Roll Numbers |
| Finished Fabric | Meter | Than Count, Fold Length |
| Lace | Meter | - |
| Buttons | Gross | - |
| Threads | Cone | - |
| Zippers | Piece | - |
| Elastics | Meter | - |
| Labels | Piece | - |
| Label Variants | Piece | - |
| Packaging | Piece | - |
| Other Materials | varies | - |

## Traps

- **Supplier category mismatch** - If the wrong supplier is selected, the material type you need may not appear. Check the supplier's registered categories.
- **Fold length adjustment** - When fold length < 100 cm, actual meters = nominal qty x fold length / 100. The system shows this calculation but be aware the actual received quantity differs from challan quantity.
- **Multi-item receipt** - All items in one receipt share the same supplier, warehouse, and reference numbers. For different suppliers, create separate Stock IN entries.
- **Processor return partial** - You can receive partial quantities from a processor; the balance remains at the processor for future receipt.

## After saving

- Stock levels for the material increase in the selected warehouse
- A movement record is created with direction **INWARD**
- The receipt appears in the Material Movements list
- If rate was entered, the system tracks the landed cost
