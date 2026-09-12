---
slug: quotation-create
title: Create a Quotation
keywords:
  # English
  - quotation
  - quote
  - price quote
  - estimate
  - proposal
  - proforma
  - customer quotation
  - new quotation
  # Hinglish
  - quotation kaise banaye
  - quote dena
  - rate dena
  - bhav dena
  - customer ko quotation
  - naya quotation
  # Devanagari
  - कोटेशन
  - भाव
  - रेट
  - प्राइस क्वोट
  - कोटेशन कैसे बनाये
  - नया कोटेशन
  - कस्टमर कोटेशन
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/QuotationForm.tsx
  - frontend/src/pages/QuotationList.tsx
route: /quotations/new
---

## Before you start

- At least one **Style** must exist in the system (with status ACTIVE)
- The **Customer** must already be created in Materials & Masters

## Steps

1. Open **Orders & Sales → Quotations** in the sidebar.
2. Click **New Quotation** button (top right).
3. Fill in the **Quotation Details** section:
   - **Customer** * — Select the customer from the dropdown (required)
   - **Quotation Date** — Defaults to today; change if needed
   - **Valid Until** * — Set the expiry date for this quotation (required)
   - **Remarks** — Optional notes about the quotation
   - **Terms and Conditions** — Payment terms, delivery conditions, etc.
4. Add items in the **Quotation Items** section:
   - **Style** * — Select the style being quoted (required)
   - **Quantity** * — Enter number of pieces (must be greater than 0)
   - **Unit Price** * — Enter the price per piece in Rupees (required)
   - **Delivery Days** — Expected delivery timeline (defaults to 30 days)
   - **Description** — Item specifications or notes
5. Click **Add Item** to include additional styles in the quotation.
6. Review the **Quotation Total** at the bottom (GST is auto-calculated on save).
7. Click **Create Quotation** to save.

## Alternative entry: From an approved Cost Sheet

When you have an approved Cost Sheet, you can create a quotation directly:
- The Cost Sheet detail page has a **Create Quotation** button
- This pre-fills the style in the first quotation item

## Traps

- **Valid Until is required** — The quotation will not save without an expiry date
- **Each item needs Style, Quantity, and Unit Price** — All three are mandatory
- **Quantity must be greater than 0** — Zero quantity is not allowed
- **Customer cannot be changed after creation** — Select carefully; editing the quotation will not allow changing the customer
- **Only DRAFT quotations can be deleted** — Once sent or accepted, the quotation cannot be deleted

## After saving

- The quotation is created with status **Draft**
- A unique Quotation Number is auto-generated
- GST is auto-calculated based on customer's state and HSN codes
- You can:
  - **View** the quotation details
  - **Edit** the quotation (if still in Draft)
  - Mark as **Sent** when shared with customer
  - Record **Accepted** or **Rejected** based on customer response
  - Convert to a **Sale Order** when accepted
