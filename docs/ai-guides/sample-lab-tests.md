---
slug: sample-lab-tests
title: Send a sample for lab testing and record the result
keywords:
  # English
  - lab test sample
  - sample lab testing
  - send sample to lab
  - lab result
  - record lab result
  - garment test result
  - gpt result
  - pp sample test
  - retest
  - retest round
  - second test
  - test failed
  - lab report number
  - intertek result
  - lab tests tab
  - link trf to sample
  # Hinglish
  - sample lab bhejna
  - lab ka result dalna
  - test fail ho gaya
  - dobara test karna
  - retest karna
  - lab report number dalna
  - sample ka test
  # Devanagari
  - सैंपल लैब टेस्ट
  - लैब रिजल्ट
  - टेस्ट फेल
  - दोबारा टेस्ट
  - रीटेस्ट
  - लैब रिपोर्ट
  - सैंपल टेस्टिंग
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/SampleDetail.tsx
  - frontend/src/components/samples/SampleTestingPanel.tsx
  - frontend/src/components/samples/LabResultDialog.tsx
  - frontend/src/pages/BuyerTrfForm.tsx
  - frontend/src/components/RecordFeedbackDialog.tsx
  - backend/src/services/productionBlockingValidation.service.ts
route: /samples
---

## How it works

Every time a sample goes to a testing lab it is one **lab round**: one test requirement form (TRF)
that travels with the sample, and the result that comes back. A retest is a new round with its own
form. The sample's test is the **garment test**, done on the PP sample before it is sent to the buyer.
Fabric tests are done on the fabric lot after it is inwarded and are recorded on **Manufacturing >
Testing (FPT/GPT) > Fabric Physical Tests** instead.

## Send a sample for lab testing

1. Open **Manufacturing > Sample Tracking** and click the sample.
2. Open the **Lab Tests** tab.
3. Click **Send for lab testing**. The test requirement form opens already filled from the sample:
   the style is fixed, the buyer's order is picked for you when the style is on exactly one of their
   orders, and the sample stage is ticked (PP Sample → PP, Shipment Sample → SHIPMENT).
4. Check the form, click **Save**, then **Print** it and send it with the sample. Saving brings you
   back to the sample's **Lab Tests** tab, where the form shows as **Round 1**.
5. Change the form's status from the dropdown on the round as it moves: **Draft**, **Issued**,
   **Sent to lab**, **Closed**.

If the sample has no style linked, the tab says so — link a style to the sample first.

## Record the lab's result

1. On the round, click **Record result** in the **Garment** row.
2. Enter the **Lab report no.**, the **Result received on** date and the **Result** (Pass, Conditional
   pass, Fail, Retest required). For a fail, fill **Why it failed**.
3. Optionally add the **Report link** and **Remarks**, and open **Detailed readings** for shrinkage,
   seam strength, colour fastness and so on.
4. Click **Save result**. The round shows **Passed**, **Failed** or **Awaiting result**.

To correct a result, click **Edit result** on the same row.

## If the lab round failed — start a retest round

1. On the sample's **Lab Tests** tab click **Start retest round**.
2. The new form copies the failed round's form — including corrections such as fibre content and
   season — ticks **Retest** and fills **Previous report no.** with the failed round's lab report
   number. Check it and click **Save**; it shows as the next round.
3. When the lab answers, click **Record result** on the new round. It is saved as a retest of the
   earlier result, and the earlier failure stops counting as an open quality failure.

## A form raised without the sample

A test requirement form made from **Test Requirement Forms** for the same style and buyer appears under
**Not linked to a sample yet**. Click **Link to this sample** to make it one of this sample's rounds.

## Traps

- One garment result per form. Recording a second result on the same form is refused — a second test
  needs a second form (**Start retest round**).
- **Start retest round** appears only when the latest round failed. A retest after a pass is refused.
- A form that already has a lab result cannot be removed, and a sample with lab rounds cannot be
  deleted.
- The garment test on a sample does not need a work order.
- Approving a sample whose latest round failed (or has no result yet) shows a warning in **Record
  Feedback**, but the approval is still allowed.
- If the buyer has **Blocks Dispatch** ticked for **Shipment Sample** on the customer's Sample
  Requirements, bulk dispatch waits until the style's Shipment Sample is approved **and** the latest
  lab round on the style's samples passed — normally the PP sample's garment test.
- The panel also shows the style's latest **fabric test**. A failed fabric test blocks cutting for the
  style (when the buyer has fabric testing set to block production) until a retest passes.
- Only users with the **testing** permission see the buttons; others see the rounds read-only.
