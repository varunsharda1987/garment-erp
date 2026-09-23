---
slug: fpt-create
title: Create a Fabric Physical Test (FPT)
keywords:
  # English
  - FPT
  - fabric physical test
  - fabric testing
  - shrinkage test
  - GSM test
  - tensile test
  - construction test
  - count test
  - testing lab
  - quality control
  - quality test
  - record fabric test result
  - fabric retest
  - fabric test failed
  # Hinglish
  - FPT banana
  - fabric test karna
  - shrinkage check
  - GSM check karna
  - fabric quality
  - test lab bhejo
  - cloth test
  - fabric test ka result
  - fabric dobara test
  # Devanagari
  - एफपीटी
  - फैब्रिक टेस्ट
  - श्रिंकेज टेस्ट
  - जीएसएम टेस्ट
  - कपड़ा टेस्ट
  - गुणवत्ता जांच
  - टेस्टिंग लैब
  - फैब्रिक टेस्ट रिजल्ट
  - फैब्रिक रीटेस्ट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricPhysicalTestForm.tsx
  - frontend/src/pages/FabricPhysicalTests.tsx
  - frontend/src/components/samples/LabResultDialog.tsx
route: /fabric-physical-tests/new
---

The fabric test is done on the fabric lot **after it is inwarded** — not on a sample. (A sample's
test is the garment test, recorded on the sample's **Lab Tests** tab.)

## Before you start

- Fabric must exist in the Fabric Master
- Testing Lab should be set up (optional but recommended)
- Know the expected GSM, construction, and count specifications for the fabric

## Steps

1. Open **Manufacturing → Testing (FPT/GPT)** in the sidebar, then select **Fabric Physical Tests**.
2. Click **+ New Test** (top right corner).

### Select Fabric

3. In the **Select Fabric*** section, click the search dropdown.
4. Type the fabric code or name to search.
5. Select the fabric from the dropdown list.

### Select Testing Lab (Optional)

6. In the **Testing Lab** section, click the search dropdown.
7. Search and select the lab where the sample will be tested.

### Enter Sample Details

8. Fill in the **Sample Details** section:
   - **Sent to Lab Date** - Date the sample was sent (defaults to today)
   - **Sample Quantity (meters)** - Amount of fabric sent for testing
   - **Batch Number** - Reference batch number (e.g., BT-2026-001)

### Set Expected Values

9. Fill in the **Expected Values** section:
   - **Expected GSM** - Target GSM for the fabric
   - **GSM Tolerance (%)** - Acceptable variance from expected GSM (defaults to 5%)
   - **Expected Construction** - Fabric construction specification (e.g., 40s x 40s / 120 x 60)
   - **Expected Count** - Yarn count specification (e.g., 40s)

### Link to Style or Customer (Optional)

10. In the **Related Information** section:
    - **Style** - Search and link to a specific style if this test is for a particular design
    - **Customer** - Search and link to a customer if testing is customer-specific

### Save

11. Click **Create Test** to save.

## Recording the lab's result

1. Open **Manufacturing → Testing (FPT/GPT)**, then **Fabric Physical Tests**.
2. On the test's card click **Record result** (it says **Edit result** once a result is in).
3. Enter the **Lab report no.**, **Result received on** and the **Result** (Pass, Conditional pass,
   Fail, Retest required). For a fail, fill **Why it failed**. Optionally add the **Report link**,
   **Remarks** and **Detailed readings** (GSM, construction, count, shrinkage, colour fastness,
   pilling, spirality).
4. Click **Save result**.

## Retesting a failed fabric test

1. On a failed test's card click **Retest**. It only appears on a failure that has not been retested
   yet.
2. Pick the **Test requirement form for this retest** if the fabric went to the lab with a new form, or
   leave **No form (tested in-house)**. Only this style's forms without a fabric result are listed — a
   second test goes on a second form.
3. Fill the **Retest reason** and the result as above, then **Save result**. A new test is created,
   marked **Retest #1**, and the failed one stops counting as an open quality failure.

## Test statuses

Tests show one of these statuses:
- **PENDING** - Awaiting test results from the lab
- **PASS** - All test parameters within tolerance
- **FAIL** - One or more test parameters outside tolerance
- **RETEST REQUIRED** - Test needs to be repeated

## Viewing tests

The test list shows:
- Test Number (auto-generated)
- Overall status badge
- Batch number
- Sent to Lab date
- Result Received date
- Sample Quantity
- GSM results (tested vs expected)
- Construction results
- Count results

Use the search box to find tests by test number or batch. Use the status filter to show only Pending, Passed, Failed, or Retest Required tests.

## Traps

- Fabric is the only required field - the test cannot be created without selecting a fabric
- GSM Tolerance defaults to 5% if not specified
- Test results are recorded separately after the lab returns results — use **Record result** on the card
- A failed fabric test blocks cutting for the style when the buyer has fabric testing set to block
  production; a passing retest (or an administrator's override through approval) clears it
- A test can be retested only once; retest the newest test in the chain

## After saving

- Test record is created with status **PENDING**
- Test Number is auto-generated (e.g., FPT-2026-001)
- When lab results arrive, click **Record result** on its card
- Failed tests are retested with **Retest**, which creates a new linked test
