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
  # Hinglish
  - style edit karna
  - style change karna
  - style modify karna
  - style update karna
  - style mein changes
  # Devanagari
  - स्टाइल एडिट
  - स्टाइल बदलना
  - स्टाइल में बदलाव
  - स्टाइल अपडेट
  - स्टाइल संशोधन
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StyleFormRedesigned.tsx
  - frontend/src/pages/StyleList.tsx
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

1. Select a **Size Preset** from customer presets or keep default adult sizes (XS-XXXL)
2. Enable/disable specific sizes using the checkboxes
3. SKU codes are auto-generated but can be customized

### Saving Changes

1. Changes auto-save to local browser storage every 3 seconds
2. Click **Save Draft** to save without publishing
3. Click **Save & Publish** to save and make the style active

## Traps

- **Style Code is immutable** - you cannot change it after creation
- **Customer change resets brand/category** - selecting a different customer clears the brand and category selections
- **Product category change in edit mode** - components are NOT auto-populated from category defaults (only happens in create mode)
- **Draft styles** need to be "Published" before they appear in order dropdowns
- **Published styles with orders** cannot be archived - check for active dependencies first
- **CAD approval is separate** - CAD Planning approval (geometry) is different from Fabric Costing approval (price)
- **Buyer Style Ref for in-house brands** - for Kasya/Nihsamah, the buyer code IS the style code

## After saving

- The style details update immediately in all views
- If published, the style is available for new orders
- CAD Planning data persists - edits here don't affect CAD entries
- Cost sheets linked to the style may need review if components changed
- Style BOM (trims/accessories) updates for downstream processes
- Changes to fabrics may require new CAD planning entries for fabric width allocation
