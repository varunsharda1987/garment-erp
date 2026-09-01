---
slug: cutting-entry
title: Record a Cutting Entry (Batch and Lay)
keywords:
  - cutting
  - cutting entry
  - cutting batch
  - cutting chart
  - lay
  - layers
  - plies
  - katai kaise kare
  - kapda cutting
  - कटिंग
  - कटाई
  - लेयर
  - बैच
  - कपड़ा
  - fabric lot
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/CuttingList.tsx
  - frontend/src/pages/CuttingChart.tsx
  - frontend/src/pages/CuttingDetail.tsx
  - frontend/src/pages/WorkOrderDetail.tsx
  - frontend/src/components/FabricIssuanceSection.tsx
  - backend/src/schemas/production.schema.ts
  - backend/src/routes/cutting.routes.ts
---

A cutting entry has two parts: first create a **batch** from the Cutting Chart, then record each **lay** on that batch.

## Before you start
- The production run must be **In Production** (use **Push to Cutting** on the run page).
- Fabric must be issued: on the production run page open **Fabric Issuance**, tick the lots and click **Issue to Cutting**.
- PRODUCTION CAD (width and average) must be set for every fabric, otherwise **Create Batch** stays greyed out.

## Create the batch
1. Open **Manufacturing → Cutting** in the sidebar.
2. Click **New Batch**. The **Cutting Chart** page opens.
3. Pick the **Production Run**. If the style has more than one colour, also pick **Color** or leave **All Colors**.
4. Check **Cutting Date** in the Order Details card.
5. In **Size Breakup**, set **Extra %**. The **Cut Qty** row fills automatically. You can type over any size's Cut Qty.
6. If stock is short, click **Fill to Max** to spread the cuttable quantity across sizes by ratio.
7. In **Lot Details**, tick at least one lot for every fabric listed. A component that uses two different fabrics now shows **one row per fabric** (labelled with its width, e.g. "Shirt (54\")"), and each needs its own lots — previously two such fabrics were shown as a single row with only one of the two CAD averages.
8. Click **Create Batch**. The batch page opens, with a reminder that fabric is **not** issued automatically — issue it from **Procurement → Challans** (or **Fabric Issuance** on the production run) if you have not already.

## Record the lays
9. Click **Start Cutting** on the batch page.
10. In the **Add New Lay** card, fill **Lay Date**, **Number of Layers (plies)** and **Layer Length (meters)**. With more than one fabric you instead fill **Per-Fabric Layer Lengths** — every fabric needs a length.
11. In the size table, tick each size and enter **Pcs/Layer**. **Total Cut** is calculated for you.
12. Add **Remarks (optional)** and click **Save Lay**. Repeat for each new lay.
13. When cutting is finished, click **Complete**, enter **Return to Store (m)** for leftover fabric, and confirm.

## Traps to avoid
- **Number of Layers** must be at least 1 and **Layer Length** must be more than zero.
- You must tick at least one size and enter pieces per layer, or the lay will not save.
- A total Cut Qty above **Max Cuttable** turns red. That is the stock limit, shown with the bottleneck fabric.
- **Complete** is greyed out until something has been cut.
- If a fabric has more than one CAD option, a note appears at the top of the chart saying which average was used. Fix it in CAD Planning if that is not the one you want — the chart cannot know which alternative you intend.
- **Creating a batch does not issue fabric.** Nothing leaves the fabric store until someone issues a challan for it, so stock and the cutting plan stay in step. If no fabric was issued, **Complete** refuses with "No fabric issue recorded" — issue the challan, then complete.
- A batch can only be deleted while it has no lays.
- Use **Hold** to pause and **Resume** to continue. After completion, use the transfer slip icon on the list.
