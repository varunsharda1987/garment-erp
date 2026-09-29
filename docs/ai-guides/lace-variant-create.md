---
slug: lace-variant-create
title: Create a Dyed Lace Variant
keywords:
  # English
  - dyed lace
  - lace variant
  - colored lace
  - lace color
  - finished lace
  - lace dyeing
  - create variant
  - greige to dyed
  # Hinglish
  - dyed lace banana
  - lace ka color
  - lace variant banana
  - greige se dyed
  - finished lace banana
  # Devanagari
  - डाइड लेस
  - लेस वेरिएंट
  - रंगीन लेस
  - लेस का कलर
  - फिनिश्ड लेस
  - ग्रेज से डाइड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/LaceForm.tsx
  - frontend/src/pages/LaceList.tsx
  - frontend/src/components/cost-sheet/LaceSourcingStrategySelector.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/LaceCombobox.tsx
route: /materials/lace
---

## Before you start

- A **greige (raw/undyed) lace master** must already exist in the system
- If creating from Cost Sheet: the style must have a cost sheet with lace added

## Method 1: From Lace Master (full control)

Use this when you want to pre-create dyed variants before costing.

### Steps

1. Go to **Materials & Masters** > **Trims Dashboard** in the sidebar, then click the **Laces** quick-access button (or open `/materials/lace` directly)
2. Click **+ Add New Lace** button
3. Under **Lace Nature**, select **Ready-to-Use (Finished)**
   - This indicates the lace is colored and ready for production
4. Fill in the required fields:
   - **Lace Name**: Leave empty to auto-generate from attributes, or enter manually
   - **Lace Type**: Select from dropdown (e.g., Chantilly, Guipure)
   - **Color**: Select from Color Master (required for finished lace)
   - **Width**: Enter width in inches
   - **Source Greige Lace (Optional)**: Click **Link to source greige lace...** and type part of the greige lace's code, name or colour, then pick the greige lace this was dyed from (the field appears once at least one greige lace exists)
   - **Price per Meter**: Enter the ready lace rate
5. Optionally add suppliers with their prices under the **Suppliers** section
6. Click **Create Lace** to save

## Method 2: From Cost Sheet (inline creation)

Use this when costing a style that uses greige lace - the system creates the variant automatically.

### Steps

1. Open a **Cost Sheet** for your style
2. In the **Lace Costing** section, add a greige lace
3. Click on the lace row to open the **Sourcing Strategy** modal
4. In the **Greige + Dyeing** tab, look for the **Dye this greige lace** section
5. Pick the colour in **Dye to Colour**
6. Optionally pick a dyer in **Processor (optional)**
7. Click **Create Dyed Variant & Cost**
8. The system will:
   - Create (or reuse) a finished lace variant with that color
   - Calculate the greige cost + processing cost
   - Update the cost sheet row to point to the new variant

## Find a lace on the list

1. On the **Lace Management** list, type in the search box (**Search code, name, lace type, color, style, supplier…**).
2. Pick a supplier in the **All suppliers** picker. Type to search the supplier list.
3. Click **Clear N filters** to reset the filters and go back to page 1.
4. If nothing matches, the list says **No lace items match these filters.** Click **Clear filters** to see every lace.

## Traps

- **Greige must exist first**: You cannot create a dyed variant without linking it to a source greige lace
- **Color is required**: Finished/dyed lace must have a color selected - greige lace cannot have color
- **Processor rate card needed**: For cost sheet inline creation, the processor must have a rate card for lace dyeing with shrinkage % configured
- **Duplicate detection**: The cost sheet inline flow reuses an existing variant if one already exists for that greige + color combination
- **Price source priority**: The preferred supplier's price takes priority over the master price for cost calculations

## After saving

- The dyed variant appears in the Lace Master list as **Processed**, with a link back to its source greige and, when it was made for a style, that style named by its Buyer Style Code first (our Style Code in brackets when different). The **Styles** column lists the styles using it the same way
- The variant is available for selection in orders and BOMs
- Cost sheets can now use the GREIGE_PROCESSED strategy with this variant
- MRP will split requirements into greige purchase + dyeing job work order
