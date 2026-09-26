---
slug: stock-in-create
title: Record Stock In (Opening/Transfer In)
keywords:
  # English
  - bring to store
  - bring back from dyer
  - dyer se maal wapas
  - डायर से माल वापस
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
  - backend/src/services/helpers/held-stock-doors.helper.ts
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
- **Processor Return** - Bringing our goods back from a processor into our store (only shows if a processor holds something of ours)

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
     - **Fold Length (cm)** - The fold the quantity was counted at. Type the counted quantity; under 100 cm the **Fold Length Adjustment** box shows the actual metres that go to stock
   - For greige only:
     - **Roll Numbers** - Comma-separated roll identifiers (e.g., R001, R002, R003)

5. To add more items, click **+ Add Item** (or **+ Add Greige Fabric** if supplier is single-category).
6. Remove an item using the trash icon (at least one item must remain).
7. Add any **Remarks** at the bottom.
8. Click **Create Stock IN** to save.

---

## Processor Return flow (Bring to store)

Use this when goods of ours that a processor is holding come back to our store unprocessed — greige, lace or ready fabric that a supplier delivered straight to the dyer, or that was parked there by a Stock-Out. (Processed fabric coming back from a job is received on the job itself: **Receive from processor**.) You can also start from **Greige Stock**: expand a greige and click the store button on a lot held at a processor.

### Step 1: Select Processor

1. Choose the **Processor** from the dropdown (only processors holding something of ours appear, with how much).

### Step 2: Select what came back

1. Select the lot. Each shows its type (GREIGE, LACE or FABRIC), code, the metres free to bring back and the day it reached the processor. Metres reserved for a requirement are not offered.
2. **Lot Details** shows the code, name, details and the challan the goods went out under (**Sent under**).

### Step 3: Receive Details

1. View **Available at Processor** (read-only).
2. Enter **Receiving Now** quantity (cannot exceed what is free).
3. See **Balance at Processor After** calculated automatically.
4. Select the **Receive to Warehouse** — one of our stores, never a processor's unit.
5. Set **Date back in store** (today by default; it cannot be in the future or before the goods reached the processor).
6. Add any **Remarks**.
7. Click **Receive from Processor**. An inward challan from the processor is filed (the message names it), a new lot is booked in your store, and the processor's stock goes down. The challan the goods went out under shows as partly received, then received once nothing is left there.

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
- **Fold length adjustment** - When fold length < 100 cm, actual meters = counted qty x fold length / 100. Stock is booked once, at the actual metres, and the counted quantity is kept on the lot for reference.
- **Multi-item receipt** - All items in one receipt share the same supplier, warehouse, and reference numbers. For different suppliers, create separate Stock IN entries.
- **Processor return partial** - You can receive partial quantities from a processor; the balance remains at the processor for future receipt.

## After saving

- Stock levels for the material increase in the selected warehouse
- A movement record is created with direction **INWARD**
- The receipt appears in the Material Movements list
- If rate was entered, the system tracks the landed cost
