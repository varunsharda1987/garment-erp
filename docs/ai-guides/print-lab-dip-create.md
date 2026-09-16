---
slug: print-lab-dip-create
title: Create a Printing Lab Dip
keywords:
  # English
  - print lab dip
  - printing lab dip
  - print sample
  - screen print sample
  - rotary print
  - block print
  - pigment print
  - procian print
  - discharge print
  - print trial
  - printing mill
  - print color approval
  # Hinglish
  - print ka lab dip
  - printing lab dip banana
  - print sample banana
  - printing trial
  - print mill bhejana
  - printing approval
  # Devanagari
  - प्रिंट लैब डिप
  - प्रिंटिंग लैब डिप
  - प्रिंट सैंपल
  - प्रिंटिंग ट्रायल
  - प्रिंट मिल
  - छपाई का सैंपल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/printing/PrintLabDipCreate.tsx
  - frontend/src/pages/PrintingList.tsx
  - frontend/src/components/processing/LabDipBatchCreateForm.tsx
route: /manufacturing/printing/lab-dips/new
---

## Before you start

- The **Style** must exist with fabrics marked as "Printed" finish type.
- A **Processor** (printing mill) must be registered in Suppliers with category DYEING_PRINTING.
- Know which **Print Method** (Screen Machine, Screen Hand, Rotary, Block) will be used.
- Know which **Print Chemistry** (Pigment, Procian, Discharge) is needed.

## Steps

1. Open **Manufacturing** in the sidebar, then click **Dyeing & Printing**.
2. Click the **Lab Dips** tab if not already selected.
3. Click **New Lab Dip** button in the header.
4. In the **Style & Submission** card:
   - Click the **Style** dropdown and search for the style by code or name.
   - Select the style from the results.
   - Set the **Submission Date** (defaults to today).
5. The system loads all fabrics from the style. A table appears showing:
   - **Include** checkbox (all selected by default)
   - **Component** name
   - **Process** badge (shows "Printed" for printing fabrics)
   - **Fabric** and **Greige** names
   - **Color/Design** (the print design name)
6. For each printed fabric row:
   - Select a **Print Method**: Screen Machine, Screen Hand, Rotary, or Block.
   - Select a **Chemistry**: Pigment, Procian, or Discharge.
   - Select a **Processor** (the printing mill).
   - Optionally set an **Expected Date** for the lab dip return.
7. Use the **Select All** checkbox to include or exclude all rows at once.
8. Review the count at the bottom (e.g., "3 fabric(s) selected (0 dyeing, 3 printing)").
9. Click **Create X Lab Dip(s)** to submit.

## Traps

- **Print Method required**: Every printed fabric must have a Print Method selected; the form will not submit without it.
- **Chemistry required**: Every printed fabric must have a Chemistry selected.
- **Processor required**: Every included row needs a Processor assigned.
- **No printed fabrics**: If the style has no fabrics with "Printed" finish type, the table will be empty or show only dyed fabrics.
- **Mixed batch**: This form creates both dyeing and printing lab dips together for the same style; printing rows are marked with "Printed" badge.

## After saving

- Lab dip records are created with status **Pending**.
- Each fabric becomes a separate lab dip entry.
- Track progress from **Manufacturing > Dyeing & Printing > Lab Dips** tab.
- Update status to Submitted when sent to the mill, then Approved or Rejected after receiving results.
- Once approved, you can proceed with bulk printing job work orders.
