---
slug: trf-create
title: Raise and Print a Test Requirement Form (TRF)
keywords:
  # English
  - trf
  - test requirement form
  - testing form
  - lab form
  - intertek
  - intertek form
  - easybuy testing
  - send sample to lab
  - garment testing form
  - print test form
  - buyer test form
  - pp sample testing
  - wash care code
  - washcare code
  - care code
  - RN code
  - vendor code
  # Hinglish
  - trf banana
  - test form banana
  - lab form kaise bhare
  - sample lab bhejna
  - intertek form bharna
  - testing form print karna
  - easybuy test form
  - trf print kaise kare
  # Devanagari
  - टेस्ट फॉर्म
  - लैब फॉर्म
  - परीक्षण फॉर्म
  - सैंपल लैब भेजना
  - टेस्ट रिक्वायरमेंट फॉर्म
  - फॉर्म प्रिंट करना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/BuyerTrfList.tsx
  - frontend/src/pages/BuyerTrfForm.tsx
  - frontend/src/pages/TestingDashboard.tsx
  - frontend/src/components/fabric/WashCareCodes.tsx
  - backend/src/schemas/buyerTrf.schema.ts
  - backend/src/constants/buyer-trf.constants.ts
route: /test-requirement-forms
---

## Steps

1. Open **Pre-Production > Test Requirement Forms** in the sidebar. (You can also reach it from
   the **Test Requirement Forms** card on the Testing dashboard.)
2. Click **New TRF**.
3. Under **Style & order**, pick the **Style**, then the **Sale order**. Search the sale order
   box by the buyer's PO number — it is shown next to each order.
4. Wait a moment. Most of the form fills itself: sample description, end use, colour, fibre
   content, count, construction, order number, vendor code, processing house and your contact
   details.
5. If an amber note appears saying **Some fields could not be filled in**, read the list. Type
   what you know. Anything you leave blank prints as a shaded box for someone to complete by
   hand — it is not left silently empty.
6. In **Sample identity**, check the pre-filled values and correct anything wrong. Two that
   usually need attention:
   - **Fiber Content** — the buyer may want the trade name. Change "100% Viscose" to
     "100% RAYON" if that is what they expect.
   - **Season** — type the buyer's own season code, for example `S10-26`.
7. In **Package, stage, finish & service**, confirm the ticks. For Easybuy these start as
   Woven Garment Package, PP, Garment Wash and Express. Change them if this sample differs.
8. In **Buying department**, pick the department. The sub-options below change to match it —
   that is why "Denim" appears under both Men's Wear and Women's Wear.
9. In **Individual tests**, leave everything unticked when the package covers the testing.
   Tick only the extra tests you are asking for on top.
10. In **Declarations**, set each Yes/No. Leaving both boxes clear is allowed and prints an
    empty pair for a hand tick — that is different from ticking **No**.
11. Add **Remarks** if needed, for example "PP sample, 2 pcs".
12. Click **Save**. The form gets a number like `TRF-0001`.
13. Click **Print**. A two-page PDF opens: the filled form, then Intertek's Terms and
    Conditions. Print it and send it with the sample.

## Reprinting an old form

Open **Test Requirement Forms**, find the row, and click **Print** on it. Search by TRF number,
style, buyer order number or colour. A reprint shows exactly what was sent, even if the style
has changed since.

## If a field keeps coming up blank

- **Wash Care Code** — set it per buyer on the fabric. Open the greige (**Materials & Masters >
  Greige**), scroll to **Wash care codes**, pick the buyer and type the code. The same fabric can
  carry a different code for each buyer, which is why there is a row per buyer rather than one
  box. You can also just type the code on the TRF and save — it is remembered against that buyer
  and fabric, so the next form fills it in.
- **Vendor Code** — set it on the buyer: open the customer and fill **Our Vendor Code with
  them**.
- **Easy Buy Merchandise name and email** — add the buyer's merchandiser on the customer's
  Contacts tab.
- **Colour** — comes from the sale order line, or from the style's colour if the order has none.

## Notes

- A TRF must be linked to a sale order (or a work order). The buyer's PO number on that order
  becomes the printed **Order Number**.
- The printed sheet carries Easy Buy's and Intertek's branding, not ours — Kashaya Fabs appears
  as the applicant and manufacturer, which is what the lab expects.
