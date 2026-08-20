---
slug: greige-create
title: Add a Greige Master
keywords:
  - greige
  - greage
  - grey fabric
  - greige master
  - GRG
  - kora kapda
  - greige kaise banaye
  - naya greige
  - ग्रेज
  - कोरा कपड़ा
  - कपड़ा
  - मास्टर
  - चौड़ाई
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/App.tsx
  - frontend/src/pages/GreigeForm.tsx
  - frontend/src/pages/GreigeList.tsx
  - backend/src/schemas/fabricGreige.schema.ts
  - backend/src/services/greige.service.ts
---

## Steps

1. Open **Materials & Masters → Greige Master** in the sidebar.
2. Click **+ New Greige** at the top right. The page title becomes **New Greige Master**.
3. **Greige Code** is filled automatically (format GRG-XXXX) and cannot be typed. Leave it as it is.
4. In **Generic Greige Name**, search or type the plain fabric family, for example Cambric or Poplin. This field is required.
5. Fill **Yarn Count** and **Construction**. Both are required.
6. Enter **Composition** (required), for example 100% Cotton.
7. **Greige Name** builds itself from Generic Name + Yarn Count / Construction / Width. It is read-only. Watch the green **Preview** line under it to confirm the name looks right.
8. Optional in this section: **Weave Type** (Plain, Twill, Satin, Jersey, Rib, Interlock), **Greige Quality** (Printing, Dyeing, Super Dyeing), **Weaver**, **GSM Range**. Greige Quality is added to the end of the name when set.
9. Under **Width & Shrinkage**, enter **Greige Width (inches)**. Required, and must be more than 0.
10. **Default Cutable Width (inches)** is optional. Leave blank and the system uses Greige Width minus 4 in CAD Planning.
11. Leave **Fallback Shrinkage (%)** blank in normal cases. The processor rate card is the real source of shrinkage. If you do enter a value it must be below 100.
12. **Expected Finished Width Min / Max (inches)** are optional.
13. Under **Suppliers**, click **+ Add Supplier**, pick a supplier, and tick **Preferred Supplier** or **Active** as needed. This section can be left empty.
14. Add **Description** or **Notes** if useful, keep **Active** ticked, then click **Create Greige**.

## Traps

- If a field is missing you get one message listing every missing field. Fill them all before saving again.
- The same **Greige Name** plus the same **Greige Quality** cannot exist twice. If that pair already exists, the save is rejected and the existing code is shown. Use a different quality or edit the existing entry instead.
