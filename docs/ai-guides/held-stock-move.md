---
slug: held-stock-move
title: Bring goods back from a dyer, or move them to another dyer
keywords:
  - move to another processor
  - move cloth to another dyer
  - transfer greige between dyers
  - dyer to dyer
  - bring to store
  - bring back from processor
  - goods lying at dyer
  - held at processor
  - dyer se dusre dyer ko
  - maal dusre dyer ko bhejo
  - dyer se maal wapas godown
  - डायर से दूसरे डायर को
  - दूसरे प्रोसेसर को भेजें
  - डायर से माल वापस
  - प्रोसेसर के पास माल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/GreigeAvailableStock.tsx
  - frontend/src/pages/StockInForm.tsx
  - frontend/src/pages/JobWorkOrderDetail.tsx
  - frontend/src/components/job-work/MoveHeldStockDialog.tsx
  - backend/src/services/helpers/held-stock-doors.helper.ts
  - backend/src/schemas/stockMovement.schema.ts
route: /greige-stock
---

## When to use this
Goods we own can lie at a dyer or other processor without being on a job: a supplier delivered them straight there, a Stock-Out parked them there, or a job was cancelled and the cloth stayed. Two doors move such goods, and both file the challan for you:
- **Bring to store** — the goods come back into one of our stores.
- **Move to another processor** — the goods go from one processor straight on to another.

## Bring to store
1. Open **Inventory → Greige Stock**, expand the greige, and click the store button on a lot whose **At Processor** column names a processor. (Or open **Stock In**, choose **Processor Return**, and pick the processor and the lot — lace and ready fabric are listed there too.)
2. Check **Receiving Now**, pick **Receive to Warehouse** (one of our stores) and **Date back in store**, then click **Receive from Processor**.
3. An inward challan from the processor is filed and a new lot is booked in your store. The processor's stock goes down.

## Move to another processor
1. Open **Inventory → Greige Stock**, expand the greige, and click the two-arrows button (**Move to another processor**) on a lot held at a processor.
2. In **To processor ***, pick the receiving processor's **… - Processing Unit**. Enter the metres to move (all of it is filled in), **Moved on**, **Vehicle** and any **Remarks**.
3. Click **Move and create challan**. One challan from the first processor to the second is filed — give it to the transporter.
4. The goods are now held at the second processor. They keep the day they first reached a processor, so the one-year return period does not restart.

From a job: in the job's **Issue to Processor** dialog, cloth of the same greige lying at another processor is listed under **Elsewhere: … at <processor>**. Click **Move here** to move it to this job's processor; it then appears under **Already at <processor>** and the job can take it without a truck.

## Traps
- Cloth at one processor cannot go on another processor's job directly — the issue is refused with "move it there first". Move it, then issue.
- You cannot move more than is lying there, choose a date in the future, or a date before the goods reached the first processor.
- One challan comes from one processor: move or bring back each processor's goods separately.
- Moving to the same processor is refused ("already at …"). Bringing back into a processor's unit is refused — pick one of our stores.
- Metres reserved for a requirement are not offered for Bring to store.
