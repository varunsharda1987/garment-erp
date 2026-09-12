---
slug: sample-approve
title: Approve or Reject a Sample
keywords:
  # English
  - approve sample
  - reject sample
  - sample approval
  - sample feedback
  - record feedback
  - buyer feedback
  - revision needed
  - approved with comments
  # Hinglish
  - sample approve karna
  - sample reject karna
  - sample pass karna
  - feedback dena
  - buyer ka feedback
  # Devanagari
  - सैंपल अप्रूव
  - सैंपल रिजेक्ट
  - सैंपल पास
  - फीडबैक देना
  - खरीदार का फीडबैक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/SampleDetail.tsx
route: /samples
---

## Before you start

- The sample must have been sent to the buyer (status must be **Sent** or **Feedback Pending**)
- You need the buyer's feedback on the sample

## Steps to approve or reject

1. Open **Manufacturing → Sample Tracking** in the sidebar.
2. Find the sample in the list and click to open its detail page.
3. Click the **Record Feedback** button in the top-right corner.
4. In the **Record Buyer Feedback** dialog:
   - Select the **Status** from the dropdown:
     - **Approved** - buyer accepts the sample as-is
     - **Approved (with comments)** - buyer accepts with minor notes
     - **Revision Needed** - buyer wants changes before approval
     - **Rejected** - buyer does not accept the sample
   - Enter any **Feedback Comments** from the buyer.
   - Enter any **Measurement Notes** if there are measurement-specific comments.
5. Click **Save Feedback** to record the buyer's response.

## Creating a revision after rejection

If the sample is rejected or needs revision:

1. Open the rejected sample's detail page.
2. For Fit Samples, click **Create Revision** to start a new version.
3. The system creates a new sample with an incremented version number.

## Traps

- The **Record Feedback** button only appears when the sample status is **Sent** or **Feedback Pending**
- Samples must be marked as sent before you can record buyer feedback
- Only Fit Samples can create revisions; other sample types need a new sample

## After recording feedback

- The sample status updates to reflect the buyer's decision (Approved, Rejected, etc.)
- Approved samples can proceed to production
- Rejected or revision-needed samples show a **Revision Required** badge
- The feedback date and comments are recorded in the Buyer Feedback section
