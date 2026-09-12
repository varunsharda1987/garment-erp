---
slug: component-group-create
title: Add a Component Group
keywords:
  # English
  - component group
  - group master
  - trim group
  - garment component
  - add component group
  - create component group
  - component organization
  - top bottom outer
  # Hinglish
  - group banana
  - component group add karna
  - naya group banana
  - component group banao
  # Devanagari (MANDATORY)
  - कंपोनेंट ग्रुप
  - ग्रुप मास्टर
  - नया ग्रुप
  - कंपोनेंट ग्रुप बनाना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ComponentGroupMaster.tsx
route: /component-groups
---

## Steps

1. Press **Ctrl+K** and search for "Component Groups", or go to **Materials & Masters > All Masters** and click **Component Groups** under Configuration
2. Click **Add Component Group** button (top-right)
3. Fill the required fields:
   - **Code**: Unique identifier like TOP, BOTTOM, OUTER (auto-converts to uppercase)
   - **Name**: Display name like "Top Wear", "Bottom Wear"
4. Optionally fill:
   - **Description**: What this group is for
   - **Sort Order**: Lower numbers appear first in lists (default 0)
   - **Active Status**: Toggle off to hide from dropdowns (default active)
5. Click **Create**

## To Edit a Group

1. Find the group in the table
2. Click the pencil icon on that row
3. Update Name, Description, Sort Order, or Active Status (Code cannot be changed)
4. Click **Update**

## To Reorder Groups

1. Use the up/down arrow buttons in the Order column
2. Groups reorder immediately

## Traps

- **Code is permanent**: You cannot change the code after creation. Choose carefully (e.g., TOP, BOTTOM, OUTER, ACCESSORIES)
- **Code auto-uppercases**: Typing "top" becomes "TOP" automatically
- **Inactive groups hidden**: If you mark a group Inactive, it will not appear in component dropdowns elsewhere in the system
- **Lower sort = first**: A group with sort order 0 appears before sort order 1
- **Components count badge**: The table shows how many components use each group. You cannot delete a group that has components linked to it
