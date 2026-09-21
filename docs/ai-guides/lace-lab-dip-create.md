---
slug: lace-lab-dip-create
title: Create a Lace Lab Dip
keywords:
  # English
  - lace lab dip
  - lace dyeing
  - lace color matching
  - lace shade
  - lab dip request
  - greige lace processing
  - dye sample
  - color approval
  # Hinglish
  - lace ka lab dip
  - lace dyeing
  - lace shade milana
  - greige lace ka sample
  - processor ko bhejein
  - color matching
  # Devanagari
  - लेस लैब डिप
  - लेस डाइंग
  - लेस शेड मैचिंग
  - ग्रेज लेस प्रोसेसिंग
  - कलर मैचिंग
  - डाई सैंपल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/LaceLabDipForm.tsx
  - frontend/src/pages/LaceLabDipList.tsx
route: /lace-lab-dips/new
---

## Before you start

- A greige lace must already exist in the system (created via the Lace Master).
- A processor (supplier with DYEING_PRINTING category) must be set up.

## Steps

1. Open **Materials & Masters -> Lace Lab Dips** in the sidebar.
2. Click **+ New Lab Dip** at the top right.
3. Fill in the required fields:
   - **Greige Lace** - Select the base greige lace to be dyed (dropdown).
   - **Processor** - Select the dyeing processor who will create the lab dip sample.
   - **Target Color** - Enter the desired color name (e.g., "Red", "Navy Blue", "Maroon").
4. Fill in optional fields as needed:
   - **Sample Quantity (meters)** - Quantity of sample fabric (default: 1 meter).
   - **Color Recipe / Dye Formula** - Processor's dye recipe or formula reference.
   - **Lab Dip Cost (optional)** - Cost charged for creating the lab dip sample.
5. Click **Create Lab Dip** to save.

## Status workflow

After creating a lab dip, it moves through these statuses:

1. **Pending** - Just created, not yet sent to processor.
2. **Sent to Processor** - Lab dip request sent to the processor for sample creation.
3. **Sample Received** - Physical sample received from the processor.
4. **Awaiting Buyer Approval** - Sample sent to buyer for color matching approval.
5. **Approved** - Buyer approved the color (requires **Approval Reference**).
6. **Rejected** - Buyer rejected the color (requires **Rejection Reason**).

To advance the status, open the lab dip detail page and use the status transition buttons.

## Traps

- You cannot change the **Greige Lace** or **Processor** after creating the lab dip.
- Deletion is only allowed when status is **Pending**.
- When approving, you must enter the **Approval Reference** from the buyer.
- When rejecting, you must enter the **Rejection Reason**.

## After saving

- The lab dip request appears in the list with status **Pending**.
- Use the list page filters to track lab dips by status.
- Click the eye icon to view details or the arrow icon to update the workflow status.
- Once **Approved**, the color-matched lace variant can be used in production.
