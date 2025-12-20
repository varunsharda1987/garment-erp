# Process Guide Maintenance Guide

## Overview

The Process Guide page is a self-updating interface that shows the complete workflow from style creation to dispatch. All content is driven by configuration files, making it easy to add new stages or update existing ones without modifying any component code.

**Key File**: `frontend/src/config/processStages.tsx`

## Adding New Process Stages

### Location
Edit: `frontend/src/config/processStages.tsx`

Find the `processStages` array (starts around line 52).

### Steps

1. **Import Required Icons** (top of file):
   ```typescript
   import { YourIcon } from 'lucide-react';
   ```

2. **Add New Stage Object** to the `processStages` array:
   ```typescript
   {
     id: 'new-stage-id',           // Unique identifier (kebab-case)
     order: 16,                     // Next sequential number (1-15 currently used)
     title: 'New Stage Name',       // Display name
     icon: <YourIcon className="h-5 w-5" />,
     category: 'production',        // 'pre-production', 'order-management', 'production', or 'fulfillment'
     description: 'Short one-line description shown in collapsed view',
     purpose: 'Detailed explanation of why this stage exists and what it accomplishes',

     // Prerequisites - what must be done before this stage
     prerequisites: [
       {
         stage: 'previous-stage-id',  // Optional: reference to another stage
         condition: 'What must be completed first',
         required: true,               // true = blocking, false = recommended
       },
     ],

     // Links to relevant pages in the app
     pages: [
       {
         title: 'Page Name',
         path: '/route/to/page',
         icon: <Icon className="h-4 w-4" />,
       },
     ],

     // Status transitions for this stage
     statusFlow: [
       { from: 'PENDING', to: 'IN_PROGRESS' },
       { from: 'IN_PROGRESS', to: 'COMPLETED' },
     ],

     // Database models involved
     databaseModels: ['model_name', 'related_model'],

     // Optional: Important fields to track
     keyFields: ['field1', 'field2', 'field3'],

     // Optional: Helpful tips for users
     tips: [
       'Helpful tip 1',
       'Helpful tip 2',
     ],

     // Optional: Critical blocking requirements
     gates: [
       'Must complete X before proceeding',
     ],
   }
   ```

3. **Save the file** - the page will automatically update with your new stage!

### Example: Adding a "Quality Inspection" Stage

```typescript
{
  id: 'quality-inspection',
  order: 16,
  title: 'Quality Inspection',
  icon: <ClipboardCheck className="h-5 w-5" />,
  category: 'production',
  description: 'Perform quality checks on finished garments',
  purpose: 'Ensure all garments meet quality standards before packing. Identify and segregate defective pieces.',
  prerequisites: [
    {
      stage: 'finishing',
      condition: 'Garments must be completely finished and tagged',
      required: true,
    },
  ],
  pages: [
    {
      title: 'Quality Inspection',
      path: '/quality/inspection',
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
  ],
  statusFlow: [
    { from: 'PENDING', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'PASSED' },
    { from: 'IN_PROGRESS', to: 'FAILED' },
  ],
  databaseModels: ['quality_inspections', 'defects'],
  keyFields: ['inspector_id', 'inspection_date', 'pass_quantity', 'fail_quantity'],
  tips: [
    'Inspect at least 10% of each lot',
    'Document all defects with photos',
    'Segregate failed pieces immediately',
  ],
  gates: [
    'Cannot proceed to packing until inspection is passed',
  ],
}
```

## Adding New Master Data Items

Master data items appear in the Quick Start Checklist at the top of the Process Guide.

### Location
Same file: `frontend/src/config/processStages.tsx`

Find the `masterDataItems` array (starts around line 947).

### Steps

1. **Import Required Icon** (if not already imported)

2. **Add New Item** to the `masterDataItems` array:
   ```typescript
   {
     id: 'new-master-id',          // Unique identifier
     title: 'New Master Data',      // Display name
     path: '/path/to/page',         // Route to the configuration page
     icon: <Icon className="h-4 w-4" />,
     phase: 'masters',              // 'foundation', 'business', 'masters', 'quality', or 'finance'
     description: 'Brief description of what this master data is for',
     priority: 17,                  // Next sequential number (1-16 currently used)
   }
   ```

### Example: Adding "Defect Categories"

```typescript
{
  id: 'defect-categories',
  title: 'Defect Categories',
  path: '/masters/defect-categories',
  icon: <AlertTriangle className="h-4 w-4" />,
  phase: 'quality',
  description: 'Configure types of defects found during quality inspection',
  priority: 17,
}
```

## Adding New Categories

