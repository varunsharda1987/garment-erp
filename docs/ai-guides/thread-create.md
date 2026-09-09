---
slug: thread-create
title: Add a Thread (Thread Master)
keywords:
  - thread
  - THR
  - THD
  - thread master
  - sewing thread
  - dhaga
  - cone
  - spool
  - ply
  - thread kaise banaye
  - naya dhaga
  - धागा
  - थ्रेड
  - कोन
  - नया धागा
  - thred
  - 2-ply
  - 3-ply
  - two ply
  - three ply
  - tube
  - meters per unit
  - invalid request data
  - thread supplier
  - dhaga kaise banaye
  - thread master kaise banaye
  - थ्रेड मास्टर
  - सिलाई धागा
  - प्लाई
  - स्पूल
  - ट्यूब
  - धागा सप्लायर
  - dhaaga
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ThreadList.tsx
  - frontend/src/pages/ThreadForm.tsx
  - frontend/src/types/thread.types.ts
  - frontend/src/types/supplier.types.ts
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/ColorPicker.tsx
  - frontend/src/services/thread.service.ts
  - frontend/src/lib/api-error-handler.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/routes/thread.routes.ts
  - backend/src/middleware/validation.middleware.ts
  - backend/src/controllers/thread.controller.ts
  - backend/src/utils/code-generator.ts
---

## Before you start
Nothing is mandatory first. To link a supplier, that supplier must already exist **and be saved with category "Thread Supplier"** — only thread suppliers appear in the dropdown. The colour must already exist in the Colour Master. Read the Ply trap in step 7 before you start filling the form.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar (it is listed under **Fabric & Materials**). The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Threads & Tapes** choose **New Threads**.
   (Alternative: expand the **Threads & Tapes** card, click the **Threads** tile to reach **Thread Management**, then click **+ Add New Thread**.)
3. The form opens with the heading **Create New Thread**; the fields sit under **Thread Information**.
4. **Thread Code** is greyed out and marked **Auto-generated**. Do not type it — the system assigns it on save (THR-0001, THR-0002 …). The placeholder shows "THD-000001", but the real code starts with THR.
5. **Thread Name**: leave it empty. The name is built automatically from Brand, Colour, Packaging Type and Meters per Unit (for example "Brand Colour CONE Thread 5000m"). Type a name only if you want to override it.
6. Fill **Brand** (the thread maker's name).
7. **Ply** — trap: do NOT choose a Ply. Selecting **2-Ply** or **3-Ply** makes **Create Thread** fail with "Failed to create thread: Invalid request data", because the form sends the ply as text and the server expects a number. Leave it on "Select ply...". The dropdown cannot be cleared once picked — if you already chose one, reload the form and start again.
8. **Material Composition** (**Polyester** or **Cotton**) can be chosen, but because of the Ply trap the new packaging types **Spool**, **Cone 5,000m** and **Cone 10,000m** (which only appear after BOTH Ply and Material Composition are set) cannot be saved either. Skip it unless you only want it recorded.
9. **Packaging Type**: choose **Cone (6 pcs/box) - Legacy** or **Tube (10 pcs/box) - Legacy** — these are the two options you can save.
10. **Pieces per Box** is read-only. The system fills it from the Packaging Type (Cone: 6, Tube: 10). Do not try to type in it. (**Units per Box** only appears for the new packaging types.)
11. **Meters per Unit** is the length on one cone or tube. It must be a number greater than zero — 0 or a minus value is rejected with "Invalid request data".
12. **Color**: pick from the Colour Master list — it is not typed. Narrow the list with the **All Families** filter if needed. If the shade is missing, use the **add a new color** link (opens the Colour form in a new tab), create it, then come back and pick it.
13. **Default Price per Cone/Tube (₹)** is optional and cannot be negative. It is the fallback used when no supplier price exists.
14. **Suppliers**: click **Add Supplier**, pick the **Supplier**, tick **Preferred Supplier** for your main source and keep **Active** ticked; add **Notes** if useful. Trap: **Price/Cone (₹)** on a supplier row is NOT saved — the server drops it silently. Keep the price in **Default Price per Cone/Tube (₹)** instead.
15. Trap: a supplier row where no supplier was chosen is dropped silently on save. Remove empty rows with the bin icon.
16. Optional: enter the **Supplier Reference Code** under **Reference Codes**, and pick **Associated Styles** under **Style Associations** (only existing styles can be selected). Add any **Description** under **Additional Information**.
17. Click **Create Thread**. You land back on the **Thread Management** list with the new code visible.

To change it later, open the thread and use **Update Thread**. If you did not type the name yourself, it re-generates when you change Brand, Colour, Packaging Type or Meters per Unit. The Ply trap applies on update too. The code never changes.
