---
slug: drawstring-create
title: Add a Drawstring
keywords:
  # English
  - drawstring
  - drawstring master
  - cord
  - nada
  - naada
  - dori
  - elastic cord
  - trim master
  - add drawstring
  - new drawstring
  - drawstring code
  - aglets
  - threads and tapes
  - DST
  # Hinglish
  - drawstring add karna
  - drawstring banana
  - naya drawstring
  - dori banana
  - nada banana
  - naadi banana
  - naada add karna
  - drawstring kaise banaye
  - drawstring supplier
  # Devanagari (MANDATORY)
  - ड्रॉस्ट्रिंग
  - नाड़ा
  - नाड़ी
  - डोरी
  - इलास्टिक कॉर्ड
  - ट्रिम
  - नया ड्रॉस्ट्रिंग
  - ड्रॉस्ट्रिंग कैसे बनाये
  - एगलेट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/GenericTrimList.tsx
  - frontend/src/pages/GenericTrimForm.tsx
  - frontend/src/types/genericTrim.types.ts
  - frontend/src/services/genericTrim.service.ts
  - frontend/src/config/trimTypeRegistry.ts
route: /materials/drawstring/new
---

## Steps
1. Open **Materials & Masters** in the sidebar, then click **Trims Dashboard**. The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under the **Threads & Tapes** section, click **New Drawstring**.
   (Alternative: expand the **Threads & Tapes** category on the dashboard, click the **Drawstring** card, then click **Add New Drawstring** on the list page.)
3. The form opens with heading **Add New Drawstring**.
4. **Drawstring Name** is optional. Leave it empty to auto-generate the name from attributes (e.g., "Red Cotton 5mm Drawstring"). Fill it only if you want to override. Below it, **Counted in: Meter** shows how a drawstring is counted on every BOM, cost sheet and requirement — it is not something you choose.
5. Fill the fields you know:
   - **Width/Diameter** — select from 3mm, 5mm, 8mm, or 10mm
   - **Material** — select from Cotton, Polyester, Nylon, Leather, or Waxed
   - **Color** — type the colour (free text)
   - **Has Aglets** — toggle on if the drawstring has aglet tips
   - **Price Per Meter** — enter the rate in rupees (optional)
6. **Supplier** — select a supplier from the dropdown. Only suppliers already in the system appear. If you need to add one first, save the form, go to **Materials & Masters → Suppliers**, add the supplier with category "Trims Supplier", then return to edit the drawstring.
7. **Description** — add any notes as needed (optional).
8. Click **Create Drawstring**. You return to the **Drawstring Master** list showing the new entry with an auto-generated code (e.g., DST-000001).
9. To cancel without saving, click **Cancel** or the back arrow.

## Edit or Delete
- From the list, click **Edit** on any row to update. Press **Update Drawstring** when done.
- Click **Delete** to remove. A confirmation dialog asks you to confirm.
- The drawstring code never changes after creation.

## Traps
- **Width as NaN** — if you type text in a numeric field and blur, the value becomes empty/null; this is fine but be aware the field will clear rather than storing text.
- **Supplier not showing** — the supplier must exist first and be marked active. If missing, create the supplier before the drawstring.
- **Name auto-generate** — if all attribute fields are empty and no name is typed, the name defaults to "Drawstring" plus the code. Fill at least one attribute for a meaningful auto-name.
- **Price is optional** — leaving it empty is allowed; the drawstring saves without a price.
- **Dori with a tassel is two items** — the dori is a drawstring (metres); the tassel is created separately under **Other Decorative** (pieces). Add both to the style's trims.
- **Unit locked once used** — a drawstring already on a BOM, cost sheet, PO or stock cannot change its unit on the Materials page; create a separate item instead.
