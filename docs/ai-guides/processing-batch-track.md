---
slug: processing-batch-track
title: Track Processing Batch Progress
keywords:
  # English
  - processing batch status
  - batch tracking
  - dyeing batch status
  - batch progress
  - lace processing
  - fabric processing
  - greige processing
  - batch stages
  - batch movements
  - batch deliveries
  - in process quantity
  - in transit quantity
  - receive dyed lace
  - dye lot
  # Hinglish
  - batch status dekhna
  - processing ka status
  - batch kahan hai
  - dyeing batch track
  - lace ka batch
  - fabric batch track
  - mill mein kitna hai
  - transit mein kitna
  - received kitna
  # Devanagari (MANDATORY)
  - बैच स्टेटस
  - प्रोसेसिंग ट्रैकिंग
  - बैच कहाँ है
  - डाइंग बैच
  - मिल में कितना
  - ट्रांजिट में कितना
  - रिसीव्ड कितना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ProcessingBatchList.tsx
  - frontend/src/pages/ProcessingBatchDetail.tsx
  - frontend/src/types/processing.types.ts
  - frontend/src/services/processingBatch.service.ts
route: /processing/batches
---

## Steps

### View all processing batches

1. Go to **Production** > **Processing Batches**
2. See the summary cards at top:
   - **Active Batches** - currently being processed
   - **Completed** - finished batches
   - **In Process** - total metres at processors
   - **In Transit** - total metres being transported
3. Click any summary card to filter the list by that status

### Filter and search batches

1. Use the search box to find by batch number
2. Use the **Status** dropdown to filter:
   - All Statuses
   - Active
   - Completed
   - Cancelled
3. Use the **Material Type** dropdown to filter:
   - All Materials
   - Greige Fabric
   - Fabric
   - Lace
4. Click **Refresh** to reload the list

### View batch details

1. In the batch list, click the **eye icon** on any row
2. The detail page shows:
   - **Material** - name and code of the material being processed
   - **Type** - Greige Fabric, Fabric, or Lace
   - **Created date** and who created it
3. Key quantities displayed:
   - **Sent** - total metres sent out for processing
   - **Received** - metres received back (green)
   - **In Process** - metres currently at processor
   - **In Transit** - metres being transported
   - **Rejected** - metres rejected (red)
   - **Total Cost** - total processing cost incurred

### View processing stages

1. On the batch detail page, scroll to **Processing Stages**
2. Each stage shows:
   - Stage number
   - Processor name
   - Processing type (Dyeing, Printing, etc.)
   - Quantity sent and received
   - Processing cost
   - Stage status

### View movements

1. Scroll to **Movements** section
2. Each movement shows:
   - Movement type (Warehouse to Processor, Processor to Warehouse, etc.)
   - From and To locations
   - Quantity being moved
   - Dispatch date
   - Movement status (In Transit or Delivered)

### View deliveries

1. Scroll to **Deliveries** section
2. Each delivery shows:
   - Delivery number
   - Quantity delivered, accepted, and rejected
   - Delivery date
   - QC status (Pending QC, QC Passed, QC Failed, etc.)

### Receive dyed lace (Lace batches only)

1. Open an **Active** lace processing batch
2. Click **Receive Dyed Lace** button (top right of batch info)
3. Fill in the details:
   - **Quantity Received** (metres) - required
   - **Dye Lot Number** - required (e.g., DL-2026-014)
   - **Quality Grade** - optional (e.g., A)
   - **Warehouse Location** - optional
   - **Shade Note** - optional (e.g., "slightly darker than approved dip")
4. Click **Receive into Stock**
5. The system calculates actual shrinkage from: sent quantity - received quantity

## Understanding batch statuses

| Status | Meaning |
|--------|---------|
| **ACTIVE** | Batch is currently being processed |
| **COMPLETED** | All processing is finished |
| **CANCELLED** | Batch was cancelled |

## Understanding stage statuses

| Status | Meaning |
|--------|---------|
| **PENDING** | Not yet started |
| **IN_TRANSIT_TO_PROCESSOR** | Material being sent to processor |
| **AT_PROCESSOR** | Material arrived at processor |
| **IN_PROCESS** | Processor is working on it |
| **IN_TRANSIT_TO_COMPANY** | Processed material returning |
| **COMPLETED** | Stage finished |
| **REWORK_REQUIRED** | Failed QC, needs rework |

## Understanding QC statuses

| Status | Meaning |
|--------|---------|
| **PENDING_QC** | Awaiting quality check |
| **QC_PASSED** | Passed quality check |
| **QC_FAILED** | Failed quality check |
| **ACCEPTED** | Accepted into stock |
| **REJECTED** | Rejected |
| **REWORK_REQUIRED** | Needs rework |

## Lace-specific fields

For lace batches, you will also see:
- **Target Color** - the color being dyed
- **Dye Lot** - dye lot number
- **Expected Shrinkage** - expected shrinkage percentage
- **Shade Note** - any notes about the shade

## Traps

- **Batches are orchestration shells**: Stock movements, challans, and costs live on Job Work Orders, not batches. Click "Job Work Dashboard" to see the commercial reality.
- **Lace is tracked separately**: When you receive dyed lace, it is booked under the DYED variant (a different master), not the greige that was sent out.
- **Shrinkage is derived**: The system calculates actual shrinkage from the difference between sent and received quantities.
- **Cannot receive on completed batches**: The "Receive Dyed Lace" button only appears for ACTIVE lace batches.
