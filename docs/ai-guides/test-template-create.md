---
slug: test-template-create
title: Create a Test Template
keywords:
  # English
  - test template
  - testing template
  - test parameters
  - test setup
  - fpt template
  - gpt template
  - fabric physical test
  - garment physical test
  - tolerance ranges
  - gsm tolerance
  - shrinkage tolerance
  - testing standards
  # Hinglish
  - test template banana
  - testing setup karna
  - template banao
  - fpt gpt template
  # Devanagari
  - टेस्ट टेम्पलेट
  - टेस्टिंग सेटअप
  - टेम्पलेट बनाना
  - परीक्षण टेम्पलेट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TestTemplateForm.tsx
  - frontend/src/pages/TestTemplates.tsx
  - frontend/src/pages/TestingDashboard.tsx
route: /testing/templates/new
---

## Before you start

- You need access to the Testing module
- Know whether you are creating a template for **FPT** (Fabric Physical Test) or **GPT** (Garment Physical Test)
- Have the list of parameters you want to test (e.g., GSM, Shrinkage, Color Fastness)
- Know the acceptable tolerance ranges if applicable

## Steps

1. Open **Manufacturing -> Testing (FPT/GPT)** in the sidebar.

2. On the Testing Dashboard, click the **Test Templates** card to go to the templates list.

3. Click the **Create Template** button in the top-right corner.

4. Fill in the **Basic Information** section:
   - **Template Code** - Enter a unique code (e.g., FPT-GSM-01). The code will auto-uppercase.
   - **Template Name** - Enter a descriptive name (e.g., Standard GSM Test).
   - **Template Type** - Select **FPT (Fabric Physical Test)** or **GPT (Garment Physical Test)**.
   - **Active** toggle - Leave ON to make the template available for use.

5. Add **Required Parameters** (at least one is mandatory):
   - Type a parameter name in the input field (e.g., GSM, Shrinkage Length, Color Fastness).
   - Press Enter or click the **+** button to add it.
   - Each parameter appears as a badge. Click the **X** on a badge to remove it.

6. Add **Optional Parameters** (not required):
   - Same process as required parameters.
   - Use for parameters that may or may not be tested (e.g., Pilling, Spirality, Appearance).

7. Set **Tolerance Ranges** (optional but recommended):
   - **GSM Tolerance** - Enter min/max acceptable GSM values.
   - **Shrinkage Length (%)** - Enter min/max acceptable shrinkage percentage for length.
   - **Shrinkage Width (%)** - Enter min/max acceptable shrinkage percentage for width.

8. Fill in **Additional Information** (optional):
   - **Description** - Explain the purpose and scope of this test template.
   - **Testing Standards** - Enter applicable standards (e.g., ASTM D3776, ISO 5084).

9. Click **Create Template** to save.

## Traps

- **At least one Required Parameter is mandatory** - The form will not submit without at least one required parameter.
- **Template Code must be unique** - If you get an error, try a different code.
- **Duplicate parameters are ignored** - Adding the same parameter twice will have no effect.
- **Tolerance values are optional per range** - You can set just a min, just a max, or both.

## After saving

- The template appears in the Test Templates list.
- The template is now available for use when creating FPT or GPT test records.
- You can filter templates by type (FPT/GPT) using the dropdown in the list view.
- Active templates will be selectable; inactive templates will not appear in test creation dropdowns.
- To edit a template later, click **Edit** on the template card (feature coming soon).
