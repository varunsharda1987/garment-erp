---
slug: pattern-part-create
title: Add a Pattern Part
keywords:
  # English
  - pattern part
  - garment part
  - cutting part
  - add pattern part
  - create pattern part
  - sleeve
  - collar
  - pocket
  - component groups
  # Hinglish
  - pattern part add karna
  - pattern part banana
  - part add karna
  - cutting part banana
  # Devanagari
  - पैटर्न पार्ट
  - कटिंग पार्ट
  - पैटर्न पार्ट जोड़ना
  - गारमेंट पार्ट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/PatternPartMaster.tsx
route: /pattern-parts
---

## Menu Path

Materials & Masters > All Masters > Configuration > Pattern Parts

Or press **Ctrl+K** and search for "Pattern Parts".

## Steps

1. Open the **Pattern Parts** page
2. Click the **Add Pattern Part** button (top-right)
3. Fill in the required fields:
   - **Code** (required): Unique identifier like SLEEVE, COLLAR, POCKET (auto-uppercased)
   - **Name** (required): Display name like "Sleeve", "Collar", "Pocket"
4. Optionally fill:
   - **Component Groups**: Click badges to select which garment types this part applies to (e.g., Shirt, Dress, Kurta)
   - **Description**: Brief description of the pattern part
   - **Sort Order**: Number for display ordering (default 0)
   - **Active**: Checkbox to enable/disable the pattern part
5. Click **Create** to save

## Traps

- **Code must be unique**: The system will reject duplicate codes
- **Code auto-uppercases**: Typing "sleeve" becomes "SLEEVE" automatically
- **Component Groups are optional**: A pattern part can exist without being linked to any component group
- **Editing**: Click the pencil icon on any row to edit an existing pattern part
- **Deleting**: Click the trash icon to delete - this cannot be undone if the part is not in use
