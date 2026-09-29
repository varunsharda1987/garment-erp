---
slug: lab-dip-approve
title: Approve a Lab Dip
keywords:
  # English
  - approve lab dip
  - lab dip approval
  - shade approved
  - color approved
  - accept lab dip
  - reject lab dip
  - dye lab dip
  - print lab dip
  - lace lab dip
  - buyer approval
  - internal approval
  - color match rating
  # Hinglish
  - lab dip approve karna
  - shade pass karna
  - color OK karna
  - lab dip reject karna
  - buyer se approval
  # Devanagari
  - लैब डिप अप्रूव
  - शेड पास
  - कलर ओके
  - लैब डिप रिजेक्ट
  - बायर अप्रूवल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/LaceLabDipForm.tsx
  - frontend/src/components/processing/LabDipDetail.tsx
  - frontend/src/pages/dyeing/DyeLabDipDetail.tsx
  - frontend/src/pages/printing/PrintLabDipDetail.tsx
  - frontend/src/pages/DyeingList.tsx
  - frontend/src/pages/ProcessingList.tsx
  - frontend/src/components/ProcessorCombobox.tsx
  - frontend/src/components/LaceCombobox.tsx
  - frontend/src/pages/LaceLabDipList.tsx
  - frontend/src/types/laceLabDip.types.ts
  - frontend/src/types/printing.types.ts
route: /manufacturing/processing
---

## Before you start

- The lab dip must be submitted to a processor and sample received
- For dyeing/printing: lab dip status must be **Pending**, **Submitted**, or **Resubmit**
- For lace: lab dip status must be **Awaiting Buyer Approval**

---

## Steps for Dyeing Lab Dip (Internal Approval)

1. Open **Manufacturing** (in the sidebar)
2. Click **Dyeing & Printing**
3. You land on the **Dyeing & Printing** page, on the **Lab Dips** tab
4. Find the lab dip: type in the search box (lab dip number, style, buyer ref, fabric, colour, design or processor), or use the filters in the same row — **All types** (pick **Dyeing**), **All processors** (a searchable picker) and **All statuses**. **Clear filters** resets them all
5. Click the lab dip row to open its detail page
6. In the header, click the green **Approve** button
7. In the dialog:
   - Enter **Approved Sample #** (required) - e.g., "S1", "S2"
   - Select **Color Match Rating** (required for dyeing) - Excellent Match, Good Match, Acceptable, or Poor Match
   - Optionally add **Remarks**
8. Click **Approve**

### After Internal Approval (Send to Buyer)

9. After internal approval, a **Buyer Approval** section appears
10. Click **Send to Buyer** button
11. In the dialog:
    - Confirm **Sent Date**
    - Optionally add **Remarks**
12. Click **Send to Buyer**
13. Wait for buyer feedback, then:
    - Click **Buyer Approved** to record buyer's approval (optionally add buyer remarks)
    - Or click **Buyer Rejected** and enter buyer's rejection remarks (required)

---

## Steps for Printing Lab Dip (Internal Approval)

1. Open **Manufacturing** (in the sidebar)
2. Click **Dyeing & Printing**
3. Stay on the **Lab Dips** tab
4. In the **All types** filter pick **Printing** (or search for the lab dip directly)
5. Click the lab dip row to open its detail page
6. Click the green **Approve** button in the header
7. In the dialog:
   - Enter **Approved Sample #** (required) - e.g., "S1", "S2"
   - Color Match Rating is optional for printing
   - Optionally add **Remarks**
8. Click **Approve**
9. Follow the same **Buyer Approval** flow as dyeing (steps 9-13 above)

---

## Steps for Lace Lab Dip Approval

Lace lab dips have a different workflow with sequential status transitions.

1. Open **Materials & Masters** (in the sidebar)
2. Click **Lace Lab Dips**
3. Find the lab dip that shows status **Awaiting Buyer** (yellow badge). Use the search box, or pick it in the **All statuses** filter; **All greige laces** narrows to one greige lace and **All processors** to one processor
4. Click to open the detail page
5. In the **Workflow Status** card, you'll see **Update Status** section with buttons
6. To approve:
   - Enter **Buyer Remarks** (optional)
   - Enter **Approval Reference** (required) - e.g., "BUYER-APPROVE-001"
   - Click the **Approved** button
7. To reject:
   - Enter **Rejection Reason** in the text field (required)
   - Click the **Rejected** button (red)

---

## To Reject a Lab Dip

### Dyeing/Printing Internal Rejection
1. On the lab dip detail page, click the red **Reject** button
2. In the dialog:
   - Enter **Rejection Reason** (required) - e.g., "Color shade mismatch", "Quality issues"
   - Optionally add **Additional Remarks**
3. Click **Reject**

### After Rejection - Request Resubmit
- If a lab dip was rejected, click **Request Resubmit** to ask the processor for a new sample
- For buyer-rejected lab dips, click **Request Resubmit** in the Buyer Approval section

---

## Traps

- **Sample number is required** - You must enter which sample number was approved (S1, S2, etc.)
- **Color match rating required for dyeing** - Internal approval for dyeing requires a color match rating
- **Buyer approval is a separate step** - Internal approval alone doesn't complete the process; you must also send to buyer and record their decision
- **Lace workflow is sequential** - Lace lab dips must go through each status: Pending -> Sent to Processor -> Sample Received -> Awaiting Buyer -> Approved/Rejected
- **Rejection reason required** - You cannot reject without providing a reason

---

## After approving

- The lab dip status changes to **Approved** (green badge)
- For dyeing/printing: once buyer approves, the approved shade can be used for bulk production
- For lace: the dyed lace variant can be ordered for production
- Approved lab dips serve as color reference for job work orders
