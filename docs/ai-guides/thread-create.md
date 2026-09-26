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
  - ply select
  - ply save
  - ply kaise chune
  - 2 ply
  - 3 ply
  - material composition
  - polyester thread
  - cotton thread
  - cone 5000
  - cone 10000
  - units per box
  - pieces per box
  - packaging specifications
  - price per cone
  - supplier price
  - supplier row
  - प्लाई सेव
  - कोन 5000
  - यूनिट्स प्रति बॉक्स
  - सप्लायर प्राइस
  - पॉलिएस्टर धागा
  - कॉटन धागा
  - box size
  - cones per box
  - tubes per box
  - कोन प्रति बॉक्स
  - ट्यूब प्रति बॉक्स
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ThreadList.tsx
  - frontend/src/pages/ThreadForm.tsx
  - frontend/src/types/supplier.types.ts
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/ColorPicker.tsx
  - frontend/src/services/thread.service.ts
  - frontend/src/lib/api-error-handler.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/schemas/common.schema.ts
  - backend/src/schemas/generated/prisma-enums.ts
  - backend/src/routes/thread.routes.ts
  - backend/src/middleware/validation.middleware.ts
  - backend/src/controllers/thread.controller.ts
  - backend/src/utils/code-generator.ts
  - frontend/src/types/thread.types.ts
  - backend/src/services/thread-conversion.service.ts
route: /materials/thread/new
---

## Before you start
Nothing is mandatory first. To link a supplier, that supplier must already exist **and be saved with category "Thread Supplier"** — only thread suppliers appear in the dropdown. The colour must already exist in the Colour Master. If you want the newer packaging types (Spool, Cone 5,000m, Cone 10,000m), decide the **Ply** and **Material Composition** first — those two together unlock them (steps 7 to 9).

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar (it is listed under **Fabric & Materials**). The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Threads & Tapes** choose **New Threads**.
   (Alternative: expand the **Threads & Tapes** card, click the **Threads** tile to reach **Thread Management**, then click **+ Add New Thread**.)
3. The form opens with the heading **Create New Thread**; the fields sit under **Thread Information**.
4. **Thread Code** is greyed out and marked **Auto-generated**. Do not type it — the system assigns it on save (THR-0001, THR-0002 …). The placeholder shows "THD-000001", but the real code starts with THR and has four digits.
5. **Thread Name**: leave it empty. The name is built automatically from Brand, Colour, Packaging Type and Meters per Unit (for example "Brand Colour CONE Thread 5000m" — the packaging type appears as its short code: CONE, TUBE, SPOOL, CONE_5K or CONE_10K). The hint mentions a "[Buyer-Code]" part, but this form has no buyer-code box, so it is never added. Type a name only if you want to override it.
6. Fill **Brand** (the thread maker's name, for example Coats, Aster or Bells).
7. **Ply** (marked "Thread Material Module"): open "Select ply..." and choose **2-Ply** or **3-Ply**. It saves correctly. Ply does two things: together with Material Composition it unlocks the newer packaging types in step 9, and it decides how many spools go in a box (2-Ply: 10, 3-Ply: 15). Note: there is no blank option to go back to once you have picked one — reload the form if you want no ply.
8. **Material Composition** (also "Thread Material Module"): choose **Polyester** or **Cotton** from "Select material...". Optional on its own, but it is needed together with Ply for the newer packaging types.
9. **Packaging Type** is how this thread is usually bought — each purchase order line still chooses cones or tubes. **Cone** and **Tube (3-ply)** are always listed. Once BOTH Ply and Material Composition are chosen, three more appear: **Spool (10 units/box, 800m/unit)** for 2-Ply or **Spool (15 units/box, 400m/unit)** for 3-Ply, **Cone 5,000m (10 units/box, 5,000m/unit)** and **Cone 10,000m (10 units/box, 10,000m/unit)**. While neither is set, the yellow note under the box says "Select Ply and Material Composition to enable new packaging types (SPOOL, CONE_5K, CONE_10K)"; once both are set it turns green, for example "New packaging types enabled based on 2-Ply Polyester". All five types save.
10. **Pieces per Box** is read-only and fills itself from the thread packaging table once both the Packaging Type and the Ply are chosen — the same box sizes a purchase order converts cones and tubes with. The hint under it lists them, e.g. "From the thread packaging table: Cone 2-ply 10 / box · Cone 3-ply 10 / box · Tube 3-ply 15 / box. Each purchase order line chooses cones or tubes." Do not try to type in it. For Spool, Cone 5,000m and Cone 10,000m a second read-only box, **Units per Box**, appears with the same number (its hint reads, for example, "3-Ply Spool: 15 units/box"), and a **Packaging Specifications** panel shows the Ply, Units/Box and the standard Meters/Unit for that pack.
11. **Meters per Unit** is the length on one cone, tube or spool. Type it yourself — the Packaging Specifications panel is only a reference and does not fill this box. It must be a number greater than zero — 0 or a minus value is rejected with "Invalid request data".
12. **Color**: pick from the Colour Master list — it is not typed. Narrow the list with the **All Families** filter if needed. If the shade is missing, use the **add a new color** link (opens the Colour form in a new tab), create it, then come back and pick it.
13. **Default Price per Cone/Tube (₹)** is optional and cannot be negative. It is the fallback used when a supplier row has no price of its own.
14. **Suppliers**: click **Add Supplier**, pick the **Supplier**, and type that supplier's **Price/Cone (₹)** or leave it blank (blank means "no supplier price", so the default price applies). Tick **Preferred Supplier** for your main source — the first row is ticked for you — and keep **Active** ticked; add **Notes** if useful. The row and its price are both saved.
15. Trap: a supplier row where no supplier was chosen is dropped silently on save. Remove empty rows with the bin icon.
16. Optional: enter the **Supplier Reference Code** under **Reference Codes**, and pick **Associated Styles** under **Style Associations** (only existing styles can be selected). Add any **Description** under **Additional Information**.
17. Click **Create Thread**. You land back on the **Thread Management** list with the new code visible.

To change it later, open the thread and use **Update Thread**. If you did not type the name yourself, it re-generates when you change Brand, Colour, Packaging Type or Meters per Unit — the hint under the name reads "Name will auto-update when you change attributes. Edit manually to override." Ply, Material Composition and supplier prices save on update too. The code never changes.

## Ordering and stock
- Thread is ordered on a **Thread** purchase order in cones or tubes (see "Raise a Purchase Order"); the PO line is in boxes.
- Stock is kept per pack: a thread bought as cones and as tubes shows as separate items — for example "… - Cone 3-ply" and "… - Tube 3-ply" — each counted in cones or tubes, never added together.

## Traps

- If the supplier box reads **Could not load — open to retry** (the server was busy for a moment), open it again — the list is fetched afresh. It is never stuck.
