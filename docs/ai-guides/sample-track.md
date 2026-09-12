---
slug: sample-track
title: Track Sample Status
keywords:
  # English
  - sample status
  - track sample
  - sample progress
  - sample tracking
  - where is sample
  - sample list
  - find sample
  - sample overdue
  - sample approval
  - sample feedback
  - sample sent
  - fit sample
  - pp sample
  - size set sample
  - shipment sample
  - photo sample
  # Hinglish
  - sample kahan hai
  - sample status dekhna
  - sample track karna
  - sample dhundna
  - sample ki progress
  - sample approve hua
  - sample reject hua
  - sample bheja gaya
  # Devanagari
  - सैंपल स्टेटस
  - सैंपल ट्रैकिंग
  - सैंपल कहां है
  - सैंपल ढूंढना
  - सैंपल प्रोग्रेस
  - सैंपल अप्रूव
  - सैंपल रिजेक्ट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/SampleList.tsx
  - frontend/src/pages/SampleDetail.tsx
route: /samples
---

## Steps

1. Open **Manufacturing → Sample Tracking** in the sidebar.

2. View the summary cards at the top:
   - **Total Samples** — count of all samples
   - **Pending Approval** — samples waiting for buyer feedback
   - **Overdue** — samples past their required date (shown in red)
   - **Approved** — samples approved by buyer

3. Use the **Filters** section to find specific samples:
   - **Search** — search by sample number, style code, or customer name
   - **Sample Type** dropdown — filter by FIT Sample, PP Sample, Size Set Sample, Shipment Sample, or Photoshoot Sample
   - **Status** dropdown — filter by Requested, In Progress, Submitted, Sent, Feedback Pending, Approved, Rejected, or Revision Needed
   - **Customer** dropdown — filter by a specific customer
   - **Group By** dropdown — organize the list by Sample Type, by Customer, or Overdue First
   - **Running Styles Only** checkbox — show only samples for active/running styles
   - Click **Reset** to clear all filters

4. The table shows each sample with:
   - **Sample #** — sample number with version badge and overdue indicator (red alert icon)
   - **Type** — FIT Sample, PP Sample, Size Set Sample, etc.
   - **Style** — style code and buyer reference
   - **Customer** — customer name
   - **Required By** — due date (red if overdue)
   - **Status** — current status badge
   - **Ver.** — version number for FIT/PP/Size Set samples (v1, v2, etc.)
   - **SLA** — timeline status (On Time, Approaching, Delayed, Completed)
   - **Quick Action** — fast status updates
   - **Actions** — View, Edit, Delete buttons

5. Click any row to open the **Sample Detail** page.

## Understanding sample statuses

| Status | Meaning |
|--------|---------|
| **Requested** | Sample request created, not yet started |
| **In Progress** | Work has begun on the sample |
| **Submitted** | Sample completed, ready to send |
| **Sent** | Sample dispatched to buyer |
| **Feedback Pending** | Waiting for buyer response |
| **Approved** | Buyer approved the sample |
| **Approved (with comments)** | Approved but buyer has notes |
| **Revision Needed** | Buyer requested changes |
| **Rejected** | Buyer rejected the sample |

## Viewing sample details

On the **Sample Detail** page:

1. **Header** shows:
   - Sample number and status badge
   - Sample type (FIT Sample, PP Sample, etc.)
   - Version number for versioned types
   - Overdue badge if past due date

2. **Sample Details** card shows:
   - Style code with link to style
   - Buyer Reference
   - Customer
   - Request Date and Required By date
   - Created By and Created On

3. **Tabs** for detailed information:
   - **Measurements** — spec vs actual measurements with pass/fail status
   - **Colorways** — for PP samples, shows colors sent with approval status
   - **Size Set** — for size set samples, shows sizes with quantities

4. **Right panel** shows:
   - **Shipping Info** — sent date, courier mode, tracking number, received date
   - **Buyer Feedback** — feedback date, comments, measurement notes
   - **Related Samples** — other samples for the same style
   - **Notes** — any remarks

## Quick actions from detail page

Based on current status, different action buttons appear:

| Current Status | Available Action |
|----------------|------------------|
| Requested | **Start Progress** — move to In Progress |
| In Progress | **Mark Complete** — move to Submitted |
| Submitted | **Mark as Sent** — record shipping details |
| Sent / Feedback Pending | **Record Feedback** — enter buyer's response |
| Rejected / Revision Needed (FIT only) | **Create Revision** — start a new version |

## WhatsApp notification

When a sample is in **Sent** or **Feedback Pending** status:
1. Click **Notify buyer on WhatsApp** in the Shipping Info card
2. Review the pre-filled message with sample and shipping details
3. Enter or confirm the buyer's WhatsApp number
4. Click **Send on WhatsApp**

Note: Your WhatsApp must be linked in **Team & Settings → My WhatsApp** for this feature to work.

## Traps

- **Overdue indicator** — a red alert icon next to the sample number means the required date has passed. Check the "Overdue" summary card or use the "Overdue First" grouping to prioritize these.

- **Version column** — only FIT Sample, PP Sample, and Size Set Sample show versions. Other sample types show "-" in this column.

- **Delete restrictions** — you cannot delete samples that are already Approved or Approved (with comments).

- **SLA colors** — green = on time, yellow = approaching deadline, red = delayed, gray = completed.

- **Grouping resets pagination** — when using Group By, samples are grouped into cards without pagination. Switch back to "No Grouping" for paginated view.
