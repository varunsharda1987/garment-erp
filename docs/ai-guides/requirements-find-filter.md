---
slug: requirements-find-filter
title: Find requirements — views, filters and pages on the Requirements page
keywords:
  # English
  - find requirement
  - requirements filter
  - filter by order
  - requirements of one order
  - requirements for a buyer
  - filter by style
  - buyer style code
  - filter by buyer style code
  - filter by vendor
  - filter by material type
  - needs action
  - on order
  - received requirements
  - where did my requirement go
  - requirement missing
  - requirement not showing
  - show all requirements
  - cancelled requirements
  - requirements page next page
  - rows per page
  - sets per page
  - list view
  - flat view
  - order and style view
  - clear filters
  - ticks lost
  - selection lost
  - requirment
  - requirments
  # Hinglish
  - requirement dhundhna
  - order ki requirement
  - buyer ki requirement
  - requirement nahi dikh rahi
  - requirement gayab
  - saari requirement dikhao
  - filter kaise lagaye
  - agla page
  - filter hatana
  - buyer ka style code
  # Devanagari (MANDATORY)
  - रिक्वायरमेंट ढूंढना
  - रिक्वायरमेंट नहीं दिख रही
  - ऑर्डर की रिक्वायरमेंट
  - फ़िल्टर
  - फिल्टर
  - अगला पेज
  - सारी रिक्वायरमेंट
  - वेंडर
  - बायर
  - बायर स्टाइल कोड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/components/requirements/OrderStyleLabelView.tsx
  - frontend/src/components/requirements/requirement-list-options.ts
  - frontend/src/types/mrp.types.ts
  - frontend/src/types/material.types.ts
  - frontend/src/pages/OrderDetail.tsx
  - frontend/src/pages/OrderList.tsx
  - backend/src/schemas/mrp.schema.ts
  - backend/src/services/mrp.service.ts
  - frontend/src/components/filters/FilterBar.tsx
  - frontend/src/components/SupplierCombobox.tsx
route: /procurement/requirements
---

## What the page shows first
**Procurement → Requirements**, **Material Requirements** tab, opens on:
- **Show: Order & Style** — one card per order + style, soonest-needed first. Each card names the style by its Buyer Style Code, with our Style Code in brackets when it is different, then the style name. A label bought in sizes is one heading row with its sizes underneath.
- Status **Needs action** — only requirements someone still has to act on: Pending, Size Split Pending, PO Required, Partially from Stock and Needs Decision.

Requirements that are already on a PO, received or cancelled are hidden until you choose them in the status box.

## Steps to find a requirement
1. Open **Procurement → Requirements** in the sidebar and stay on the **Material Requirements** tab.
2. Narrow the list with the filters in the top box (use any together):
   - **Search** — requirement number, material code or name, order number, Buyer Style Code / Style Code / style name, the buyer's name, the vendor's name or code, or the number of the PO raised for it.
   - **Status** — the quick choices **Needs action**, **On order** (PO Generated, PO Sent, Partially Received), **Received / from stock**, **Cancelled**, **All (not cancelled)**; or one status under **Exact status** (for example **Needs Decision**).
   - **All orders** — type the order number or the buyer's name; it lists only orders that have requirements.
   - **All styles** — lists only styles that have requirements, each as Buyer Style Code (our Style Code in brackets when different) — style name. Type the Buyer Style Code, our Style Code or the name.
   - **All vendors** — the preferred vendor on the requirement; a searchable picker, type the vendor's name.
   - **All materials** — the material type (Label, Button, Greige…), or **Accessories (labels + packaging)** for both together.
3. Choose how to see it in the **Show:** row:
   - **Order & Style** — cards per order + style (use this to order a style's labels as a set).
   - **Material** — one group per material across orders.
   - **Vendor** — one group per preferred vendor.
   - **List** — one row per requirement, newest first.
4. Turn pages with the buttons at the bottom. **Order & Style**, **Material** and **Vendor** page whole groups (**Sets per page** / **Materials per page** / **Vendors per page**: 10, 25 or 50) — a set is never split across two pages. **List** pages rows (**Rows per page**: 20, 50 or 100).
5. To start again, click **Clear N filters** at the end of the filter row. It goes back to page 1 and keeps the view and tab you chose.

## Traps
- **"Nothing needs action right now."** Everything left is on order, received or cancelled — choose another **Status**.
- **"No requirements match these filters."** Click **Clear filters**, or remove one filter at a time.
- **Ticks stay when you turn the page** (the count reads "N selected"), but **changing any filter or the view unticks everything** so nothing hidden is ordered by mistake. **Clear selection** unticks on purpose.
- **A link from an order** opens the page already filtered to that order — **Open Requirements** (or a **Requirements** link under **What's stopping it**) on the order page, or the **Requirements** button on the order's row in **Orders & Sales → Orders**. **All orders** then shows the order number; pick **All orders** to widen it. The order page's **Processing (dyeing / printing)** **Open** button lands on the **Outsourced Work** tab, filtered the same way.
- **Grouped views load up to 500 requirements.** If the count line says "only the first … are grouped", narrow with a filter.
- **Job work (processing) and services are on the Outsourced Work tab**, not here.
