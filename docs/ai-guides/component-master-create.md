---
slug: component-master-create
title: Add a Component Master
keywords:
  # English
  - component master
  - component
  - garment component
  - add component
  - create component
  - blouse
  - top
  - pajama
  - skirt
  - pattern parts
  # Hinglish
  - component add karna
  - component banana
  - naya component
  - component master banao
  # Devanagari
  - कंपोनेंट मास्टर
  - कंपोनेंट
  - कंपोनेंट जोड़ना
  - नया कंपोनेंट
  - ब्लाउज
  - टॉप
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ComponentMasters.tsx
route: /component-masters
---

## Steps

### Open the Component Masters page
1. Press **Ctrl+K** to open the command palette
2. Search for **"Component Masters"** and select it
   - Or navigate to **All Masters** > scroll to **Configuration** section > **Component Masters**

### Add a new component
1. Click the **Add Component** button (top right)
2. Fill in the form:
   - **Name** (required): Enter the component name, e.g., "Blouse", "Top", "Pajama", "Skirt"
   - **Component Group** (required): Select from dropdown - this determines which pattern parts (Front, Back, Sleeve, etc.) are available for CAD planning
   - **Description** (optional): Brief description of the component
   - **Sort Order** (optional): Number for display ordering (default: 0)
   - **Active** checkbox: Keep checked for active components
3. Click **Create** to save

### Edit an existing component
1. Find the component in the table (use search if needed)
2. Click the **pencil icon** in the Actions column
3. Modify the details and click **Update**

### Manage pattern parts for a component
1. Click the **puzzle icon** in the Actions column
2. Add/remove pattern parts that will appear in CAD Part dropdowns for this component

### Delete a component
1. Click the **trash icon** in the Actions column
2. Confirm deletion in the dialog

## Traps

- **Component Group is mandatory** - You must select a component group before saving. The group determines which pattern parts are available when doing CAD planning for styles using this component.

- **Pattern Parts are linked** - After creating a component, use the puzzle icon to configure which pattern parts (Front Panel, Back Panel, Sleeve, etc.) apply to this component type.

- **Deleting removes CAD options** - Deleting a component master may affect styles and CAD entries that reference it.
