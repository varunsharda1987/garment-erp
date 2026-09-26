---
slug: requirements-extra-decision
title: Decide on extra quantity after a BOM change (Order the extra / Don't order more)
keywords:
  # English
  - needs decision
  - decision pending
  - order the extra
  - don't order more
  - dont order more
  - extra quantity
  - extra requirement
  - BOM changed after PO
  - new BOM version more quantity
  - more than now needed
  - surplus on PO
  - PO has more than needed
  - need a decision extra quantity
  - decide requirement
  - requirement not orderable
  - cannot tick requirement
  - desicion
  - decison
  - extra qty
  - surplus qty
  # Hinglish
  - extra order karna
  - extra mangana hai
  - zyada mat mangao
  - aur mat mangao
  - aur nahi mangana
  - BOM badal gaya
  - PO se zyada chahiye
  - PO mein zyada hai
  - decision pending kya hai
  - requirement tick nahi ho rahi
  # Devanagari (MANDATORY)
  - एक्स्ट्रा ऑर्डर
  - और मत मंगाओ
  - ज़्यादा मत मंगाओ
  - ज्यादा मत मंगाओ
  - एक्स्ट्रा मंगाना
  - नीड्स डिसीजन
  - डिसीजन
  - फैसला करना
  - बीओएम बदल गया
  - पीओ से ज़्यादा
  - सरप्लस
  - रिक्वायरमेंट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/components/requirements/RequirementDecision.tsx
  - frontend/src/components/requirements/OrderStyleLabelView.tsx
  - frontend/src/types/mrp.types.ts
  - frontend/src/components/OrderWorkflowTracker.tsx
  - frontend/src/pages/OrderDetail.tsx
  - backend/src/services/helpers/requirement-reconcile.helper.ts
  - backend/src/schemas/mrp.schema.ts
route: /procurement/requirements
---

## What "Needs Decision" means

When an order's BOM changes — a new Order BOM version, for example after a CAD correction is approved — MRP recalculates the order's requirements. Requirements that are still open are updated in place and keep their numbers. But part of a requirement may already be committed: on a PO, on a job work, received, or greige already sent to the processor. That part is never grown or changed.

- If the new BOM needs **more**, only the difference appears as its own requirement with status **Needs Decision**. It cannot be put on a PO until someone decides.
- If the new BOM needs **less**, the committed row shows a note "… more than now needed" under its quantity. The PO or job work is not changed.

## Steps

1. Open **Procurement > Requirements** in the sidebar and stay on the **Material Requirements** tab.
   - From an order: on the order's page, the **PO** step reads "N need a decision (extra quantity)". Click **Decide** — Requirements opens filtered to that order.
2. In the status box (it reads **All Status**), choose **Needs Decision**.
3. Any view shows the two buttons — **Flat View**, **By Material**, **By Party**, **By Style** or **By Order & Style (label sets)**.
4. Read the row:
   - status **Needs Decision**;
   - the quantity is only the extra, with the note "more needed by BOM vN — order it?" under it;
   - the order column shows the order number and the BOM version;
   - the row has no tick box.
5. Choose one:
   - **Order the extra** — the row becomes **PO Required** for just that difference ("Extra can be ordered"). Order it like any other requirement: tick it and use **Bulk Generate POs** or **Manual PO**, or **Use Stock** if stock is available.
   - **Don't order more** — a window asks "Don't order the extra …?". Type a **Reason (optional)** and click **Don't order more** (or **Back** to leave it). The row closes as not ordered and shows **Cancelled** ("Recorded"). What is already on the PO or job work stays as it is.

## When the PO holds more than now needed

1. Look for the note "… more than now needed" under the quantity of a row that is on a PO or job work.
2. The PO is never changed by itself. Decide with purchase whether to keep the extra or change the PO.

## Traps

- **A Needs Decision row cannot be ticked or ordered.** Only **PO Required** and **Partially from Stock** rows have a tick box. Decide first.
- **"Don't order more" is remembered.** Recalculating the order will not ask about that quantity again.
- **An undecided row follows later changes.** If the BOM changes again before you decide, the same Needs Decision row is updated to the new difference, or cancelled when nothing extra is needed any more.
- **The order page counts them on the PO step** — "N need a decision (extra quantity)", or "… need PO · N need a decision" when other rows need a PO. Use the **Needs Decision** status filter on Requirements to see them all.
- **Job work (processing) extras are on the Outsourced Work tab.** A processing row reading **Needs Decision** has the same **Order the extra** / **Don't order more** buttons under its status; choose **Processing** and the **Needs Decision** status to list them.
- **"… is not waiting for a decision."** Someone already decided that row. Click **Refresh**.
