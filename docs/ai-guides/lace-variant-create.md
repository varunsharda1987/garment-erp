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
route: /materials/lace
---

## Before you start

- A **greige (raw/undyed) lace master** must already exist in the system
- If creating from Cost Sheet: the style must have a cost sheet with lace added

## Method 1: From Lace Master (full control)

Use this when you want to pre-create dyed variants before costing.

### Steps

1. Go to **Materials** > **Trims Dashboard** > **Laces** (or directly `/materials/lace`)
2. Click **+ Add New Lace** button
3. Under **Lace Nature**, select **Ready-to-Use (Finished)**
   - This indicates the lace is colored and ready for production
4. Fill in the required fields:
   - **Lace Name**: Leave empty to auto-generate from attributes, or enter manually
   - **Lace Type**: Select from dropdown (e.g., Chantilly, Guipure)
   - **Color**: Select from Color Master (required for finished lace)
   - **Width**: Enter width in inches
   - **Source Greige Lace**: Select the greige lace this was dyed from
   - **Price per Meter**: Enter the ready lace rate
5. Optionally add suppliers with their prices under the **Suppliers** section
6. Click **Create Lace** to save

## Method 2: From Cost Sheet (inline creation)

Use this when costing a style that uses greige lace - the system creates the variant automatically.

### Steps

1. Open a **Cost Sheet** for your style
2. In the **Lace Costing** section, add a greige lace
3. Click on the lace row to open the **Sourcing Strategy** modal
4. In the **Greige + Processing** tab, look for **Dye this greige** section
5. Select a **Color** from the Color Picker
6. Optionally select a **Processor** (dyer) from the dropdown
7. Click **Create Dyed Variant**
8. The system will:
   - Create (or reuse) a finished lace variant with that color
   - Calculate the greige cost + processing cost
   - Update the cost sheet row to point to the new variant

## Traps

- **Greige must exist first**: You cannot create a dyed variant without linking it to a source greige lace
- **Color is required**: Finished/dyed lace must have a color selected - greige lace cannot have color
- **Processor rate card needed**: For cost sheet inline creation, the processor must have a rate card for lace dyeing with shrinkage % configured
- **Duplicate detection**: The cost sheet inline flow reuses an existing variant if one already exists for that greige + color combination
- **Price source priority**: The preferred supplier's price takes priority over the master price for cost calculations

## After saving

- The dyed variant appears in the Lace Master list with a link back to its source greige
- The variant is available for selection in orders and BOMs
- Cost sheets can now use the GREIGE_PROCESSED strategy with this variant
- MRP will split requirements into greige purchase + dyeing job work order
