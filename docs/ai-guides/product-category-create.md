---
slug: product-category-create
title: Add a Product Category
keywords:
  # English
  - product category
  - category master
  - garment category
  - product classification
  - western wear
  - ethnic wear
  - category hierarchy
  - add category
  - create category
  - sub-category
  # Hinglish
  - category banana
  - product category add karna
  - naya category
  - sub category banana
  # Devanagari (MANDATORY)
  - प्रोडक्ट कैटेगरी
  - कैटेगरी मास्टर
  - कैटेगरी बनाना
  - नई कैटेगरी
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ProductCategoryMaster.tsx
route: /product-categories
---

## Steps

### Open Product Categories
1. Press **Ctrl+K** and type "Product Categories"
2. Or go to **Materials & Masters > All Masters** and find Product Categories

### Add a Main Category
1. Click the **"Add Category"** button (top-right)
2. Fill in the form:
   - **Code** (required): Short code like `WW` for Western Wear, `EW` for Ethnic Wear (auto-converts to uppercase)
   - **Style Code Prefix** (optional): Used for auto-generating style codes, e.g., `KUR` for Kurti
   - **Sort Order**: Display order (lower numbers appear first)
   - **Name** (required): Full category name, e.g., "Western Wear"
   - **Parent Category**: Leave as "None (Main Category)" for top-level categories
   - **Description** (optional): Additional notes
   - **Min Components**: Minimum garment parts required (default: 1)
   - **Max Components**: Maximum garment parts allowed (must be >= Min)
3. Click **"Create"**

### Add a Sub-Category
1. Find the parent category in the tree view
2. Click the **+** button on that category row
3. Fill in the form (Parent Category is pre-selected)
4. Click **"Create"**

Note: Sub-categories can be nested up to 3 levels deep. The + button only appears on categories at level 1 or 2.

### Manage Default Components (Level 2+ only)
1. Click the **Layers icon** on a Level 2 or Level 3 category
2. Check the components that typically belong in this category
3. Mark components as "Required" if they must always be included
4. Click **"Save Defaults"**

These defaults auto-populate when creating styles in this category.

### Edit or Deactivate a Category
- **Edit**: Click the pencil icon on any category row
- **Toggle Active/Inactive**: Use the switch on the row
- **Delete**: Click the trash icon (only works if no styles use this category)

### Navigate the Tree
- **Expand/Collapse**: Click the arrow on any category with children
- **Expand All / Collapse All**: Use the buttons above the tree
- **Search**: Type in the search box to filter categories by name or code

## Traps

- **Code is permanent**: Cannot be changed after creation, so choose carefully
- **Max levels = 3**: Cannot create categories deeper than Level 3
- **Min > Max blocked**: System rejects if min components exceeds max components
- **Inactive categories hidden**: Deactivated categories won't appear in style creation dropdowns but are visible here
- **Delete blocked**: Cannot delete categories that have styles assigned to them
