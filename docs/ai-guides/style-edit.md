---
slug: style-edit
title: Edit an Existing Style
keywords:
  # English
  - edit style
  - modify style
  - update style
  - change style
  - style form
  - style details
  - update fabric
  - change trims
  - edit components
  - size preset
  - size category preset
  - size preset resets to none
  # Hinglish
  - style edit karna
  - style change karna
  - style modify karna
  - style update karna
  - style mein changes
  - size preset save nahi hota
  - size preset none ho jata hai
  # Devanagari
  - स्टाइल एडिट
  - स्टाइल बदलना
  - स्टाइल में बदलाव
  - स्टाइल अपडेट
  - स्टाइल संशोधन
  - साइज़ प्रीसेट
  - साइज प्रीसेट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StyleFormRedesigned.tsx
  - frontend/src/pages/StyleList.tsx
  - backend/src/schemas/style.schema.ts
  - backend/src/services/style.service.ts
route: /styles
---

## Steps

### Finding the Style

1. Click **Styles** in the sidebar (top-level item)
2. Use the search bar to find the style by code, name, buyer, or brand
3. The list shows Active, Drafts, and Inactive tabs
4. Click the **Edit** button on the style row (requires ADMIN or MERCHANDISER role)

### Editing Basic Info (Tab 1)

1. The style opens in edit mode at `/styles/{id}/edit`
2. The **Style Code** cannot be changed after creation
3. You can modify:
   - **Style Name** - descriptive name for the style
   - **Buyer's Style Ref** - customer's own reference number
   - **Customer** - changing customer resets brand and category
   - **Brand** - select from customer's configured brands
   - **Category** - select from brand's categories
   - **Season** - collection/season assignment
   - **Color** - primary color
   - **Product Category** - 3-level hierarchy (L1 > L2 > L3)
4. Expand **Additional Details** for:
   - Cost Price (MRP)
   - Selling Price
   - Expected Order Qty
   - HSN Code
   - Remarks
5. Adjust **Number of Components** if the garment structure changed
6. Select or change components from the dropdown (filtered by product category)

### Editing Fabrics (Tab 2)

1. Each component section shows its assigned fabrics
2. Click **+ Add Fabric** to add a new fabric to a component
3. For each fabric, choose:
   - **Sourcing Mode**: GREIGE (generic greige name) or READY_FABRIC (select from fabric master)
   - **Fabric Finish Type**: DYED, PRINTED, YARN_DYED, or RAW
   - **Color** (for DYED) or **Print Design** (for PRINTED/YARN_DYED)
4. Toggle **Embroidery** on to attach an embroidery design
5. Click the trash icon to remove a fabric

### Editing Trims & Materials (Tab 3)

1. Use the **Trim Selector** to add or remove trims
2. Available trim types: Button, Thread, Zipper, Elastic, Lace, Hook & Eye, Snap Button, Buckle, Belt, Velcro, Drawstring, Ribbon, Sequin, Bead, Motif, Interlining, Padding, and more
3. Search and select trims from the master data
4. Click the X to remove a trim

### Editing Accessories (Tab 4)

1. Select a **Customer Accessory Preset** to auto-populate labels and packaging
2. Preset items show a badge indicator
3. Add style-specific accessories using the selector
4. Both LABELs and PACKAGING items are saved to the style BOM

### Editing Sizes & SKUs

1. On **1. Basic Info**, scroll to **Size Variants & SKUs**
2. If the customer has size presets, **Size Category Preset (Optional)** shows the preset saved with the style (or **None (Manual Sizes)**)
3. To change it, pick another preset, or **None (Manual Sizes)** for the standard XS-XXXL list. The size list is replaced, but a size that stays keeps its SKU code and barcode
4. Sizes from the preset show a small **\*** and the line **size(s) from preset - you can add more sizes manually**
5. Enable/disable specific sizes using the checkboxes
6. Click **Auto-Generate SKUs** to fill SKU codes (empty SKUs are also filled when you save); codes can be typed over

### Saving Changes

1. Changes auto-save to local browser storage every 3 seconds
2. Click **Save as Draft** to save without publishing
3. Click **Update Style** to save your changes
4. A draft style also shows **Publish Style** — click it and confirm to make the style active

## Traps

- **Style Code is immutable** - you cannot change it after creation
- **Customer change resets brand/category** - selecting a different customer clears the brand and category selections, and the **Size Category Preset** choice (the sizes on screen stay)
- **Styles saved before 25-Sep-2026 show None (Manual Sizes)** - the preset choice was not saved then, even though the sizes came from it. Pick the preset again and click **Update Style**; the SKU codes and barcodes of sizes already on the style are kept
- **Unticked sizes are dropped from sale orders** - a size unticked here stops being offered in the sale order Size list
- **Product category change in edit mode** - components are NOT auto-populated from category defaults (only happens in create mode)
- **Draft styles** need to be "Published" before they appear in order dropdowns
- **Published styles with orders** cannot be archived - check for active dependencies first
- **CAD approval is separate** - CAD Planning approval (geometry) is different from Fabric Costing approval (price)
- **Changing a fabric's greige or finish drops its received fabric** - Once dyed or printed fabric has been received, the fabric row is linked to it, and saving the style keeps that link. Changing that row's **Generic Greige Name** or **Fabric Finish Type**, or switching **Ready Fabric** back to **Greige / Process**, removes the link — CAD Planning then cannot match the received lots to the style until it is linked again
- **Buyer Style Ref for in-house brands** - for Kasya/Nihsamah, the buyer code IS the style code

## After saving

- The style details update immediately in all views
- If published, the style is available for new orders
- CAD Planning data persists - edits here don't affect CAD entries
- Cost sheets linked to the style may need review if components changed
- Style BOM (trims/accessories) updates for downstream processes
- Changes to fabrics may require new CAD planning entries for fabric width allocation
