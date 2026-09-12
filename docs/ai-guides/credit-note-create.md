---
slug: credit-note-create
title: Create a Credit Note
keywords:
  # English
  - credit note
  - sales return
  - refund
  - CN
  - customer return
  - rate difference
  - quality issue
  - quantity difference
  - credit against invoice
  # Hinglish
  - credit note kaise banaye
  - return ka credit
  - CN banana
  - invoice ke against credit
  - customer ko credit dena
  - rate difference ka credit
  # Devanagari
  - क्रेडिट नोट
  - सेल्स रिटर्न
  - रिफंड
  - वापसी
  - ग्राहक रिटर्न
  - दर अंतर
  - गुणवत्ता समस्या
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CreditNoteList.tsx
  - frontend/src/pages/CreditNoteDetail.tsx
  - frontend/src/types/creditNote.types.ts
route: /credit-notes
---

## Before you start

- You must have an existing **invoice** to issue a credit note against
- Credit notes adjust the customer's balance for returns, rate differences, or quality issues
- Credit notes follow a maker-checker pattern: created in Draft, then approved by admin

## Steps

1. Open **Reports & Finance > Tax & GST** in the sidebar.

2. Click **Credit Notes** in the Tax & GST hub (or press Ctrl+K and search "Credit Notes").

3. Click the **Create Credit Note** button in the top right.

4. In the Create Credit Note dialog:

   a. **Invoice** (required): Type the invoice number to search. Click an invoice from the dropdown to select it. The customer is auto-filled from the invoice.

   b. **Reason** (required): Select one of these reasons:
      - **Sales Return** - goods returned by customer
      - **Rate Difference** - price adjustment
      - **Quality Issue** - defective goods
      - **Quantity Difference** - quantity mismatch
      - **Other** - any other reason

   c. **Remarks** (optional): Add any notes explaining the credit note.

5. Review the **Line Items** table (pre-populated from the invoice):
   - Edit the **Description** if needed
   - Update the **HSN** code if different
   - Adjust the **Qty** to credit (reduce to partial quantity if not crediting full amount)
   - Modify the **Unit Price** if needed for rate adjustments
   - Click the trash icon to remove items you do not want to credit
   - The **Total** updates automatically as you make changes

6. Click **Create Credit Note** to save.

## Traps

- **Invoice required** - you cannot create a credit note without linking it to an existing invoice
- **Draft status** - newly created credit notes are in Draft status and do not affect the customer's balance until approved
- **Admin approval** - only administrators can approve credit notes (maker-checker control); the person who creates the note cannot approve it themselves
- **GST implications** - the system automatically calculates GST (CGST+SGST or IGST) based on the original invoice's interstate/intrastate classification
- **Cannot edit after approval** - once approved, a credit note cannot be modified; it can only be cancelled (if not yet pushed to Tally)

## After saving

- The credit note is created with status **Draft**
- A unique credit note number is assigned (e.g., CN-2026-0001)
- Click on the credit note row to open the detail page
- On the detail page:
  - **Approve** (admin only) - finalizes the credit note and credits the customer's account
  - **Cancel** - voids the credit note (cannot be undone)
  - **Delete** - permanently removes a draft credit note
  - **Push to Tally** (after approval) - syncs the credit note to your Tally accounting software

## Related actions

- To view a credit note: click its row in the list, or search by credit note number
- To filter by status: use the **All Statuses** dropdown (Draft, Approved, Cancelled)
- To search: type the credit note number or customer name in the search box
