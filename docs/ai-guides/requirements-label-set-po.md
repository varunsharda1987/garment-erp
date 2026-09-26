---
slug: requirements-label-set-po
title: Order a style's labels as a set from Requirements (all sizes together)
keywords:
  - label set
  - order label set
  - labels all sizes
  - all sizes together
  - order all labels
  - label po from requirements
  - by order and style
  - main cum size label
  - traceability label
  - washcare label
  - price tag
  - size wise label
  - saare size ek saath
  - poora label set
  - label ka po
  - labels mangane hain
  - style ke saare label
  - requirement se po
  - लेबल सेट
  - सारे साइज़ एक साथ
  - लेबल का पीओ
  - लेबल मंगाना
  - वॉशकेयर लेबल
  - ट्रेसेबिलिटी लेबल
  - लेबल
  - साइज़
  - लेबल्स
  - lable set
  - labal
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/components/requirements/OrderStyleLabelView.tsx
  - frontend/src/components/requirements/order-style-groups.ts
  - frontend/src/components/BulkPOGenerationDialog.tsx
  - frontend/src/components/purchase-orders/LabelSetDialog.tsx
  - frontend/src/lib/label-lines.ts
  - backend/src/schemas/mrp.schema.ts
route: /procurement/requirements
---

## When to use this
For each style you order its labels together — main-cum-size, traceability, washcare (when it is size-specific), price tag, Liva tag — every size at once. MRP has already worked out each label's quantity per size from the order's size breakup. Ordering them from **Requirements** keeps every requirement linked to its PO, so the requirement moves to PO Generated and the label is not planned twice.

## Steps
1. Open **Procurement → Requirements** in the sidebar and stay on the **Material Requirements** tab.
2. In the view box (it reads **Flat View** at first), choose **By Order & Style (label sets)**. The material filter next to it switches to **Labels** by itself; choose **All Materials** to see a style's other materials too.
3. Narrow it down if you like: type the order number or style code in the search box, or pick a style in **All Styles**. (From a purchase order's **Order label set…** box, the warning link **Requirements → By Order & Style** opens this view already filtered to that order and style.)
4. Each **order + style** is one card: the style code and name, the order number and customer, and a badge like "5 labels · 24 sizes". Click the card to open or close it.
5. Inside, each label is one heading row — its name, code, type and "6 sizes", with the total **Required** and **Shortfall** of all its sizes, a status summary (for example "PO Required ×6"), the **Vendor** (or **Mixed** when the sizes have different vendors) and any **PO** numbers. Click the heading to show its sizes: one row per size (**Size XS**, **Size S** …), in size order. When an order has two colours, both colours of a size are added into one size row (it lists both requirement numbers and "2 colours").
6. Tick what you want to order:
   - the box on the card = the whole label set of that style;
   - the box on a label's heading = every size of that label;
   - the box on a size row = just that size.
   When only some of a group are ticked, "3 of 6" shows next to its box. The count at the top right reads "N selected".
7. Order the ticked rows:
   - **Bulk Generate POs** — makes one PO per vendor. Click **Review Prices & GST** to check the lines (a label's sizes sit under one heading there too), then **Generate**.
   - **Manual PO** — puts everything ticked on ONE PO for one supplier. When every ticked row has the same vendor (for example NRM Industries for the House of Kasya labels), that vendor is already chosen. Pick the **Expected Delivery Date**, check the preview, and click **Generate PO**.
8. On the new PO each label shows as one heading row with its sizes beneath, in size order, and each size keeps its own quantity and rate.

## Validation traps
- Only rows with status **PO Required** or **Partially from Stock** can be ticked. Rows already on a PO, received or cancelled have no box.
- A row that reads **All sizes — waiting for the size split** (status **Size Split Pending**) cannot be ordered yet: the order has no size breakup. Add the sizes to the order first; MRP then makes one row per size.
- **Manual PO** with rows of different vendors (or **Not Assigned**) shows "Preferred vendors in this selection: …" and leaves the supplier for you to pick. A label with no vendor (such as a Liva tag with no supplier on its Label page) can still be ordered: tick it, click **Manual PO** and choose the supplier there. **Bulk Generate POs** needs a vendor on every row — set one with **Assign Vendors**, or add the supplier on the label's page so MRP picks it up next time.
- This view shows up to 500 requirements at a time — narrow it by order, style or search when the summary line says "showing first 500 of …".
- Thread cannot be ordered from here; order it from Purchase Orders, in cones / tubes.
