---
slug: sample-create
title: Create a Sample Request
keywords:
  # English
  - sample
  - sample request
  - create sample
  - new sample
  - proto sample
  - original sample
  - look sample
  - production sample
  - fit sample
  - PP sample
  - pre-production sample
  - TOP sample
  - size set sample
  - shipment sample
  - photoshoot sample
  - photo sample
  - SMS sample
  - buyer approval
  - sample tracking
  # Hinglish
  - sample banana
  - sample request karna
  - naya sample
  - proto banana
  - original sample banana
  - look sample banana
  - fit sample banana
  - PP sample banana
  - size set banana
  - sample bhejna
  - buyer ko sample
  # Devanagari
  - सैंपल
  - सैंपल रिक्वेस्ट
  - सैंपल बनाना
  - नया सैंपल
  - प्रोटो
  - प्रोटो सैंपल
  - ओरिजिनल सैंपल
  - लुक सैंपल
  - प्रोडक्शन सैंपल
  - फिट सैंपल
  - पीपी सैंपल
  - साइज सेट
  - शिपमेंट सैंपल
  - फोटोशूट सैंपल
  - बायर अप्रूवल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/SampleForm.tsx
  - frontend/src/pages/SampleList.tsx
  - frontend/src/types/sample.types.ts
route: /samples/new
---

## Before you start

- A **Customer** must exist in the system (samples are always linked to a customer).
- If linking to a style: the **Style** must exist and be assigned to the customer.
- For PP Sample or Size Set Sample with colorways/sizes: the style must have color options and size options defined.
- **Cutting waits for the Size Set Sample.** A production run cannot be pushed to cutting, and no cutting batch can be created, until the style has an **approved Size Set Sample** — even for stock production (the customer is then the house brand). Because of the sequence below, that means FIT → PP → Size Set, each approved.

## Steps

1. Open **Manufacturing → Sample Tracking** in the sidebar.
2. Click **New Sample** (top-right button).
3. Fill in the **Basic Information** card:
   - **Customer** * — Select the customer requesting the sample.
   - **Sample Type** * — Choose from:
     - Original Sample
     - Look Sample
     - FIT Sample
     - PP Sample (Pre-Production)
     - Size Set Sample
     - Shipment Sample
     - Photoshoot Sample
     - Production Sample
   - **Style** — Optional. Select a style from the customer's styles if applicable.
   - **Required By** * — Date when the sample is needed (defaults to 7 days from today).
   - **Notes** — Any special instructions or remarks.

4. For **Shipment Sample**, fill in the additional card:
   - **Production Lot** — e.g., LOT-2024-001
   - **Linked Dispatch ID** — Optional dispatch reference

5. For **Photoshoot Sample**, fill in the additional card:
   - **Sent To** — Studio or agency name
   - **Purpose** — e.g., Catalog, Lookbook, Social Media

6. Add optional details in the tabs:
   - **Measurements** tab (all sample types):
     - Click **Add** to add measurement specs.
     - Enter **Measurement Point** (e.g., Chest, Waist, Length).
     - Enter **Spec** value in inches/cm.
     - Enter **Tolerance** (default ±0.5).
   - **Colorways** tab (PP Sample only):
     - Click **Add** to add colorways.
     - Select **Color** from the style's color options.
     - Enter **Fabric Lot** (optional).
     - Enter **Qty** to send.
   - **Size Set** tab (Size Set Sample only):
     - Click **Add** to add size entries.
     - Select **Size** from the style's size options.
     - Select **Color** from the style's color options.
     - Enter **Qty** per size/color combination.

7. Click **Create Sample** in the Actions card.

## Sample types explained

| Type | Purpose | When to use |
|------|---------|-------------|
| **Original Sample** | The first physical make of the design | Concept stage, before fit work starts |
| **Look Sample** | Shows the overall look and finish of the garment | Aesthetic sign-off, alongside or after the Original |
| **FIT Sample** | First sample with measurements for buyer approval | Initial fit check before production |
| **PP Sample** | Pre-production sample with actual fabric, multiple colorways | After fit is approved, before bulk |
| **Size Set Sample** | Jumping sizes with mix of colors for grading approval | Before bulk production to verify sizing |
| **Shipment Sample** | Sample sent before each shipment from production lot | Quality check before shipping bulk |
| **Photoshoot Sample** | For catalog/marketing purposes | Marketing needs, no return tracking |
| **Production Sample** | Sample taken from the running bulk | Confirms bulk quality matches the approved sample |

## Sample workflow sequence

For PP Sample and Size Set Sample, the system validates the sequence:
1. FIT Sample must be approved first.
2. Then PP Sample can be created.
3. Then Size Set Sample can be created.

Admins can override this sequence with a reason if needed. The other types (Original, Look,
Shipment, Photoshoot, Production) have no prerequisite and can be created at any time.

## Traps

- **Customer is required** — You cannot create a sample without selecting a customer.
- **Draft styles do not appear in the Style list** — the picker offers only styles whose status is **Active**, and only those belonging to the customer you selected. A style saved with **Save as Draft** on the Style page stays hidden here until it is published to Active. Nothing on the form says so, so a style you just created and cannot find is almost always still a draft.
- **Style options needed for colorways/size sets** — If adding colorways (PP Sample) or size sets, the selected style must have color and size options defined.
- **Colorways and size sets are locked after creation** — These can only be set when creating the sample, not when editing.
- **Measurements can always be edited** — Unlike colorways/size sets, measurements can be added, updated, or deleted at any time.
- **Required date is mandatory** — Always set a realistic deadline.
- **Sequential validation** — PP and Size Set samples require prior sample stages to be approved (admin can override).

## After saving

- A unique **Sample Number** is auto-generated (e.g., SMP-2026-0001).
- Sample status starts as **Requested**.
- The sample appears in the Sample Tracking list with SLA tracking.
- You can track the sample through statuses: Requested → In Progress → Submitted → Sent → Feedback Pending → Approved/Rejected.
- Overdue samples are highlighted with a red warning icon.
- Use the **⋯** menu at the end of the sample's row to move it through those statuses without opening the detail page. Each step asks you to confirm or opens a dialog first.
