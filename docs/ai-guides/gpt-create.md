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
  # Hinglish
  - GPT banana
  - garment test karna
  - measurement check
  - shrinkage check karna
  - quality testing karna
  - test lab mein bhejana
  - garment quality
  # Devanagari (MANDATORY)
  - जीपीटी
  - गारमेंट टेस्ट
  - मेजरमेंट टेस्ट
  - क्वालिटी टेस्ट
  - सिकुड़न टेस्ट
  - सीम स्ट्रेंथ
  - रंग पक्कापन
  - फिजिकल टेस्टिंग
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/GarmentPhysicalTestForm.tsx
  - frontend/src/pages/GarmentPhysicalTests.tsx
route: /testing/garment-tests/new
---

## Before you start

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

- **Work Order is required**: You cannot create a GPT without selecting a Work Order first.
- **Style is required**: Either auto-filled from the Work Order or manually selected.
- **Test starts as PENDING**: Results (shrinkage, seam strength, color fastness) are recorded later after the lab completes testing.
- **Buyer approval checkbox**: If checked, the test will show "Buyer Approval Pending" badge until buyer approval is recorded.

## After saving

- The test is created with status **PENDING**.
- The test appears in the Garment Physical Tests list with its auto-generated test number.
- Later, record test results (shrinkage %, seam strength, color fastness) to mark the test as PASS, FAIL, CONDITIONAL_PASS, or RETEST_REQUIRED.
- If buyer approval was required, record buyer approval separately.
- If the test fails, you can create a retest record linked to the original test.
