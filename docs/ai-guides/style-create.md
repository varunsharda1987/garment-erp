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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/StyleList.tsx
  - frontend/src/pages/StyleFormRedesigned.tsx
  - frontend/src/constants/fabric-finish-types.ts
  - backend/src/schemas/style.schema.ts
  - backend/src/routes/style.routes.ts
---

## Before you start

The customer must already exist in the Customers master, and the customer needs a brand with brand categories set up. The style code is built from those, so you cannot type it yourself.

## Steps

1. Open **Styles** in the sidebar. This is a top-level item, not inside a group.
2. On the **Style Master** page, click **+ Create New Style**.
3. The page opens as **Create New Style** with four tabs: **1. Basic Info**, **2. Fabrics**, **3. Trims & Materials**, **4. Accessories**.
4. In **Basic Information**, pick **Customer/Buyer** first. It is required and it unlocks the brand list.
5. Pick **Brand**, then **Brand Category**. **Product Category** usually fills itself to match the brand category — pick one if it stays empty.
6. Fill **Buyer Style Code**. It is required. Leaving it blank makes the save fail — even for a draft.
7. **Style Code** sits in the row below and stays read-only. It fills itself once Brand Category and Product Category are both set. For the customer **House Of Kasya**, the Buyer Style Code is used as the Style Code automatically.
8. **Style Name** and **Season** are optional.
9. Set **Number of Components**. If the product category sets a minimum or maximum, staying outside that range shows a red warning.
10. Under **Component Selection**, choose a component for each box (**Component 1**, **Component 2**, and so on).
11. Scroll to **Size Variants & SKUs**. Untick sizes you do not need. Click **Auto-Generate SKUs** to fill SKU codes.
12. Go to **2. Fabrics**. Each component shows as a collapsible bar. Click **Add Fabric** (or **Add First Fabric**) on the component.
13. For each fabric row, pick **Source**: **Greige / Process** (then fill the greige name) or **Ready Fabric** (then pick an existing fabric master).
14. Choose **Fabric Finish Type**: Solid/Dyed, Printed, Yarn Dyed, or Raw/Unfinished.
15. Tick **Has Embroidery** and click **Select Design** if the fabric is embroidered.
16. Go to **3. Trims & Materials** and select trims. Use **Add New** to create a missing master without leaving the page.
17. Go to **4. Accessories** and select labels, polybags, hangtags and cartons.
18. Click **Create Style**.

## Traps

- **Buyer Style Code** is compulsory on the server. An empty value is rejected, including on the very first **Save as Draft**.
- Every non-draft save needs at least one fabric that has either a greige name or a ready fabric selected.
- **Printed** and **Yarn Dyed** fabrics must have a **Design Name**. **Solid/Dyed** fabrics must have a **Color**.
- Not ready yet? Click **Save as Draft**. A draft only needs the style code and the Buyer Style Code, so it saves even with no customer and no fabrics.
- A draft stays a draft until you reopen it and click **Publish Style**. Only published styles can be used for orders.
- Drafts appear under the **Drafts** tab on the Style Master page, not under **Active Styles**.
- Switching tabs auto-saves in the background once a style code exists.
- CAD planning is not part of this form. Do it after the style is created.
