---
slug: challan-create
title: Create a Challan (Material Movement)
keywords:
  # English
  - challan
  - material movement
  - delivery challan
  - gate pass
  - outward challan
  - inward challan
  - internal transfer
  - send material
  - receive material
  - transport document
  - dispatch
  - issue material
  # Hinglish
  - challan banane ka tarika
  - maal bhejne ka challan
  - gate pass kaise banaye
  - material bhejne ka tarika
  - challan kaise banaye
  - naya challan
  - maal receive karna
  # Devanagari
  - चालान
  - मटेरियल मूवमेंट
  - गेट पास
  - माल भेजना
  - माल प्राप्त करना
  - ट्रांसपोर्ट डॉक्यूमेंट
  - डिलीवरी चालान
  - नया चालान बनाना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ChallanForm.tsx
  - frontend/src/pages/ChallanList.tsx
  - frontend/src/types/challan.types.ts
route: /challans/new
---

## Before you start

- Know the **source location** (where material is coming from)
- Know the **destination** (where material is going)
- Have the list of items to include with their quantities
- Optional: Vehicle and driver details for transport tracking

## Steps

1. Open **Manufacturing > Challans** in the sidebar.

2. Click the **New Challan** button (top right).

3. In the **Challan Details** section:
   - **Challan Type** * - Select the movement direction:
     - **Outward** - Sending material OUT (to processor, vendor, etc.)
     - **Inward** - Receiving material IN (from processor, vendor, etc.)
     - **Internal** - Transfer within factory (between departments)
   - **Challan Date** - Select the date (defaults to today)
   - **Expected Date** - When the material is expected to arrive/return

4. In the **From / To** section:
   - Under **FROM**:
     - **Type** * - Select: Warehouse, Department, or Vendor / Processor
     - **Name** * - Enter the source location name (e.g., "Main Warehouse", "Cutting Dept")
   - Under **TO**:
     - **Type** * - Select: Warehouse, Department, or Vendor / Processor
     - **Name** * - Enter the destination name (e.g., "Processor XYZ", "Stitching Dept")

5. In the **Transport Details (Optional)** section:
   - **Vehicle Number** - Enter if tracking transport
   - **Driver Name** - Driver's name
   - **Driver Phone** - Driver's contact number
   - **LR Number** - Lorry Receipt number for shipment tracking

6. In the **Items** section:
   - One item row is added by default
   - For each item, fill:
     - **Type** - Select the item category:
       - Fabric
       - Greige Fabric
       - Lace
       - Trim / Accessory
       - Cut Pieces
       - Stitched Pieces
       - Finished Pieces
       - Other
     - **Description** * - Describe the item clearly
     - **Quantity** * - Enter quantity (must be greater than 0)
     - **Unit** - Select unit of measurement (Meter, Piece, Kg, etc.)
     - **Rate** - Optional rate per unit
   - Click **Add Item** to add more items
   - Click the trash icon to remove an item (at least one item required)

7. In the **Remarks** field, add any additional notes or instructions.

8. Click **Create Challan** to save.

## Traps

- **From and To names are required** - You must enter both source and destination names, not just select the type.
- **All items need description and quantity** - Every item row must have a description and quantity greater than 0.
- **Cannot delete the last item** - At least one item is required on every challan.
- **Choose the correct Challan Type** - Outward is for sending OUT, Inward is for receiving IN. Getting this wrong causes tracking confusion.
- **Internal vs External** - Use Internal only for movements within your own factory. For processor/vendor movements, use Outward or Inward.

## After saving

- The challan is created with a unique **Challan Number** (auto-generated).
- Status starts as **Draft** or **Issued** depending on workflow.
- You are redirected to the challan detail page.
- From the detail page you can:
  - Print the challan
  - Track the status (Draft, Issued, In Transit, Received, Partially Received)
  - Record receipt when material arrives
- The challan appears in the list with filters for Type, Status, Item Type, and Date.
- If linked to a production run, the challan will show the work order reference.
