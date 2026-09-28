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
  - greige to processor
  - processor ko greige bhejna
  - प्रोसेसर को ग्रे भेजना
  - for order
  - issue for an order
  - held for another order
  - take them anyway
  - order ke liye issue
  - dusre order ka maal
  - ऑर्डर के लिए इश्यू
  - दूसरे ऑर्डर का माल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockOutForm.tsx
  - frontend/src/pages/StockMovementList.tsx
  - backend/src/services/challan.service.ts
  - frontend/src/hooks/useHeldStockConfirm.tsx
route: /inventory/movements/stock-out
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
   - For **Internal Issue**: Select the destination department from the dropdown. Choose "Other (Custom)" to enter a custom department name. Then pick the order the goods are for in **For order** (optional): goods held for that order (arrived on its PO, or taken for it with Use Stock) are issued to it. Leave it empty only when the goods are for no order.

8. **Step 3: Add Items**:
   - Click the material type tile to select what you are issuing (Greige Fabric, Finished Fabric, Lace, Buttons, Threads, Zippers, Elastics, Labels, Packaging, Other Materials)
   - Search and select the specific stock item
   - Enter the **Quantity** to issue
   - For fabric/greige: optionally enter **Than Count** and **Fold Length (cm)**. With a fold length under 100 cm the quantity is read as the counted figure: the **Actual Metres (after L)** box beside it fills itself (it cannot be typed into) with the actual metres, which is what leaves stock and what the challan's quantity is (the printed challan also shows the counted figure @ L)
   - The system shows available quantity and warns ("Exceeds available") when the actual metres are more than it

9. To add more items, click **+ Add Item** or **+ Add Another** at the bottom.

10. Optionally enter **Remarks** (reason for issuance, processing details).

11. Click **Issue X Item(s) via Challan** to create and issue the challan immediately.

## Traps

- **Cannot exceed available stock**: The system prevents issuing more than what is available in stock
- **Stock deducts immediately**: When you submit, stock is deducted right away and a challan is created and issued in one step
- **Processing goes to Job Work Order**: If you select "Send for Processing", you are redirected to the Dyeing & Printing page because processing requires proper job work tracking
- **Supplier material types are filtered**: For Purchase Return, only material types that match the supplier's categories are shown
- **Greige sent to a processor stays ours**: if the supplier you pick is a processor (it has a "… - Processing Unit"), greige on the challan is not a return — it is booked as held at that processor's unit, and the challan goes out as a job-work challan that must come back within one year. To bring it back later, use **Stock In → Processor Return** or **Bring to store** on Greige Stock
- **Goods held for another order**: if what you issue is held for another order (it arrived on a PO linked to that order, or was taken for it with Use Stock), a box **These goods are held for another order** lists "Held for ORD… (STYLE): N" and asks "Take them anyway? That order will need them bought again." Click **No, keep them** to issue nothing, or **Take them anyway** — that order's requirement then goes back to needing the goods bought. On an Internal Issue, picking the right order in **For order** means that order's own held goods are simply issued to it. A Purchase Return never names an order, so held goods sent back are always taken from their order
- **Only greige in our stores is offered**: greige a processor already holds is not listed here — move it with **Move to another processor** or bring it back with **Bring to store**

## After saving

- A challan is created and issued automatically
- Stock levels are reduced immediately for the issued quantities
- You are redirected to the Challans list page
- The challan number is displayed in the success message
- View the challan at **Manufacturing → Challans**
