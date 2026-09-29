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
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/SampleList.tsx
  - frontend/src/pages/SampleDetail.tsx
  - frontend/src/components/samples/SampleActionMenu.tsx
  - frontend/src/components/samples/SampleTestingPanel.tsx
  - frontend/src/types/sample.types.ts
  - frontend/src/components/filters/FilterBar.tsx
  - frontend/src/components/CustomerCombobox.tsx
  - frontend/src/components/StyleCombobox.tsx
route: /samples
---

## Steps

1. Open **Manufacturing → Sample Tracking** in the sidebar.

2. View the summary cards at the top:
   - **Total Samples** — count of all samples
   - **Pending Approval** — samples waiting for buyer feedback
   - **Overdue** — samples past their required date (shown in red)
   - **Approved** — samples approved by buyer

3. Use the **Filters** row to find specific samples:
   - **Search** — sample number, buyer style code, our style code, style name or customer name
   - **All types** dropdown — FIT Sample, PP Sample (Pre-Production), Size Set Sample, Photoshoot Sample, Production Sample or Shipment Sample
   - **All statuses** dropdown — Requested, In Progress, Submitted, Approved, Rejected, Sent to Buyer, Awaiting Feedback, Revision Needed or Approved (with comments)
   - **All customers** and **All styles** — searchable pickers; type to find one, or pick the "All …" row to see everything. In **All styles**, type the buyer style code or our style code — each style reads buyer style code first, our Style Code in brackets
   - **Group by** dropdown — **No grouping**, **By sample type**, **By customer** or **Overdue first**
   - Click **Clear N filters** to remove every filter and go back to page 1. It keeps your **Group by** choice. If nothing matches, the list says "No samples match these filters." with a **Clear filters** button.

4. The table shows each sample with:
   - **Buyer Style Code** — the buyer's code for the style, with the style name under it ("No style" when the sample has none)
   - **Style Code** — our style code
   - **Sample #** — sample number with version badge and overdue indicator (red alert icon)
   - **Type** — FIT Sample, PP Sample, Size Set Sample, etc.
   - **Customer** — customer name
   - **Required By** — due date (red if overdue)
   - **Status** — current status badge
   - **Ver.** — version number for FIT/PP/Size Set samples (v1, v2, etc.)
   - **SLA** — timeline status (On Time, Approaching, Delayed, Completed)
   - **⋯** — the actions menu at the end of the row (see below)

5. Click any row to open the **Sample Detail** page.

## Moving a sample forward

Every action lives behind the **⋯** button at the end of the sample's row. Click it to open
the menu; the top item is the one step that sample is ready for, followed by **View Details**,
**Edit**, and **Delete**.

| Current Status | Menu offers |
|----------------|-------------|
| Requested | **Start Progress** — asks you to confirm, then moves it to In Progress |
| In Progress | **Mark Complete** — pick the completion date, then click Mark Complete |
| Submitted | **Mark Sent** — enter sent date, courier mode and tracking number |
| Sent to Buyer / Awaiting Feedback | **Record Feedback** — enter the buyer's response |
| Rejected / Revision Needed | **Create Revision** — asks you to confirm, then starts a new version |
| Approved | no further action — the row shows Approved |

Nothing is applied on the click alone: each action either asks you to confirm or opens a
dialog you fill in and save. Cancelling leaves the sample exactly as it was.

The same **⋯** menu is on the sample's own page (top right, next to **Edit**) and on the
sample blocker cards in **Production Status**, with the same steps and the same confirmations.

## Understanding sample statuses

| Status | Meaning |
|--------|---------|
| **Requested** | Sample request created, not yet started |
| **In Progress** | Work has begun on the sample |
| **Submitted** | Sample completed, ready to send |
| **Sent to Buyer** | Sample dispatched to buyer |
| **Awaiting Feedback** | Waiting for buyer response |
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
   - **Buyer Style Code**, with the style name under it and a link button that opens the style
   - **Style Code** (our code)
   - Customer
   - Request Date and Required By date
   - Created By and Created On

3. **Tabs** for detailed information:
   - **Measurements** — spec vs actual measurements with pass/fail status
   - **Colorways** — for PP samples, shows colors sent with approval status
   - **Size Set** — for size set samples, shows sizes with quantities
   - **Lab Tests** — every time this sample went to a testing lab: the test requirement form for
     each round, and the fabric and garment results that came back. See the guide "Send a sample for
     lab testing and record the result".

4. **Right panel** shows:
   - **Shipping Info** — sent date, courier mode, tracking number, received date
   - **Buyer Feedback** — feedback date, comments, measurement notes
   - **Related Samples** — other samples for the same style
   - **Notes** — any remarks

## WhatsApp notification

When a sample is in **Sent to Buyer** or **Awaiting Feedback** status:
1. Click **Notify buyer on WhatsApp** in the Shipping Info card
2. Review the pre-filled message with sample and shipping details
3. Enter or confirm the buyer's WhatsApp number
4. Click **Send on WhatsApp**

Note: Your WhatsApp must be linked in **Team & Settings → My WhatsApp** for this feature to work.

## Traps

- **Overdue indicator** — a red alert icon next to the sample number means the required date has passed. Check the "Overdue" summary card or choose **Overdue first** in **Group by** to prioritize these.

- **Version column** — only FIT Sample, PP Sample, and Size Set Sample show versions. Other sample types show "-" in this column. Those same three are the only types that offer **Create Revision**; every other type is remade as a new sample instead.

- **Actions are behind the ⋯ menu** — there are no one-click status buttons on the row. Open the ⋯ menu at the end of the row and pick the step from there.

- **Delete restrictions** — you cannot delete samples that are already Approved or Approved (with comments); the Delete item does not appear in the menu for those.

- **SLA colors** — green = on time, yellow = approaching deadline, red = delayed, gray = completed.

- **Grouping resets pagination** — when using Group By, samples are grouped into cards without pagination. Switch **Group by** back to **No grouping** for the paginated view.
