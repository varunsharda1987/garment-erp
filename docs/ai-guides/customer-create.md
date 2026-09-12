---
slug: customer-create
title: Add a New Customer (Buyer)
keywords:
  - customer
  - buyer
  - add customer
  - naya customer kaise banaye
  - customer create
  - grahak
  - ग्राहक
  - कस्टमर
  - खरीदार
  - बायर
  - नया ग्राहक जोड़ें
  - brand category
  - GST
  - customar
  - sample requirements
  - sample required
  - fit sample required
  - pp sample
  - size set sample
  - shipment sample
  - blocks production
  - blocks dispatch
  - customer sample settings
  - sample zaruri
  - customer ke liye kaunse sample chahiye
  - sample requirement kaise set kare
  - सैंपल
  - सैंपल जरूरी
  - सैंपल रिक्वायरमेंट
  - फिट सैंपल
  - पीपी सैंपल
  - साइज़ सेट सैंपल
  - ग्राहक के सैंपल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/CustomerList.tsx
  - frontend/src/pages/CustomerForm.tsx
  - frontend/src/components/CustomerSampleRequirements.tsx
  - frontend/src/components/GSTNumberInput.tsx
  - frontend/src/lib/validators.ts
  - backend/src/schemas/customer.schema.ts
  - backend/src/routes/customer.routes.ts
  - backend/src/services/customer.service.ts
  - backend/src/services/sample.service.ts
  - backend/src/services/productionBlockingValidation.service.ts
route: /customers/new
---

**Before you start:** Only Admin, Sales and Merchandiser users can add or edit customers. Other roles will not see the add button.

## Steps

1. Open **Materials & Masters → Customers** in the sidebar. The page is titled **Customer Management**.
2. Click **+ Add Customer** at the top right. The **Create New Customer** form opens.
3. **Customer Code** is filled automatically and is read-only. Do not try to type it. It changes when you change Business Type or Market.
4. Choose **Business Type** (B2B or B2C) and **Market** (Domestic or International). These two build the code.
5. Choose **Customer Category** — Domestic, Export, Wholesaler or Retailer. This is required.
6. If you pick **Wholesaler** or **Retailer**, extra fields appear: **Agency**, **Agent** and **Agent Commission (%)**. Pick the **Agency** first — the **Agent** list stays locked until an agency is chosen. Commission must be between 0 and 100.
7. Type the **Company Name**. It must be at least 2 characters.
8. **Billing Name** is optional. Leave it blank to use the company name. If you fill it, it must also be at least 2 characters.
9. Under **Brand Names & Brand Categories**, type **Brand Name 1**, then use the dropdowns **Select Main Category → Select Sub-Category → Select Type**. Add more with the **+** button, or **+ Add Another Brand**.
   - Trap: a brand is saved only if it has at least one category selected. A brand with no category is dropped silently.
   - **Style Code Prefix** appears after a category is picked. Use 2 to 5 letters only.
10. Under **GST Numbers (State-wise)**, click **+ Add GST Number**. Pick the **State**, type the **GST Number** (exactly 15 characters) and tick **Primary GST Registration** for the main one. A wrong GST format is rejected by the server.
11. Fill **Contact Person**, **Phone** (digits only, maximum 10) and **Email**, then **Billing Address** and **Shipping Address**.
12. Under **Credit Terms**, **Credit Limit (₹)** cannot be negative and **Credit Days** must be a whole number from 0 to 365.
13. Under **Testing Requirements (FPT/GPT)**, turn on **Fabric Physical Testing (FPT)** or **Garment Physical Testing (GPT)** if this buyer needs testing, then pick the template and **Default Testing Lab**.
14. Click **Create Customer**.

## Set which samples this buyer needs (edit mode only)

This tells the system which samples to create automatically for the buyer's orders, and which ones hold production or dispatch. It is not on the create form.

1. Save the customer first, then open it again with **Edit** from the list. The form is titled **Edit Customer**.
2. Scroll down past **Testing Requirements (FPT/GPT)** to the **Sample Requirements** card. It says "Configure which samples are required for" followed by the customer name.
3. Six rows are listed: **FIT Sample**, **PP Sample**, **Size Set Sample**, **Photo Sample**, **Production Sample** and **Shipment Sample**. Tick the checkbox next to each sample this buyer needs. Un-tick the ones it does not need.
4. When **FIT Sample**, **PP Sample** or **Size Set Sample** is ticked, a second checkbox **Blocks Production** appears on the right of that row. Tick it if production must wait for that sample's approval. For **Shipment Sample** the second box is **Blocks Dispatch**. **Photo Sample** and **Production Sample** have no second box.
5. Click **Save (N selected)** at the top right of the card — N is how many samples are ticked. The button stays greyed out until you change something. You will see "Sample requirements saved successfully".

Traps:

- The card only exists after the customer is saved. On **Create New Customer** it is not shown at all.
- A **Blocks Production** / **Blocks Dispatch** tick only counts while that sample's own checkbox is ticked. Un-ticking the sample removes the block too, even if the Blocks box was ticked earlier.
- If nothing has ever been saved on this card, the system treats **FIT Sample**, **PP Sample** and **Size Set Sample** as required and blocking, even though the card shows every row un-ticked. Save the card once to make the screen the truth.
- Every save writes all six rows, so un-ticking a sample really switches it off. Saving with nothing ticked means no samples are required and none are created automatically — the card then shows "No sample types selected. Samples won't be auto-created for this customer."
- Only Admin, Sales and Merchandiser users can save this card.

## Notes

- **Accessory Presets** and **Size Category Presets** say "Save customer first". Create the customer, then reopen it with **Edit** to add them. The **Sample Requirements** card also appears only after the customer is saved.
- If you see "Customer code already exists", go back to the list and open the form again to get a fresh code.
- To change a customer later, use **Edit** on its row. Only Admin can **Deactivate**, and it is blocked while orders, quotations or invoices are open.
