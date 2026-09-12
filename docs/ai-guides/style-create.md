---
slug: style-create
title: Create a New Style
keywords:
  - style
  - style master
  - new style
  - create style
  - style code
  - buyer reference
  - buyer style code
  - naya style kaise banaye
  - style banana
  - स्टाइल
  - नया स्टाइल
  - डिज़ाइन
  - कपड़ा
  - बायर
  - घटक
  - साइज
  - thread
  - default thread
  - dhaga
  - धागा
  - in-house brand
  - kasya style code
  - nihsamah style
  - buyer code hi style code
  - buyer code as style code
  - buyer style code becomes style code
  - buyer code se style code
  - in-house style code
  - style code already exists
  - style code change nahi hua
  - style code 2 to 50 characters
  - publish style
  - style publish kaise kare
  - draft style
  - style draft me hai
  - save as draft
  - stlye
  - styel
  - buyer refrence
  - publsh
  - स्टाइल कोड
  - बायर स्टाइल कोड
  - बायर कोड
  - बायर कोड ही स्टाइल कोड
  - स्टाइल कोड पहले से है
  - २ से ५० अक्षर
  - पब्लिश
  - ड्राफ्ट
  - निहसामाह
  - कस्या
  - इन-हाउस ब्रांड
  - फैब्रिक
  - ट्रिम्स
  - एक्सेसरीज़
  - साइज़
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/StyleList.tsx
  - frontend/src/pages/StyleFormRedesigned.tsx
  - frontend/src/components/GenericGreigeSelector.tsx
  - frontend/src/constants/fabric-finish-types.ts
  - backend/src/schemas/style.schema.ts
  - backend/src/routes/style.routes.ts
  - backend/src/services/style.service.ts
  - backend/src/services/helpers/default-thread.helper.ts
route: /styles/new
---

## Before you start

The customer must already exist in the Customers master, and the customer needs a brand with brand categories set up. For a normal buyer the style code is built from those, so you cannot type it yourself. In-house brands are the exception: for any customer whose name contains "Kasya" or "Nihsamah", the **Buyer Style Code you type becomes the real Style Code** when the style is first saved. Decide that code before the first save — it cannot be changed afterwards (see Traps).

## Steps

1. Open **Styles** in the sidebar. This is a top-level item, not inside a group.
2. On the **Style Master** page, click **+ Create New Style**.
3. The page opens as **Create New Style** with a **DRAFT** badge and four tabs: **1. Basic Info**, **2. Fabrics**, **3. Trims & Materials**, **4. Accessories**.
4. In **Basic Information**, pick **Customer/Buyer** first. It is required and it unlocks the **Brand** list.
5. Pick **Brand**, then **Brand Category**. **Product Category** usually fills itself to match the brand category. If that category has sub-types, the dropdown asks you to pick one, and a **Type** box appears when there is a third level. Picking a product category can also auto-fill the component count and the components.
6. Fill **Buyer Style Code**. It shows on documents, and it must be unique — a code already used on another active style is rejected. For an in-house brand (customer name containing "Kasya" or "Nihsamah") this box is also the Style Code: type the final code here, **2 to 50 characters**, before you save or click any **Next: ...** button.
7. **Style Code** sits in the row below and stays read-only. For a normal buyer it is labelled **Style Code (Auto-generated)** and fills itself once Brand Category and Product Category are both set (hint: **Generated from brand prefix + category prefix**). For an in-house brand it is labelled **Style Code (From Buyer Reference)** and mirrors what you type in Buyer Style Code; the hint under Buyer Style Code reads **Will be used as Style Code**. That mirrored code is what gets saved as the Style Code.
8. **Style Name**, **Primary Color** and **Season** are optional.
9. Set **Number of Components**. If the product category sets a minimum or maximum, staying outside that range shows a red warning.
10. Under **Component Selection**, choose a component for each box (**Component 1**, **Component 2**, and so on) using **Search component...**. The list only shows components allowed for the chosen product category.
11. Optional: expand **Additional Details (Optional)** for **HSN Code (6-8 digits)**, **Accounting Unit**, **Description**, **Bullet Points** and **Remarks**.
12. Scroll to **Size Variants & SKUs**. If the customer has size presets, **Size Category Preset (Optional)** appears above it and the default preset is applied automatically. Untick sizes you do not need. Click **Auto-Generate SKUs** to fill SKU codes (empty SKUs are also filled when you save).
13. Click **Next: Fabrics & Trims**. Under **Fabrics by Component**, each component shows as a collapsible bar. Click **Add Fabric** (or **Add First Fabric**) on the component.
14. For each fabric, pick **Source:** — **Greige / Process** (then fill **Generic Greige Name**) or **Ready Fabric** (then search the fabric master under **Ready Fabric**; **Create New Fabric** opens the fabric form in a new tab). Picking a ready fabric copies its finish type, design and colour into the row.
15. Choose **Fabric Finish Type**: **Solid/Dyed**, **Printed**, **Yarn Dyed** or **Raw/Unfinished**. **Printed** and **Yarn Dyed** show **Design Name** (required) and **Color (Optional)**; **Solid/Dyed** shows **Color** (required).
16. Tick **Has Embroidery** and click **Select Design** if the fabric is embroidered.
17. Click **Next: Trims & Materials**. Under **Trims & Materials**, select the trims. Use **Add New** to create a missing master without leaving the page. If you do not pick a thread, the system links the shared **Default Thread** (code THR-DEFAULT) into the BOM automatically when the style is saved — you will see it appear in the cost sheet.
18. Click **Next: Accessories**. If the customer has presets, **Customer Accessory Preset** shows the default preset already applied; switch it or click **Re-apply Preset**. Under **Garment Accessories**, select labels, polybags, hangtags and cartons.
19. Click **Create Style**.
20. The style is saved as a draft. To make it usable for orders, click **Publish Style** (top right, shown once the style has been saved) and confirm **Publish** — or open the **Drafts** tab on the Style Master page and click **Publish** on the row.

