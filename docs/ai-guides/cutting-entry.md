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
  - production CAD
  - create batch greyed out
  - CAD approve nahi hua
  - प्रोडक्शन कैड
  - issue to stitching
  - not yet cut
  - no lays recorded
  - stitching mein bhejna
  - सिलाई में भेजना
  - issue rolls to cutting
  - pick rolls
  - pick for this batch
  - which thans to cut
  - roll wapas
  - whole rolls back
  - end piece
  - रोल
  - थान
  - कटिंग में रोल
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
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
  - frontend/src/components/job-work/ThanPicker.tsx
  - frontend/src/components/ui/combobox.tsx
  - backend/src/schemas/production.schema.ts
  - backend/src/routes/cutting.routes.ts
  - backend/src/services/productionBlockingValidation.service.ts
route: /manufacturing/cutting
---

A cutting entry has two parts: first create a **batch** from the Cutting Chart, then record each **lay** on that batch.

## Before you start
- The style must have an **approved Size Set Sample** (Manufacturing → Sample Tracking). The samples go in order — FIT, then PP, then Size Set — each approved. Without it, **Push to Cutting** and **Create Batch** both refuse with "No Size Set Sample exists for this style". This applies to stock production too.
- The production run must be **In Production** (use **Push to Cutting** on the run page).
- Fabric is issued **for a cutting batch**, so create the batch first (step 8), then issue the fabric for it (step 9).
- Every fabric needs an **approved** Production CAD with a width and a CAD Average (Pre-Production → CAD Planning → **Create CAD** on the received lot, then row menu → **Approve**). A pending or rejected Production CAD does not count: **Push to Cutting** refuses and **Create Batch** stays greyed out with "No approved Production CAD for: …".

## Create the batch
1. Open **Manufacturing → Cutting** in the sidebar.
2. Click **New Batch**. The **Cutting Chart** page opens.
3. Click **Production Run** ("Select a production run") and type part of the run number, buyer style code, style code or style name, then pick it. Each run reads e.g. `WO2609-0087 - SP27DR27 (EBWW-021) (120 pcs pending)` — the Buyer Style Code first, our Style Code in brackets when it differs. Only runs still waiting to be cut are listed; if none are, it says "No production runs waiting to be cut." If the style has more than one colour, also pick **Color** from its dropdown or leave **All Colors**.
4. Check **Cutting Date** in the Order Details card. The card shows the **Buyer Style Code** and our **Style Code** side by side.
5. In **Size Breakup**, set **Extra %**. The **Cut Qty** row fills automatically. You can type over any size's Cut Qty.
6. If stock is short, click **Fill to Max** to spread the cuttable quantity across sizes by ratio.
7. In **Lot Details**, tick at least one lot for every fabric listed. A component that uses two different fabrics now shows **one row per fabric** (labelled with its width, e.g. "Shirt (54\")"), and each needs its own lots — previously two such fabrics were shown as a single row with only one of the two CAD averages.
8. Click **Create Batch**. The batch page opens, with a reminder that fabric is **not** issued automatically.
8a. Issue the fabric for the batch: on the production run page open **Fabric Issuance**, tick the lots and click **Issue to Cutting**. With one open batch the fabric goes to it (the panel says "For cutting batch …"); with several, pick the batch in the box next to the button first. Without a batch the issue is refused with "Create the cutting batch first". A batch takes only the fabrics it cuts: once a batch is chosen, lots of any other fabric are greyed out with "Not cut in CB-…" (issue them for a batch that cuts that fabric — make one on the Cutting Chart). Another lot of a fabric the batch already cuts can be issued even if the chart did not plan it; it joins the batch, and Complete counts and returns it like the planned lots. The panel then shows the fabric under **At Cutting (m)**, and the Cutting Chart shows those lots as "at cutting" — they still count towards **Max Cuttable**.
8b. **Rolls and thans.** The **Rolls / thans** column shows each lot's list. A ticked lot that lists rolls or thans opens them **all ticked** — untick the ones that stay in the store. **Pick for this batch** (shown when the Cutting Chart planned metres from that lot) ticks the whole pieces that fit the batch's plan; **Tick all** starts over. The lot then issues the ticked pieces' actual metres ("Issuing … of …"). A lot with no list says "… has no roll or than list — the whole lot goes." A lot whose list is out of step says so; it can still go whole with **Send the whole lot by quantity instead**.

## Record the lays
9. The batch page shows, per size, the **Order** quantity, the **Extra** added by the Extra % you set on the chart, and **Planned** (order + extra) — what is to be cut. Click **Start Cutting** on the batch page.
10. In the **Add New Lay** card, fill **Lay Date**, **Number of Layers (plies)** and **Layer Length (meters)**. With more than one fabric you instead fill **Per-Fabric Layer Lengths** — every fabric needs a length.
11. In the size table, tick each size and enter **Pcs/Layer**. **Total Cut** is calculated for you.
12. Add **Remarks (optional)** and click **Save Lay**. Repeat for each new lay.
12a. Cut pieces can go to stitching while the batch is still in progress: in the **Issue to Stitching** card click **New Issue**. It opens once every fabric of the batch has at least one lay. Two lots of the same fabric count as one fabric, so one lay covers both. Until then the card says which fabric is "not yet cut".
13. When cutting is finished, click **Complete**, check **Return to Store (m)** for the leftover fabric, and confirm. Each lot is pre-filled with what was issued less what the lays used. When a fabric came from two lots, the lay metres are shared between them by what each lot sent, so change the figures to what really comes back from each lot.
13a. Rolls or thans that came back **whole** (rare) can be ticked under a lot in **Whole rolls / thans back (optional)** — open it only if needed. The rest of the metres typed comes back as **one end piece** (the line says "… comes back as one end piece"); the Fabric Stock page lists it as "End · <batch>". Ticking rolls worth more than the metres returned is refused.

If a batch is **deleted** before any lay is recorded (or cancelled with no lays), the fabric issued for it goes back to the store automatically on a return challan — the panel lists it as **Returned to store** — and exactly the rolls / thans it took go back on the lot's list. Once lays exist, the leftover is returned at **Complete** instead.

## Find a batch later
- On **Manufacturing → Cutting**, search by batch number, run number, buyer style code, style or component ("Search batch number, run number, buyer style code, style, component…").
- The batch table shows the **Buyer Style Code** column first (bold, style name under it), then our **Style Code**. The batch page header names the style the same way, e.g. `SP27DR27 (EBWW-021) - Style Name`.

## Traps to avoid
- **Number of Layers** must be at least 1 and **Layer Length** must be more than zero.
- You must tick at least one size and enter pieces per layer, or the lay will not save.
- A total Cut Qty above **Max Cuttable** turns red. That is the stock limit, shown with the bottleneck fabric.
- **Complete** is greyed out until something has been cut.
- If a fabric has more than one CAD option, a note appears at the top of the chart saying which average was used. Fix it in CAD Planning if that is not the one you want — the chart cannot know which alternative you intend.
- **Creating a batch does not issue fabric.** Nothing leaves the fabric store until someone issues a challan for it, so stock and the cutting plan stay in step. If no fabric was issued, **Complete** refuses with "No fabric issue recorded" — issue the challan, then complete.
- A batch can only be deleted while it has no lays.
- Use **Hold** to pause and **Resume** to continue. After completion, use the transfer slip icon on the list.
