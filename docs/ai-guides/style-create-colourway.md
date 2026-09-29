---
slug: style-create-colourway
title: Create a Colourway (Copy a Style in Another Colour)
keywords:
  - colourway
  - colorway
  - color way
  - colour way
  - create colourway
  - new colour of style
  - same style different colour
  - style in another colour
  - copy style
  - duplicate style
  - clone style
  - copy style change colour
  - copy style change color
  - style copy karna
  - style copy kaise kare
  - style duplicate kaise kare
  - dusre colour me style
  - naya colour banana
  - colour badal ke style
  - rang badalna
  - colourways list
  - other colours of style
  - रंग
  - रंग बदलकर स्टाइल कॉपी
  - स्टाइल कॉपी
  - स्टाइल डुप्लीकेट
  - दूसरे रंग में स्टाइल
  - नया रंग
  - कलरवे
  - कलर वे
  - कलर बदलना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/StyleList.tsx
  - frontend/src/pages/StyleDetail.tsx
  - frontend/src/components/styles/CreateColourwayDialog.tsx
  - backend/src/schemas/style.schema.ts
  - backend/src/routes/style.routes.ts
  - backend/src/services/style-colourway.service.ts
route: /styles
---

## Before you start

A colourway is its own style: the same garment in another colour, with its own Style Code, its own SKUs and usually its own Buyer Style Code from the buyer. **Create Colourway** copies an existing style so you only change what differs. Have the buyer's code for the new colour ready if they gave one.

## Steps

1. Open **Styles** in the sidebar (a top-level item).
2. On the **Style Master** page, find the style and click **View** on its row.
3. At the top right of the style page, click **Create Colourway** (next to **Edit Style**). The button is not shown on an archived style.
4. In the **Create Colourway** window, pick **New Colour** (required) from the colour list. The line under it shows the style's current colour. The same colour as the style is refused.
5. Fill **Buyer Style Code** — the buyer's code for this colour. Leave it blank if there is none yet. Our **Style Code** is made automatically, the same way as for a new style.
   - For an in-house brand whose Style Code is its Buyer Style Code (for example LNG182P), the box is labelled **Style Code (also the Buyer Style Code)** and is required: type the new code (for example LNG182Y). It becomes both codes.
6. **Style Name** is filled with the style's name. Change it if the new colour has its own name. If you leave it blank, the new style is named by its new Style Code.
7. Check the **Fabrics** list: every fabric in the style's colour shows **old colour → new colour**; a fabric in another colour (a contrast) or a print shows **stays …** and is copied unchanged.
8. Click **Create Colourway**. The new style opens straight in **Edit Style**.
9. In Edit Style, change any trim whose colour follows the garment (thread, elastic, lace, buttons, zips) and any print design, then save.
10. Open the new style's **CAD Planning**: the CAD rows are there with their marker images, waiting for approval. Approve them, then do Fabric Costing for the new colour.

## What is copied and what is not

- **Copied:** components, fabrics (in the new colour where they matched), trims with the same items, quantities and rates, sizes (with new SKUs made from the new Style Code), processes, tech spec, sketches, and the CAD rows (except Production CADs) with their sizes and marker images.
- **Not copied:** fabric costing and cost sheets (the dyeing rate can change with the shade), the product photo, samples, orders and stock. The CAD rows are copied **unapproved**.

## Colourways list

On a style that has colourways, the **Overview** tab shows a **Colourways** card with every colour of the style (the original and each copy). The current style is marked **This style**; click any other one to open it. A colourway made from a colourway joins the same list.

## Traps

- **Buyer Style Code** must be unique across active styles. A code already on another style is refused with "Buyer Style Code … already exists on style …". Each colour needs its own code, or none.
- The window warns **Already a colourway in this colour** when the group already has one in the picked colour. It still lets you make another (a buyer can give two codes for one colour).
- The product photo is not copied, because it shows the old colour. Upload the new colour's photo in Edit Style.
- Styles made as separate styles before this feature (same name, different colour) are not linked in the Colourways card.