If you need a completely new category beyond the existing four (Pre-Production, Order Management, Production, Fulfillment):

### Step 1: Update Type Definition

**File**: `frontend/src/types/processGuide.types.ts`

```typescript
export type ProcessCategory =
  | 'pre-production'
  | 'order-management'
  | 'production'
  | 'fulfillment'
  | 'new-category';        // Add your new category here
```

### Step 2: Add Category Configuration

**File**: `frontend/src/config/processStages.tsx`

Find the `processCategoryInfo` array (around line 33) and add:

```typescript
{
  id: 'new-category',
  title: 'New Category Name',
  description: 'Description of what this category covers',
  color: 'teal',                    // Color name for reference
  gradientFrom: 'from-teal-500',    // Tailwind gradient start
  gradientTo: 'to-cyan-600',        // Tailwind gradient end
}
```

### Step 3: Add Color Scheme to Stage Cards

**File**: `frontend/src/components/process-guide/ProcessStageCard.tsx`

Find the `categoryColors` object (around line 24) and add:

```typescript
'new-category': {
  bg: 'bg-gradient-to-r from-teal-500 to-cyan-600',
  badge: 'bg-teal-100 text-teal-700 border-teal-300',
  border: 'border-teal-200',
}
```

### Step 4: Add Stages with the New Category

Now you can add stages to `processStages` array with `category: 'new-category'`.

## How It Works

The Process Guide page is **completely configuration-driven**:

1. **Data Source**: All stages and master data items are defined in `processStages.tsx`
2. **Automatic Rendering**: Components read from the configuration and render automatically
3. **Search & Filter**: Works automatically based on the data you provide
4. **Grouping**: Stages are automatically grouped by category
5. **Ordering**: Stages appear in the order specified by the `order` field

### No Component Changes Needed

When you add a new stage or master data item, you **do NOT need to modify**:
- ProcessGuidePage.tsx
- ProcessStageCard.tsx
- QuickStartChecklist.tsx
- Any other component files

Simply add your data to the configuration file, and the UI updates automatically!

## Testing Your Changes

After editing the configuration file:

1. **Save the file** - Vite's hot module replacement will reload the page
2. **Check the browser** - verify your new stage/item appears
3. **Test search** - ensure your stage appears in search results
4. **Test filter** - ensure category filtering works correctly
5. **Test links** - click on any page links you added to verify they work
6. **Check console** - look for any TypeScript errors

## Visual Design Guidelines

### Category Colors

Each category has its own color scheme for visual distinction:

- **Pre-Production**: Blue to Indigo gradient
- **Order Management**: Green to Emerald gradient
- **Production**: Orange to Amber gradient
- **Fulfillment**: Purple to Violet gradient

When creating stages, use the appropriate category to maintain visual consistency.

### Writing Descriptions

- **Description**: Keep it short (one line) - appears in collapsed view
- **Purpose**: Be detailed - explain the "why" not just the "what"
- **Prerequisites**: Be specific about what's required vs recommended
- **Tips**: Provide actionable advice that helps users complete the stage successfully

### Stage Ordering

Maintain sequential order numbers (1, 2, 3...) to keep the workflow logical. The `order` field determines the display sequence, so you can insert new stages between existing ones by using decimal numbers if needed (e.g., 5.5 would appear between 5 and 6).

## Common Questions

### Q: How do I reorder stages?
A: Change the `order` field values in the configuration. The page automatically sorts by this field.

### Q: Can I have multiple stages with the same order number?
A: Technically yes, but avoid it - it makes the sequence unclear. Use unique sequential numbers.

### Q: What if I want to temporarily hide a stage?
A: Comment out the stage object in the array, or add a `hidden: true` property (you'll need to add filtering logic for this).

### Q: Can I link to external pages?
A: Yes, use full URLs in the `path` field. The Link component will handle it appropriately.

### Q: How do I add icons?
A: Import from lucide-react. Browse available icons at https://lucide.dev/

## Troubleshooting

### Stage not appearing
- Check that the object is properly added to the `processStages` array
- Verify there are no syntax errors (missing commas, brackets, etc.)
- Check browser console for TypeScript errors

### Category filter not working
- Ensure the `category` field matches one of the defined ProcessCategory types
- Check that the category is spelled correctly (use kebab-case)

### Links not working
- Verify the route exists in App.tsx
- Check that the path starts with `/`
- Ensure the route is not behind authentication if needed

## Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Review the existing stages in `processStages.tsx` as examples
3. Ensure all required fields are provided
4. Verify TypeScript types match the interface definitions

For questions about the structure or design decisions, refer to the comprehensive comments in the configuration file.
