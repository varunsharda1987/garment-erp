---
slug: dye-lab-dip-create
title: Create a Dyeing Lab Dip
keywords:
  # English
  - lab dip
  - dyeing lab dip
  - dye lab dip
  - shade matching
  - color matching
  - dye sample
  - fabric dyeing
  - color approval
  - bulk dyeing
  # Hinglish
  - lab dip banana
  - dyeing ka lab dip
  - shade milana
  - color matching karna
  - rang match karna
  - fabric ka sample
  # Devanagari
  - लैब डिप
  - डाइंग लैब डिप
  - शेड मैचिंग
  - रंग मिलाना
  - रंग सैंपल
  - कपड़े की रंगाई
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/dyeing/DyeLabDipCreate.tsx
  - frontend/src/pages/DyeingList.tsx
  - frontend/src/components/processing/LabDipBatchCreateForm.tsx
route: /manufacturing/dyeing/lab-dips/new
---

## Before you start

- The style must exist with fabric components defined
- Each fabric component must have a finish type of DYED or PRINTED
- A processor (dyeing/printing supplier) must exist in the system
- Target colors should be set on the style fabrics for dyed items

## Steps

1. Open **Manufacturing > Dyeing & Printing** in the sidebar.

2. On the Dyeing page, click **New Lab Dip** button in the header area (left of "New Job Work Order").

3. In the **Style & Submission** card:
   - **Style** * - Search and select the style. Type at least 2 characters to search. The dropdown shows style code and name.
   - **Submission Date** * - Defaults to today. Change if submitting samples on a different date.

4. After selecting a style, the **Fabrics** table appears showing all DYED and PRINTED fabrics from the style's components. For each fabric row:
   - **Include** - Checkbox to include/exclude this fabric from the batch (checked by default)
   - **Component** - Shows the garment component name (e.g., Shell, Lining, Yoke)
   - **Process** - Badge showing "Dyed" or "Printed"
   - **Fabric** - The fabric name
   - **Greige** - The base greige fabric (if assigned)
   - **Color/Design** - Target color for dyed fabrics, or print design for printed fabrics
   - **Print Method** - For PRINTED fabrics only: Select Screen Machine, Screen Hand, Rotary, or Block
   - **Chemistry** - For PRINTED fabrics only: Select Pigment, Procian, or Discharge
   - **Processor** * - Select the dyeing/printing mill from the dropdown
   - **Expected Date** - Optional target completion date

5. Use the **Select All** checkbox at the top-right of the Fabrics card to toggle all rows.

6. Review the selection summary at the bottom (e.g., "3 fabric(s) selected (2 dyeing, 1 printing)").

7. Click **Create X Lab Dip(s)** to save.

## Traps

- Processor is required for every included row - the form will show an error if any included fabric lacks a processor selection
- For PRINTED fabrics, both Print Method and Chemistry are required
- If no fabrics appear after selecting a style, ensure the style has fabric components with finish type DYED or PRINTED
- Lab dips cannot be created for GREIGE or SOLID finish types - those do not require shade matching

## After saving

- Each included fabric creates a separate lab dip record with status PENDING
- Lab dips appear in the **Lab Dips** tab of the Dyeing page
- Send physical fabric swatches to the processor for shade matching
- When samples return, update the lab dip status to SUBMITTED and record the color match rating
- Approved lab dips can proceed to bulk dyeing via Job Work Orders
