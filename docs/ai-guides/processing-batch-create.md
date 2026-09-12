---
slug: processing-batch-create
title: Create a Processing Batch
keywords:
  # English
  - processing batch
  - dyeing batch
  - printing batch
  - batch processing
  - job work batch
  - send material for processing
  - greige batch
  - fabric batch
  - lace batch
  # Hinglish
  - batch banana
  - processing batch
  - dyeing ka batch
  - printing ka batch
  - job work ke liye bhejo
  - greige bhejo
  - fabric bhejo
  - lace bhejo
  # Devanagari
  - प्रोसेसिंग बैच
  - डाइंग बैच
  - प्रिंटिंग बैच
  - बैच बनाना
  - जॉब वर्क बैच
  - ग्रेज बैच
  - फैब्रिक बैच
  - लेस बैच
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ProcessingBatchList.tsx
  - frontend/src/pages/ProcessingBatchCreateForm.tsx
route: /processing/batches/new
---

## Before you start

- Know the material type: Greige Fabric, Finished Fabric, or Lace
- Have the material master record already created in the system
- Know the quantity (in meters) to send for processing
- For lace: know the target color and expected shrinkage percentage (optional)

## Steps

1. Open **Manufacturing → Processing Batches** in the sidebar.

2. Click the **New Batch** button in the top-right corner.

3. In the **Material Type** card, select one of:
   - **Greige Fabric** - raw unprocessed fabric for dyeing/printing
   - **Finished Fabric** - already processed fabric for additional treatment
   - **Lace** - lace material for dyeing

4. In the **Select [Material]** card, click the search dropdown.
   - Type the material code or name to search
   - Select the material from the dropdown list
   - The selected material shows Code, Name, and Composition

5. In the **Quantity Details** card:
   - Enter **Total Quantity to Send (meters)** - the amount being sent
   - **Quantity In Process (meters)** auto-fills with the same value (adjust if different)

6. For **Lace** only - the **Lace Processing Details** card appears:
   - Enter **Color to Apply** (e.g., Red, Navy Blue) - optional
   - Enter **Expected Shrinkage (%)** - optional (e.g., 5)

7. Click **Create Batch** to save.

8. You are redirected to the batch detail page upon success.

## Traps

- A processing batch is an "orchestration shell" - actual stock movements, challans, and costs are tracked on Job Work Orders, not on the batch itself
- You cannot create a batch without first selecting a material
- Quantity must be greater than zero
- The material master must exist before you can select it

## After saving

- Batch is created with status **ACTIVE**
- Batch number is auto-generated (e.g., PB-00001)
- View the batch in the Processing Batches list
- Link Job Work Orders to this batch for actual processing work
- Track quantities: Sent, In Process, In Transit, Received
