---
slug: gpt-create
title: Create a Garment Physical Test (GPT)
keywords:
  # English
  - GPT
  - garment physical test
  - garment testing
  - measurement test
  - quality test
  - shrinkage test
  - seam strength
  - color fastness
  - physical testing
  - finished garment test
  - testing lab
  - pp sample garment test
  - record garment test result
  - garment retest
  # Hinglish
  - GPT banana
  - garment test karna
  - measurement check
  - shrinkage check karna
  - quality testing karna
  - test lab mein bhejana
  - garment quality
  - garment test ka result
  # Devanagari (MANDATORY)
  - जीपीटी
  - गारमेंट टेस्ट
  - मेजरमेंट टेस्ट
  - क्वालिटी टेस्ट
  - सिकुड़न टेस्ट
  - सीम स्ट्रेंथ
  - रंग पक्कापन
  - फिजिकल टेस्टिंग
  - गारमेंट टेस्ट रिजल्ट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/GarmentPhysicalTestForm.tsx
  - frontend/src/pages/GarmentPhysicalTests.tsx
  - frontend/src/components/samples/SampleTestingPanel.tsx
  - frontend/src/components/samples/LabResultDialog.tsx
route: /garment-physical-tests/new
---

## Which way in

- **Testing a sample** — the usual case. The garment test is done on the PP sample **before it is sent
  to the buyer**, when there is no work order yet. Do it from the sample: **Manufacturing → Sample
  Tracking**, open the sample, **Lab Tests** tab, **Send for lab testing**, then **Record result** on
  the round. No work order is needed. See the guide "Send a sample for lab testing and record the
  result".
- **Testing garments from a production run** — use the **Create GPT** form below; it needs a work
  order.

## Before you start (Create GPT form)

- A **Work Order** must already exist for the garment you want to test
- The Work Order should have a Style linked to it
- If sending to an external lab, the **Testing Lab** should be in the system (optional)

## Steps

1. Open **Manufacturing > Testing (FPT/GPT)** in the sidebar, or go directly to the Garment Physical Tests list.

2. Click the **Create GPT** button in the top-right corner.

3. In the **Select Work Order** card, click the search field and type the work order number. Select the work order from the dropdown.
   - The **Style** is automatically filled from the work order.

4. (Optional) If you need to override the style, use the **Style** search field to select a different style.

5. In the **Testing Lab** card, search for and select the lab where the sample will be tested. Leave blank for in-house testing.

6. In the **Sample Details** card:
   - **Sent to Lab Date**: The date the sample was sent (defaults to today).
   - **Sample Quantity (pcs)**: Enter the number of garment pieces being tested (e.g., 5).
   - **Buyer approval required**: Check this box if the test results need buyer sign-off before proceeding.

7. (Optional) In the **Customer** card, search and select a customer if you want to link this test to a specific buyer.

8. Click **Create Test** to save.

## Traps

- **Work Order is required on this form**: the **Create GPT** form is for production runs. A sample's
  garment test has no work order and is recorded from the sample's **Lab Tests** tab instead.
- **Style is required**: Either auto-filled from the Work Order or manually selected.
- **Test starts as PENDING**: Results (shrinkage, seam strength, color fastness) are recorded later after the lab completes testing.
- **Buyer approval checkbox**: If checked, the test will show "Buyer Approval Pending" badge until buyer approval is recorded.

## After saving

- The test is created with status **PENDING**.
- The test appears in the Garment Physical Tests list with its auto-generated test number. A sample's
  garment test shows **None — sample test** as its work order, with its form and sample number beside
  the test number (click it to open the sample's **Lab Tests** tab).
- When the lab answers, click **Record result** on the test's card and enter the lab report no., date,
  result and optional readings. Click **Edit result** later to correct it.
- If the test fails, click **Retest** on its card (shown only on a failure not yet retested). Optionally
  pick the new test requirement form; a second test goes on a second form.
