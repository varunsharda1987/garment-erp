---
slug: embroidery-create
title: Create an Embroidery Design
keywords:
  # English
  - embroidery
  - embroidery design
  - embroidery master
  - kadai design
  - embroidery pattern
  - create embroidery
  - add embroidery
  - new embroidery
  # Hinglish
  - embroidery design banana
  - embroidery design add karna
  - kadai ka design
  - naya embroidery
  # Devanagari
  - एम्ब्रॉयडरी
  - एम्ब्रॉयडरी डिज़ाइन
  - कढ़ाई डिज़ाइन
  - कढ़ाई मास्टर
  - नया एम्ब्रॉयडरी बनाओ
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/EmbroideryForm.tsx
  - frontend/src/pages/EmbroideryList.tsx
route: /embroidery/new
---

## Before you start

- Design image URL ready (optional but recommended for visual reference)
- Design file URL ready if you have a DST/PES file (optional)
- Know the usable width after embroidery in inches
- Know the cost per meter

## Steps

1. Open **Materials & Masters** in the sidebar.
2. Click **Embroidery Master**.
3. Click the **Add Design** button (top-right).
4. Fill in the **Design Information** section:
   - **Embroidery Code** is auto-generated (e.g., EMB-202512-0001)
   - Enter the **Design Name** (required) - e.g., "Floral Vine Pattern"
   - Optionally add a **Design Image URL** for preview
   - Optionally add a **Design File URL** for the embroidery file (DST, PES, etc.)
5. Fill in the **Design Specifications** section (all optional):
   - **Stitch Count** - total stitches in the design
   - **Thread Colors** - number of thread colors used
   - **Repeat Width (inches)** - horizontal repeat measurement
   - **Repeat Height (inches)** - vertical repeat measurement
6. Fill in the **Width Impact** section:
   - **Usable Width After Embroidery (inches)** (required) - the cuttable width after embroidery is complete
7. Fill in the **Costing** section:
   - **Cost per Meter** in rupees (required)
   - **Lead Time (days)** (optional) - production lead time
8. Optionally select a **Supplier** in the Supplier Information section.
   - Only suppliers in the EMBROIDERY category appear
   - Use "Clear supplier" to remove selection
9. Optionally add a **Description** for additional notes.
10. Click **Create Design** to save.

## Traps

- **Required fields**: Design Name, Usable Width After Embroidery, and Cost per Meter must all be filled
- **Usable width must be positive**: Enter a valid positive number for usable width
- **Cost cannot be negative**: Cost per meter must be zero or greater
- **Supplier filter**: Only suppliers marked as EMBROIDERY category appear in the dropdown

## After saving

- The design appears in the Embroidery Master list with an auto-generated code
- The design is now available for selection in Style BOM and Cost Sheet
- You can edit it later by clicking the pencil icon in the list
- You can toggle the Active/Inactive status when editing to hide designs from dropdowns
- Designs used in styles cannot be deleted (delete button is disabled when "Used In" count > 0)
