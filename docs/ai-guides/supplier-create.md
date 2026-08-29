---
slug: supplier-create
title: Add a New Supplier (Vendor)
keywords:
  - supplier
  - vendor
  - add supplier
  - naya supplier kaise banaye
  - party
  - processor
  - सप्लायर
  - विक्रेता
  - नया सप्लायर जोड़ें
  - पार्टी
  - जीएसटी
  - बैंक
  - supplier category
  - suplier
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/SupplierList.tsx
  - frontend/src/pages/SupplierForm.tsx
  - frontend/src/components/GSTNumberInput.tsx
  - frontend/src/types/supplier.types.ts
  - backend/src/schemas/supplier.schema.ts
  - backend/src/routes/supplier.routes.ts
  - backend/src/services/supplier.service.ts
---

## Steps

1. Open **Materials & Masters → Suppliers** in the sidebar.
2. Click **+ Add New Supplier** at the top right. The **Create New Supplier** form opens.
3. **Supplier Code** is filled automatically and is read-only. Do not try to type it.
4. Type the **Supplier Name**. It must be at least 2 characters. Trailing commas or dots are removed automatically when saved.
5. Tick one or more boxes under **Supplier Categories**. This is required — the form shows "At least one category is required" and refuses to save with the message "Please select at least one supplier category".
   - The choices are: Fabric Supplier, Greige Supplier, Trims Supplier, Thread Supplier, Packaging Supplier, Lace Supplier, Dyeing & Printing, Embroidery, Hand Work, Smocking, CMT Unit, Finishing Contractor, Stitching Contractor, Washing, Dori/Piping Contractor, Machine Parts Supplier, Other Services.
   - Tick every category the party actually does. Purchase Orders and Job Work Orders filter suppliers by this list, so a missing tick hides the supplier from that screen later.
6. Under **Contact Details**, fill **Contact Person**, **Phone Number** (10 digits), **Email Address** and **Office Address**.
7. Under **Billing Location**, pick the **State** first — the **City** dropdown stays locked until a state is chosen. **PIN Code** must be 6 digits and cannot start with 0.
8. Under **Shipping Location**, tick **Same as Billing** to copy the address. Trap: the copy only happens when billing State, City and PIN Code are all filled. Fill billing first, then tick the box.
9. Under **GST Registration Numbers**, click **Add GST Number** (or **Add First GST Number**). For each block pick the **State**, type the **GST Number** (exactly 15 characters) and tick **Primary GST Registration** for the main one. A wrong GST format is rejected by the server.
10. Under **Payment & Credit Terms**, fill **Payment Terms**, **Credit Limit**, **Credit Days** (whole number, 0 to 365) and **Supplier Rating** (0 to 5).
11. Under **Bank Account Details**, pick the **Bank Name** from the list, type the **IFSC Code** (11 characters, 4 letters then 0 then 6 characters) and the **Account Number** (9 to 18 digits only).
12. A **Category-Specific Details** section appears for each category you ticked. Fill what you know — these fields are optional.
13. Click **Create Supplier**.

## Notes

- If you see "Supplier code already exists", go back to the list and open the form again to get a fresh code.
- To change a supplier later, use **Edit** on its row. **Deactivate** is blocked while the supplier still has open purchase orders or pending GRNs — the dialog lists the blocking items.
