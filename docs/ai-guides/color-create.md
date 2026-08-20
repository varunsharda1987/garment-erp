---
slug: color-create
title: "Add a Colour (Color Master)"
keywords:
  - color
  - colour
  - color master
  - add color
  - naya rang
  - rang kaise banaye
  - hex code
  - color family
  - रंग
  - कलर
  - नया रंग
  - रंग जोड़ें
  - shade
  - colour create
sources:
  - frontend/src/pages/ColorMasterList.tsx
  - frontend/src/pages/ColorMasterForm.tsx
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/types/color.types.ts
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - backend/src/schemas/color.schema.ts
  - backend/src/services/color.service.ts
---

## Steps

1. Open **Materials & Masters → Colors** in the sidebar. The **Colors** link sits under the **Configuration** sub-heading, which is collapsed by default — click **Configuration** first to open it. You can also reach it from **Materials & Masters → All Masters**, then the **Configuration** section, then **Colors**.
2. The page is titled **Color Master**. Before adding, type the colour name in **Search colors...** to check it does not already exist.
3. Click **Add Color** (top right). The form opens as **Add New Color**.
4. Fill **Color Name** — this is the only required field. It must be at least 2 characters and no more than 100.
5. Optional: fill **Hex Code**. It must start with `#` and be 3 or 6 characters after it, for example `#000080`. You can instead click the small square colour picker next to the box and the hex code fills itself. The swatch on the left previews the colour.
6. Optional: choose **Color Family** from the dropdown. Only the listed families are accepted — Reds, Blues, Greens, Yellows, Oranges, Purples, Pinks, Browns, Neutrals, Prints, Metallics. Choose **No Family** to leave it blank.
7. Optional: set **Sort Order** (whole number, 0 or higher). Lower numbers appear first in colour dropdowns everywhere else in the system.
8. Optional: add **Description** notes (max 500 characters).
9. Click **Create Color**. Use **Cancel** or **Back to Colors** to leave without saving.

## Notes and traps

- The **Color Code** (CLR001, CLR002 …) is generated automatically. It is not shown while creating — only when you open an existing colour to edit it.
- Colour names must be unique. If the name is already used you get "Color with name '…' already exists". Search the list first.
- A hex code without the `#`, or with the wrong number of characters, is rejected with "Invalid hex color code format".
- The **Active** switch appears only when editing an existing colour. Inactive colours stop appearing in dropdowns but are not deleted.
- To load many colours at once, use the **Import** button on the Color Master page instead of adding them one by one.
