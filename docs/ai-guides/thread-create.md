---
slug: thread-create
title: Add a Thread (Thread Master)
keywords:
  - thread
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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ThreadList.tsx
  - frontend/src/pages/ThreadForm.tsx
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/thread.controller.ts
---

## Before you start
Nothing is mandatory first. To link a supplier, that supplier must already exist **and be saved with category "Thread Supplier"** — only thread suppliers appear in the dropdown. The colour must already exist in the Colour Master.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar. The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Threads & Tapes** choose **New Threads**.
   (Alternative: open the **Threads** card to reach **Thread Management**, then click **+ Add New Thread**.)
3. The form opens with the heading **Create New Thread**.
4. **Thread Code** is greyed out. Do not type it — the system assigns it on save (THD-000001, THD-000002 …).
5. **Thread Name**: leave it empty. The name is built automatically from Buyer Code, Brand, Colour, Packaging Type and Meters. Type a name only if you want to override it.
6. Fill **Brand** (the thread maker's name).
7. Choose **Ply** — **2-Ply** or **3-Ply**.
8. Choose **Material Composition** — **Polyester** or **Cotton**.
9. Now open **Packaging Type**. Trap: **Spool**, **Cone 5,000m** and **Cone 10,000m** only appear after BOTH Ply and Material Composition are selected. If you skip those two, you will only see **Cone – Legacy** and **Tube – Legacy**.
10. **Pieces per Box** and **Units per Box** are read-only. The system fills them from your Ply and Packaging Type. Do not try to type in them.
11. **Meters per Unit** is the length on one cone or tube. It must be a number greater than zero.
12. **Color**: pick from the Colour Master list — it is not typed. If the shade is missing, use the **add a new color** link, create it, then come back.
13. **Default Price per Cone/Tube** is optional and cannot be negative.
14. To add a supplier, click **Add Supplier**, pick the **Supplier**, and fill **Price/Cone** and **Notes** if known. Tick **Preferred Supplier** for your main source and keep **Active** ticked.
15. Trap: a supplier row where no supplier was chosen is dropped silently on save. Remove empty rows with the bin icon.
16. Optional: enter the **Supplier Reference Code** under **Reference Codes**, and pick styles under **Style Associations**.
17. Click **Create Thread**. You land back on the **Thread Management** list with the new code visible.

To change it later, open the thread and use **Update Thread**. If you did not type the name yourself, it re-generates when you change Brand, Colour or Packaging Type. The code never changes.
