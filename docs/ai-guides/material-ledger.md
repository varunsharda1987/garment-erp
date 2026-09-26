---
slug: material-ledger
title: See where a material came from and where it went
keywords:
  - material ledger
  - ledger
  - khata
  - material history
  - stock history
  - when did it come
  - kab aaya
  - kahan gaya
  - where did it go
  - running balance
  - opening balance
  - closing balance
  - trace a material
  - who took the fabric
  - which challan issued it
  - greige history
  - fabric history
  - lot history
  - खाता
  - लेजर
  - मटेरियल हिस्ट्री
  - कब आया
  - कहाँ गया
  - बकाया
  - thread ledger
  - cone ledger
  - dhaga ledger
  - धागा लेजर
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/MaterialLedger.tsx
  - frontend/src/pages/StockLevelList.tsx
  - frontend/src/pages/StockMovementList.tsx
  - frontend/src/services/materialLedger.service.ts
  - frontend/src/components/MaterialCombobox.tsx
  - frontend/src/components/WarehouseCombobox.tsx
  - backend/src/routes/material.routes.ts
  - backend/src/controllers/material-ledger.controller.ts
  - backend/src/services/material-ledger.service.ts
route: /inventory/material-ledger
---

## Steps
1. Open **Inventory → Material Ledger** in the sidebar.
2. Pick the **Material**. The ledger loads on its own — there is no Generate button.
3. Optionally narrow it: choose a **Warehouse** (the ✕ beside it goes back to all warehouses), and set **From** and **To**. Leave the dates empty to see the material's whole history.
4. Click **Print / PDF** for a copy to carry into a stock check.

You can also get here in one click: on **Stock Levels** and on **Material Movements**, the material code in each row is a link straight to that material's ledger — from Stock Levels it carries the warehouse across too.

## What you see at the top
The header card names the material and its unit, then three figures:
- **Ledger closing** — what all the movements add up to, over the material's whole history.
- **Stock records** — what the stock tables currently say is on hand.
- **Lots available** — the sum of the physical lots, for greige, fabric, lace and thread.

A green **Matches stock** badge means the three agree. A red **Books and shelf disagree** badge means a movement is missing from the ledger or a quantity was changed without one; reconcile before trusting either number.

## The table
Each row is one movement: **Date**, **Document** (what happened and the GRN, challan, job work or issue note behind it — click the number to open it), **Party / Destination** (who it came from or where it went), **Warehouse**, **Lot**, **In**, **Out** and the **Balance** after that movement. When you set a From date, an **Opening balance** row appears first and the balance runs on from there.

## Things that are easy to misread
- **Reserved and Released rows on lace.** Allocating lace to a style moves it out of available stock without it leaving the building, so it shows as *Reserved*; cancelling that allocation shows as *Released*.
- **A receipt labelled "job work return".** Fabric coming back from a dyer is a receipt from your processor, not a purchase — the party column says so.
- **A yellow note under a row.** The ledger flags a lot whose receipt disagrees with the paperwork, or one whose movements it cannot fully account for. These are the rows to check first in a stock count.
- **Trims versus cloth.** Buttons, zippers, labels and packaging are tracked as plain movements, so they have no lot column entries; greige, fabric, lace and thread are tracked lot by lot.
- **Thread packs.** A thread bought as cones and as tubes is a separate material per pack ("… - Cone 3-ply", "… - Tube 3-ply"). Pick the pack to see its lots — the thread's own name shows only lots received without a pack.
