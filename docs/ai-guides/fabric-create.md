---
slug: fabric-create
title: Add a Finished Fabric Master
keywords:
  - fabric
  - fabric master
  - finished fabric
  - dyed fabric
  - printed fabric
  - FAB
  - kapda master
  - naya fabric kaise banaye
  - कपड़ा
  - फैब्रिक
  - मास्टर
  - रंगाई
  - छपाई
  - चौड़ाई
  - filter fabric
  - fabric filter
  - find fabric
  - search fabric
  - fabric kaise dhunde
  - fabric list filter
  - filter lagao
  - colour filter
  - color filter
  - finish type filter
  - gsm filter
  - फ़िल्टर
  - फिल्टर
  - खोजें
  - ढूंढें
  - छाँटें
  - रंग
  - फिनिश
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/App.tsx
  - frontend/src/pages/FabricForm.tsx
  - frontend/src/pages/FabricList.tsx
  - frontend/src/constants/fabric-finish-types.ts
  - frontend/src/components/filters/FilterBar.tsx
  - frontend/src/components/filters/MultiSelectFilter.tsx
  - frontend/src/components/filters/NumberRangeFilter.tsx
  - backend/src/schemas/fabricGreige.schema.ts
  - backend/src/services/fabric.service.ts
route: /fabric/new
---

## Before you start

The fabric should point at a greige. If the greige master does not exist yet, you can create it from inside this form, so you do not have to leave the page.

## Find it before you add it

Check the list first so you do not enter the same fabric twice. On
**Materials & Masters → Fabric Master** the filter bar above the table narrows the list:

- **Search** matches code, name or colour.
- **Finish Type**, **Generic Name**, **Colour** and **Source** each let you tick **several** values
  at once. Each option shows how many fabrics use it.
- **Greige** and **Supplier** are search boxes — start typing to narrow the list, and pick
  **All Greige** or **All Suppliers** to remove the filter.
- **Generic** separates general stock fabric from style-specific fabric.
- **GSM** and **Width (")** take a Min and a Max box. Leave either box empty for no limit.
- The line above the table reads, for example, *Showing 12 of 30 fabric masters · 3 filters applied*.
- **Clear N filters** at the end of the bar removes everything and returns Status to Active Only.

Your filters stay in the page address, so opening a fabric and pressing Back returns you to the
same filtered list, and you can send the address to a colleague to show them the same view.

If the fabric already exists, open it and edit it rather than adding a second entry.

## Steps

1. Open **Materials & Masters → Fabric Master** in the sidebar.
2. Click **+ New Fabric**. The page title becomes **New Fabric Master**.
3. In the **Source & Linking** card, choose **Source** (required): **Style-Linked** for fabric made for one style, or **Stock/Generic** for general stock fabric. Source cannot be changed later, so pick correctly.
4. If you chose **Style-Linked**, search the **Style** by style code, then tick one or more **Components**. Both are required for this source.
5. If the component uses embroidery, a purple panel appears. Set **This fabric will be embroidered** to Yes or No, and pick an **Embroidery Design** if it is decided.
6. Choose **Finish Type** (required): Solid/Dyed, Printed, Yarn Dyed, or Raw/Unfinished. Choosing Printed reveals the **Print Design** box.
7. Select **Pattern Parts** and **Color** if they apply. Pattern parts only load after a style and component are picked.
8. In the **Fabric Details** card, **Code** and **Fabric Name** fill themselves and are read-only. The name is built from style, greige, finish, pattern part, colour and width.
9. Fill **Generic Greige Name**, or pick an existing greige in the **Greige Name** dropdown. One of the two is required. Selecting a greige fills the generic name and cutable width for you.
10. To create a missing greige on the spot, click **New** next to the **Greige Name** dropdown.
11. In the **Specifications** card, enter **Width"** (required, more than 0). **Cutable"** fills itself as Width minus 2, unless the fabric is embroidered, where you type it yourself. **GSM**, **Yarn Count**, **Construction** and **Composition** are optional.
12. Add rows under **Suppliers** with **+ Add Supplier** if you know them.
13. Click **Create Fabric**.

## Traps

- If no greige is linked but you gave a generic name and width, a dialog **Create Greige Automatically?** appears. Choose **Create Greige & Save** to also create the greige, or **Save Without Greige**.
- Missing fields are reported together in one message, so read the whole list.
- Fabric codes must be unique. A repeated code is rejected.
- Style allocation is a second step after saving. If the fabric saves but allocation fails you get a warning, and you can retry from **Allocated Styles → + Allocate to Style** when editing the fabric.
