---
slug: stock-out-create
title: Record Stock Out (Issue/Consumption)
keywords:
  # English
  - stock out
  - issue stock
  - consumption
  - material issue
  - return to supplier
  - purchase return
  - internal transfer
  - department transfer
  - send for processing
  - issue challan
  - outward challan
  # Hinglish
  - stock out karna
  - maal nikalna
  - issue karna
  - supplier ko wapas
  - department transfer karna
  - challan banana
  - maal bhejo
  # Devanagari
  - स्टॉक आउट
  - माल निकालना
  - इश्यू करना
  - सप्लायर को वापस
  - डिपार्टमेंट ट्रांसफर
  - चालान बनाना
  - माल भेजना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockOutForm.tsx
  - frontend/src/pages/StockMovementList.tsx
route: /stock/out/new
---

## Before you start

- Stock must exist in the system for the materials you want to issue
- For Purchase Return: you need the supplier selected
- For Internal Issue: you need to know the destination department
- For Processing (dyeing/printing): use the Job Work Order workflow instead

## Steps

1. Open **Inventory → Material Movements** in the sidebar.

2. Click the **+ New Movement** button in the top right.

3. Select **Stock OUT (Issue)** from the dropdown menu.

4. **Step 1: What are you issuing for?** - Choose your purpose:
   - **Purchase Return**: Return materials to your material suppliers (defective, excess, wrong shipment)
   - **Internal Issue**: Transfer materials between departments (Cutting, Stitching, Finishing, Washing, Packing, Quality, Embroidery, Printing)
   - **Send for Processing**: This redirects to Job Work Order for proper job work tracking

5. Select the **Issue From Warehouse** from the dropdown.

6. Set the **Challan Date** (defaults to today).

7. **Step 2: Select Destination**:
   - For **Purchase Return**: Search and select the supplier by name or code. You can optionally filter by category first.
   - For **Internal Issue**: Select the destination department from the dropdown. Choose "Other (Custom)" to enter a custom department name.

8. **Step 3: Add Items**:
   - Click the material type tile to select what you are issuing (Greige Fabric, Finished Fabric, Lace, Buttons, Threads, Zippers, Elastics, Labels, Packaging, Other Materials)
   - Search and select the specific stock item
   - Enter the **Quantity** to issue
   - For fabric/greige: optionally enter **Than Count** and **Fold Length (cm)**
   - The system shows available quantity and warns if you exceed it

9. To add more items, click **+ Add Item** or **+ Add Another** at the bottom.

10. Optionally enter **Remarks** (reason for issuance, processing details).

11. Click **Issue X Item(s) via Challan** to create and issue the challan immediately.

## Traps

- **Cannot exceed available stock**: The system prevents issuing more than what is available in stock
- **Stock deducts immediately**: When you submit, stock is deducted right away and a challan is created and issued in one step
- **Processing goes to Job Work Order**: If you select "Send for Processing", you are redirected to the Dyeing & Printing page because processing requires proper job work tracking
- **Supplier material types are filtered**: For Purchase Return, only material types that match the supplier's categories are shown

## After saving

- A challan is created and issued automatically
- Stock levels are reduced immediately for the issued quantities
- You are redirected to the Challans list page
- The challan number is displayed in the success message
- View the challan at **Manufacturing → Challans**
