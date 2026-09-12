---
slug: debit-note-create
title: Create a Debit Note
keywords:
  # English
  - debit note
  - purchase return
  - supplier return
  - DN
  - vendor debit
  - rate difference
  - quality issue
  - damaged goods
  - quantity short
  # Hinglish
  - debit note kaise banaye
  - supplier ko debit
  - return ka debit note
  - supplier se paisa wapas
  - rate difference ka debit
  # Devanagari
  - डेबिट नोट
  - परचेज रिटर्न
  - सप्लायर रिटर्न
  - वेंडर डेबिट
  - रेट डिफरेंस
  - क्वालिटी इश्यू
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DebitNoteList.tsx
route: /debit-notes
---

## Before you start

- A debit note is issued TO a supplier when you need to reduce the amount owed to them
- Common reasons: purchase returns, rate differences, quality issues, quantity shortages, damaged goods
- You should know which supplier the debit note is for
- Optionally, you can link it to the original Purchase Order or Job Work Order

## Steps

1. Press **Ctrl+K** and search for **Debit Notes**, or go to **Reports & Finance → Tax & GST** and click **Debit Notes**.

2. Click the **Create Debit Note** button in the top-right corner.

3. In the **Create Debit Note** dialog:

   **Select the Supplier (required)**
   - In the **Supplier** field, type at least 2 characters to search
   - Select the supplier from the dropdown that appears
   - To change the supplier after selection, click **Change**

4. **Link to Purchase Order (optional)**
   - After selecting a supplier, this dropdown appears
   - Select the original PO if this debit note relates to a specific purchase
   - Shows PO number and amount for reference
   - Select **-- No PO --** if not linked to any PO

5. **Link to Job Work Order (optional)**
   - Select if this debit note relates to job work (e.g., abnormal loss recovery)
   - Shows JWO number and process type
   - Select **-- No Job Work Order --** if not applicable

6. **Select the Reason (required)**
   - **Purchase Return** - returning goods to supplier
   - **Rate Difference** - supplier charged more than agreed
   - **Quality Issue** - goods did not meet quality standards
   - **Quantity Short** - received less than invoiced
   - **Damaged Goods** - goods arrived damaged
   - **Other** - any other reason

7. **Add Line Items (required)**
   - Enter at least one line item with:
     - **Description** - what the debit is for
     - **HSN** - HSN/SAC code (optional)
     - **Qty** - quantity
     - **Unit Price** - price per unit
   - The **Total** calculates automatically (Qty x Unit Price)
   - Click **Add Row** to add more items
   - Click the trash icon to remove a row (cannot remove the last row)
   - The **Subtotal** shows at the bottom of the items table

8. **Add Remarks (optional)**
   - Enter any additional notes or details about the debit note

9. Click **Create Debit Note** to save.

## Traps

- You cannot create a debit note without selecting a supplier first
- At least one line item with a valid description, quantity greater than 0, and unit price greater than 0 is required
- The debit note is created in **Draft** status - it needs to be approved before it affects supplier balances
- Linking to a PO or JWO is optional but helps with tracking and reconciliation

## After saving

- The debit note appears in the list with status **Draft**
- From the list, you can:
  - Click **Approve** to finalize the debit note
  - Click **Cancel** to cancel the debit note
  - Click the trash icon to delete a draft debit note
- Once **Approved**, the debit note adjusts the supplier's balance (reduces what you owe them)
- Cancelled or deleted debit notes do not affect supplier balances
- Approved debit notes cannot be edited, cancelled, or deleted