## Traps

- Every new style is saved as a **DRAFT**, whichever button you press. **Create Style** does not publish it; only **Publish Style** (in the form) or **Publish** (on the **Drafts** tab) makes it **ACTIVE**, and only ACTIVE styles can be used for orders. After Create Style on a brand-new style you land back on Style Master — look under **Drafts**, not **Active Styles**.
- Publishing is refused unless the style has a customer, a brand or brand category, and at least one fabric.
- For a normal buyer, the Style Code shown before saving is a preview; the server assigns the final code when the style is first saved, so check the code on the Style Master list if it matters. For in-house brands (Kasya / Nihsamah) there is no preview — the Buyer Style Code is sent as the Style Code on the first save, so what you see under **Style Code (From Buyer Reference)** is what gets saved.
- In-house brands: the Buyer Style Code must be **2 to 50 characters** at the first save. Outside that range the save is blocked and this message appears under the Buyer Style Code box (and as a toast): **Buyer Style Code becomes the Style Code for this customer — enter 2 to 50 characters.**
- In-house brands: if another active style already uses that code as its Style Code, the save is refused with **Style code already exists** — shown under the Buyer Style Code box and as a toast. Change the Buyer Style Code and save again.
- In-house brands: the Style Code is fixed by the **first** save — **Create Style**, **Save as Draft**, or the first **Next: ...** auto-save all count. Editing Buyer Style Code after that only changes the buyer reference; the Style Code stays as it was. Get the code right before the first save.
- **Buyer Style Code** must be unique across active styles. A duplicate is rejected with "Buyer reference ... already exists on style ...".
- Every non-draft save needs at least one fabric that has either a greige name or a ready fabric selected. **Printed** and **Yarn Dyed** fabrics must have a **Design Name**. **Solid/Dyed** fabrics must have a **Color**.
- Not ready yet? Click **Save as Draft**. A draft only needs the Style Code on screen, so it saves with no fabrics, trims or accessories. The Style Code fills only after Brand Category and Product Category are picked (or, for in-house brands, once the Buyer Style Code is typed — and it must still be 2 to 50 characters).
- Clicking a **Next: ...** button auto-saves in the background once a Style Code exists. On a new style this first background save already creates the draft record — the page address changes to the edit page and **Publish Style** appears. Clicking the tab headers directly does not auto-save.
- If **2. Fabrics** shows **No components defined**, click **Go to Basic Info** and pick the components first.
- Unsaved typing is also kept in the browser. Reopening the page offers **Restore Unsaved Changes?** with **Restore Changes** or **Discard**.
- CAD planning is not part of this form. Do it after the style is created.
