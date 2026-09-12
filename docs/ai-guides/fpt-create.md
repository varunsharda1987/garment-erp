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
  # Hinglish
  - FPT banana
  - fabric test karna
  - shrinkage check
  - GSM check karna
  - fabric quality
  - test lab bhejo
  - cloth test
  # Devanagari
  - एफपीटी
  - फैब्रिक टेस्ट
  - श्रिंकेज टेस्ट
  - जीएसएम टेस्ट
  - कपड़ा टेस्ट
  - गुणवत्ता जांच
  - टेस्टिंग लैब
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricPhysicalTestForm.tsx
  - frontend/src/pages/FabricPhysicalTests.tsx
route: /testing/fabric-tests/new
---

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

## Test statuses

After creation, test results can be recorded. Tests show one of these statuses:
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
- Test results are recorded separately after the lab returns results
- If a test fails, check if a retest is needed before proceeding with the fabric

## After saving

- Test record is created with status **PENDING**
- Test Number is auto-generated (e.g., FPT-2026-001)
- When lab results arrive, update the test with actual values
- System compares actual vs expected values and marks PASS/FAIL
- Failed tests can be flagged for retest
