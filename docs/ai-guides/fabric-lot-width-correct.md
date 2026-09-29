---
slug: fabric-lot-width-correct
title: Correct a fabric lot's width
keywords:
  # English
  - correct width
  - lot width wrong
  - wrong width
  - fabric width wrong
  - measured width
  - cutable width
  - cuttable width
  - selvedge
  - width recorded wrong
  - 57 instead of 55
  - marker wider than lot
  - will not fit
  - lot is narrower
  - fabric stock width
  # Hinglish
  - width galat hai
  - lot ki width galat
  - chaudai galat
  - chaudai sahi karna
  - arz galat
  - kapde ki chaudai
  - width badalni hai
  - marker fit nahi ho raha
  # Devanagari (MANDATORY)
  - चौड़ाई
  - चौड़ाई गलत
  - चौड़ाई सही करना
  - लॉट की चौड़ाई
  - कटेबल चौड़ाई
  - कपड़े की चौड़ाई
  - सेल्वेज
  - विड्थ गलत
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/FabricAvailableStock.tsx
  - frontend/src/components/fabric/CorrectLotWidthDialog.tsx
  - frontend/src/components/cad/StockSummaryBanner.tsx
  - frontend/src/services/fabricStockService.ts
  - backend/src/schemas/fabricStock.schema.ts
  - backend/src/routes/fabric-stock.routes.ts
  - backend/src/services/fabric-stock.service.ts
  - backend/src/services/helpers/lot-width.helper.ts
route: /fabric-stock
---

A fabric lot has two widths:
- **Measured width** — what the fabric really measures, typed when it was received.
- **Cutable width** — the measured width less the selvedge (2"). It is the widest a marker for this lot may be: a Production CAD may be narrower than the lot (a 52" marker on a 53" lot leaves 1" spare), never wider.

If the width was recorded wrong at receipt (for example 57" was typed and the fabric measures 55"), correct it on the lot. Do not reverse the receipt for this.

## Steps

1. Open the lot in either place:
   - **Inventory → Fabric Stock**: find the lot and click the ruler icon (**Correct width**) in its Actions column. The **Width** column shows the lot's measured width with its cutable width under it, e.g. **57"** and **(55" cut)**.
   - **Pre-Production → CAD Planning**, open the style: in the green **Fabric Stock Available** box, click **Width** next to the lot (the lot reads e.g. **GRN2609-0502 · 55" cutable • 1,614m**).
2. The **Correct width** window shows what is recorded now, e.g. "Recorded now: 57" measured, 55" cutable."
3. Type the **Measured width (inches)**. The **Cutable width (inches)** fills itself: measured − 2" selvedge (55" gives 53").
4. Only if the usable width is different from that, type the **Cutable width** yourself. It cannot be more than the measured width.
5. Type the **Reason** (required), e.g. "receipt recorded 57"; the fabric measures 55"".
6. Click **Save width**. A message confirms the new widths, e.g. "FAB-ESSKY076LS-001, GRN2609-0502: 55" measured, 53" cutable".

The lot and its receipt now carry the corrected width, and the change is kept in the audit history with the reason. Now make the lot's Production CAD: **Create CAD** on the lot reuses the approved marker when it fits (see "Create a CAD Plan (Marker)").

## Traps

- **"Lot … has already gone to cutting (batch …), so its width can no longer be corrected."** — once any of the lot is on a cutting batch the width is fixed.
- **"Lot … has an approved Production CAD at 54", which would not fit 53" cutable fabric. Reject that CAD first, then correct the width."** — reject the lot's Production CAD (row menu > **Reject** in CAD Planning), correct the width, then make or re-approve a marker that fits.
- **Save width** stays disabled until the measured width, a cutable width no more than it, and a reason of at least 3 characters are filled in.
- Correcting the width does not rename the fabric: a fabric called "… 57"" keeps its name. The lot's width is what CAD Planning and cutting read.
- New receipts from a processor ask for the **Measured width** — it is required, so this correction should only be needed for lots received before 29-Sep-2026 or typed wrong.
