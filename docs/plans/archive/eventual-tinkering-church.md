# Journey of Label and Packaging: Master → Customer Presets → Style Form

## Overview

This document traces the complete data flow of Labels and Packaging items from master creation, through customer preset configuration, to final usage in the Style Form.

---

## Phase 1: Master Creation

### Label Master (`LabelForm.tsx`)

**Location:** [frontend/src/pages/LabelForm.tsx](frontend/src/pages/LabelForm.tsx)

**Key Features:**
- Auto-generated code: `LBL-XXXXXX`
- Auto-generated name from: `[buyerCode] labelType color Label material size`
- **Label Categories:**
  - `SEWN_IN` - Care/size labels sewn into garment (used in Trims)
  - `HANGTAG` - Removable retail tags (used in Accessories)
  - `PRICE_TAG` - Price display tags (used in Accessories)

**Label Types Available:**
- Washcare Label, Size Label, Main Cum Size Label, Brand Label
- Loop Tag, Traceability Label, Barcode Label
- Country of Origin, Composition Label, Hangtag, Price Tag, Custom/Other

**Multi-Supplier Support:**
- Add multiple suppliers per label
- Per-supplier pricing (pricePerPiece, pricePerHundred)
- Mark preferred supplier

**Database Tables:**
- `label_master` - Main label data
- `label_suppliers` - Junction table for multi-supplier relationships
- `materials` - Created automatically with `materialType: 'LABEL'`

---

### Packaging Master (`PackagingForm.tsx`)

**Location:** [frontend/src/pages/PackagingForm.tsx](frontend/src/pages/PackagingForm.tsx)

**Key Features:**
- Auto-generated code: `PKG-XXXXXX`
- Similar multi-supplier support as labels

**Packaging Types Available:**
- **Bags & Covers:** Poly Bag, Zip Lock Bag, Garment Cover, Dust Cover
- **Boxes & Cartons:** Carton Box, Gift Box, Shoe Box, Inner Box
- **Hangers:** Plastic/Wooden/Velvet/Clip/Wire Hanger
- **Tapes & Stickers:** Packing Tape, Barcode Sticker, Size Sticker
- **Other:** Tissue Paper, Silica Gel, Insert Card, Custom/Other

**Database Tables:**
- `packaging_master` - Main packaging data
- `packaging_suppliers` - Junction table for multi-supplier relationships
- `materials` - Created automatically with `materialType: 'PACKAGING'`

---

## Phase 2: Customer Presets

### Purpose
Allow each customer to have pre-configured sets of labels and packaging that can be quickly applied to styles.

### UI Component: `CustomerAccessoryPresets.tsx`

**Location:** [frontend/src/components/CustomerAccessoryPresets.tsx](frontend/src/components/CustomerAccessoryPresets.tsx)

**Where Used:** Customer Form (Tab for Accessories Presets)

**Features:**
1. Create multiple presets per customer (e.g., "Standard", "Premium", "Export")
2. Add Label and Packaging items to each preset using MaterialBOMPicker
3. Set one preset as **default** (auto-applies when creating styles for this customer)
4. Edit/delete presets
5. Each item tracks: materialType, materialId, itemName, quantity, unit, usageCategory

### Database Storage

**Table:** `customer_accessories_presets`

```
{
  id: uuid,
  customerId: uuid,
  presetName: "Standard",
  description: "Standard export packaging",
  accessoryItems: [  // JSON array
    {
      materialType: "LABEL",
      materialId: "uuid-xxx",
      itemName: "Main Label",
      quantity: 1,
      unit: "pcs",
      usageCategory: "PACKAGING"
    },
    {
      materialType: "PACKAGING",
      materialId: "uuid-yyy",
      itemName: "Polybag 12x18",
      quantity: 1,
      unit: "pcs",
      usageCategory: "PACKAGING"
    }
  ],
  isDefault: true,
  isActive: true
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/customers/:id/accessory-presets` | Get all presets |
| POST | `/customers/:id/accessory-presets` | Create preset |
| PUT | `/customers/:id/accessory-presets/:presetId` | Update preset |
| DELETE | `/customers/:id/accessory-presets/:presetId` | Delete preset |
| POST | `/customers/:id/accessory-presets/:presetId/set-default` | Set as default |

---

## Phase 3: Style Form Integration

### Component: `StyleFormRedesigned.tsx`

**Location:** [frontend/src/pages/StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx)

### Tab 4: Accessories

This is where Labels (HANGTAG/PRICE_TAG) and Packaging come together.

### Data Flow When Creating a Style:

```
1. User selects Customer in Tab 1 (Basic Info)
          ↓
2. loadAccessoryPresets(customerId) is triggered
          ↓
3. System fetches all presets from API
          ↓
4. If default preset exists AND not edit mode:
   → Auto-apply default preset items
          ↓
5. Items tracked in two sets:
   - presetItemIds: Items from customer preset (purple badge)
   - styleSpecificIds: Items manually added (blue badge)
          ↓
6. User navigates to Tab 4: Accessories
          ↓
7. UI shows:
   ├── Preset dropdown (switch presets)
   ├── "Re-apply Preset" button
   ├── Item count badges
   └── AccessorySelector component
          ↓
8. User can:
   ├── Keep preset items as-is
   ├── Add more items (style-specific)
   ├── Remove any item
   └── Switch to different preset
          ↓
9. On Save: All accessories stored in style_material_bom
```

### AccessorySelector Component

**Location:** [frontend/src/components/AccessorySelector.tsx](frontend/src/components/AccessorySelector.tsx)

**Features:**
- Two tabs: LABEL (Hangtags/Price Tags) and PACKAGING
- Search functionality
- Quick-add modal for creating new items inline
- Visual distinction between preset and style-specific items

### How Items Are Saved

When style is saved, accessories are stored in `style_material_bom`:

```typescript
{
  styleId: "uuid",
  materialType: "LABEL" | "PACKAGING",
  labelId: "uuid" | null,        // For LABEL type
  packagingId: "uuid" | null,    // For PACKAGING type
  usageCategory: "PACKAGING",     // Distinguishes from garment trims
  quantityPerGarment: 1,
  unit: "pcs"
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MASTER CREATION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LabelForm.tsx                    PackagingForm.tsx              │
│  ┌──────────────┐                 ┌──────────────┐              │
│  │ Create Label │                 │Create Package│              │
│  │ • Code: LBL- │                 │ • Code: PKG- │              │
│  │ • Category   │                 │ • Type       │              │
│  │ • Suppliers  │                 │ • Suppliers  │              │
│  └──────┬───────┘                 └──────┬───────┘              │
│         ↓                                ↓                       │
│  label_master                     packaging_master               │
│  label_suppliers                  packaging_suppliers            │
│  materials (LABEL)                materials (PACKAGING)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   CUSTOMER PRESETS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CustomerForm.tsx → CustomerAccessoryPresets.tsx                 │
│  ┌──────────────────────────────────────────────┐               │
│  │ Create Presets:                              │               │
│  │ • "Standard" (default)                       │               │
│  │ • "Premium"                                  │               │
│  │ • "Export"                                   │               │
│  │                                              │               │
│  │ Add items via MaterialBOMPicker:             │               │
│  │ • Labels (from label_master)                 │               │
│  │ • Packaging (from packaging_master)          │               │
│  └──────────────────────────────────────────────┘               │
│                        ↓                                         │
│  customer_accessories_presets (JSON accessoryItems)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      STYLE FORM                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  StyleFormRedesigned.tsx                                         │
│  ┌──────────────────────────────────────────────┐               │
│  │ Tab 1: Select Customer                       │               │
│  │         ↓                                    │               │
│  │ Auto-load default preset                     │               │
│  │         ↓                                    │               │
│  │ Tab 4: Accessories                           │               │
│  │ ┌────────────────────────────────────────┐   │               │
│  │ │ Preset Selector: [Standard ▼]          │   │               │
│  │ │ • 3 items from preset (purple)         │   │               │
│  │ │ • 1 style-specific item (blue)         │   │               │
│  │ │                                        │   │               │
│  │ │ AccessorySelector:                     │   │               │
│  │ │ ├── LABEL Tab (Hangtags, Price Tags)   │   │               │
│  │ │ └── PACKAGING Tab (Polybags, etc.)     │   │               │
│  │ └────────────────────────────────────────┘   │               │
│  └──────────────────────────────────────────────┘               │
│                        ↓                                         │
│  style_material_bom (with labelId / packagingId)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| Stage | File | Purpose |
|-------|------|---------|
| **Label Master** | [LabelForm.tsx](frontend/src/pages/LabelForm.tsx) | Create/edit labels |
| | [label.service.ts](frontend/src/services/label.service.ts) | API calls |
| | [label.controller.ts](backend/src/controllers/label.controller.ts) | Backend logic |
| **Packaging Master** | [PackagingForm.tsx](frontend/src/pages/PackagingForm.tsx) | Create/edit packaging |
| | [packaging.service.ts](frontend/src/services/packaging.service.ts) | API calls |
| | [packaging.controller.ts](backend/src/controllers/packaging.controller.ts) | Backend logic |
| **Customer Presets** | [CustomerAccessoryPresets.tsx](frontend/src/components/CustomerAccessoryPresets.tsx) | Preset management UI |
| | [customer.service.ts](frontend/src/services/customer.service.ts) | API calls |
| | [customer-accessories.controller.ts](backend/src/controllers/customer-accessories.controller.ts) | Backend logic |
| **Style Form** | [StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx) | Style creation with accessories |
| | [AccessorySelector.tsx](frontend/src/components/AccessorySelector.tsx) | Label/Packaging picker |
| **Database** | [schema.prisma](backend/prisma/schema.prisma) | All table definitions |

---

## Important Notes

1. **Label Categories Matter:**
   - `SEWN_IN` labels appear in **Trims** (TrimSelector)
   - `HANGTAG` and `PRICE_TAG` labels appear in **Accessories** (AccessorySelector)

2. **Default Preset Auto-Apply:**
   - Only applies when creating NEW styles
   - Does NOT auto-apply when editing existing styles

3. **Tracking Origins:**
   - System tracks which items came from preset vs. manually added
   - Visual badges help users understand item sources

4. **Material Entries:**
   - Both Label and Packaging create corresponding `materials` table entries
   - This enables inventory tracking and stock management

---

# Implementation Plan: Add Customer Linking to Labels & Packaging

## Problem Statement

Currently, labels like "Washcare" are generic. When different customers (H&M, Zara, Gap) each have their own washcare design with different prices, there's no way to differentiate them in the master or filter them in customer presets.

## Solution: Add `customerId` to Label and Packaging Masters

### Changes Required

---

## 1. Database Schema Changes

**File:** [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

### label_master (lines 3842-3874)
```prisma
model label_master {
  ...
  customerId      String?          // NEW: Link to customer
  customer        customers?       @relation(fields: [customerId], references: [id])
  ...
  @@index([customerId])            // NEW: Index for filtering
}
```

### packaging_master (lines 3876-3906)
```prisma
model packaging_master {
  ...
  customerId      String?          // NEW: Link to customer
  customer        customers?       @relation(fields: [customerId], references: [id])
  ...
  @@index([customerId])            // NEW: Index for filtering
}
```

### customers model - add reverse relations
```prisma
model customers {
  ...
  labels          label_master[]      // NEW
  packaging       packaging_master[]  // NEW
}
```

---

## 2. Backend Controller Updates

### label.controller.ts

**createLabel()** - Add customerId to creation:
```typescript
const { customerId, ...rest } = req.body;
// Add customerId to label_master.create data
```

**getAllLabel()** - Add customerId filter:
```typescript
const { customerId = '' } = req.query;
if (customerId) {
  where.customerId = String(customerId);
}
```

### packaging.controller.ts

Same changes as label.controller.ts:
- Accept `customerId` in create/update
- Add `customerId` filter in getAllPackaging

---

## 3. Frontend Form Updates

### LabelForm.tsx

Add customer dropdown:
```tsx
import { getAllCustomers } from '@/services/customer.service';

const [customers, setCustomers] = useState<Customer[]>([]);
const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

// Load customers on mount
useEffect(() => {
  const fetchCustomers = async () => {
    const response = await getAllCustomers({ limit: 100 });
    setCustomers(response.data);
  };
  fetchCustomers();
}, []);

// In form - add Customer dropdown before Label Category
<Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
  <SelectTrigger>
    <SelectValue placeholder="Select Customer (Optional)" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">No Customer (Generic)</SelectItem>
    {customers.map(c => (
      <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
    ))}
  </SelectContent>
</Select>

// In payload
const payload = { ...data, customerId: selectedCustomerId || null };
```

### PackagingForm.tsx

Same customer dropdown implementation as LabelForm.

---

## 4. Frontend Type Updates

### label.types.ts
```typescript
export interface Label {
  ...
  customerId?: string;
  customer?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface LabelFormData {
  ...
  customerId?: string;
}
```

### packaging.types.ts
```typescript
export interface Packaging {
  ...
  customerId?: string;
  customer?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PackagingFormData {
  ...
  customerId?: string;
}
```

---

## 5. Service Updates

### label.service.ts
```typescript
getAllLabels(params?: {
  ...
  customerId?: string;  // NEW
})
```

### packaging.service.ts
```typescript
getAllPackaging(params?: {
  ...
  customerId?: string;  // NEW
})
```

---

## 6. AccessorySelector Updates

**File:** [frontend/src/components/AccessorySelector.tsx](frontend/src/components/AccessorySelector.tsx)

Add customerId prop and filter:
```tsx
interface AccessorySelectorProps {
  ...
  customerId?: string;  // NEW: Filter accessories by customer
}

// In loadAllAccessories
const loadLabels = async () => {
  const params: any = { limit: 200, labelCategory: 'HANGTAG,PRICE_TAG' };
  if (customerId) {
    params.customerId = customerId;  // Filter by customer
  }
  const response = await getAllLabels(params);
  ...
};
```

---

## 7. StyleFormRedesigned Updates

**File:** [frontend/src/pages/StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx)

Pass customerId to AccessorySelector:
```tsx
<AccessorySelector
  selectedAccessories={selectedAccessories}
  onChange={handleAccessoriesChange}
  customerId={selectedCustomerId}  // NEW: Filter by customer
  presetItemIds={presetItemIds}
  styleSpecificIds={styleSpecificIds}
/>
```

---

## 8. CustomerAccessoryPresets Updates

**File:** [frontend/src/components/CustomerAccessoryPresets.tsx](frontend/src/components/CustomerAccessoryPresets.tsx)

When using MaterialBOMPicker, filter by customerId:
```tsx
// Only show materials belonging to this customer
<MaterialBOMPicker
  ...
  filters={{ customerId: customerId }}
/>
```

---

## Files to Modify (Summary)

| # | File | Change |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Add customerId to label_master, packaging_master |
| 2 | `backend/src/controllers/label.controller.ts` | Add customerId in create, filter in getAll |
| 3 | `backend/src/controllers/packaging.controller.ts` | Add customerId in create, filter in getAll |
| 4 | `frontend/src/types/label.types.ts` | Add customerId to types |
| 5 | `frontend/src/types/packaging.types.ts` | Add customerId to types |
| 6 | `frontend/src/services/label.service.ts` | Add customerId param |
| 7 | `frontend/src/services/packaging.service.ts` | Add customerId param |
| 8 | `frontend/src/pages/LabelForm.tsx` | Add customer dropdown |
| 9 | `frontend/src/pages/PackagingForm.tsx` | Add customer dropdown |
| 10 | `frontend/src/components/AccessorySelector.tsx` | Accept customerId, filter data |
| 11 | `frontend/src/pages/StyleFormRedesigned.tsx` | Pass customerId to AccessorySelector |

---

## Expected Result After Implementation

```
Label Master:
├── LBL-00001: "Washcare Label" - Customer: H&M, price: ₹0.45
├── LBL-00002: "Washcare Label" - Customer: Zara, price: ₹0.60
├── LBL-00003: "Washcare Label" - Customer: Gap, price: ₹0.55
├── LBL-00004: "Size Label" - Customer: H&M, price: ₹0.30
└── LBL-00005: "Generic Barcode" - Customer: None (generic)

When creating style for H&M:
→ AccessorySelector shows only H&M labels + generic labels
→ Customer preset only shows H&M-specific items
→ Clear differentiation between customers
```

---

# Implementation Plan: Add Fabric Content & Washcare Instructions Fields

## Problem Statement

Currently, the `label_master` table has only one generic `content` field. For washcare labels, there are actually two distinct pieces of information:
1. **Fabric Content** - The fabric composition (e.g., "100% Cotton", "60% Polyester 40% Cotton")
2. **Washcare Instructions** - The care instructions (e.g., "Machine wash cold, tumble dry low, do not bleach")

The current single `content` field is confusing because its placeholder says "Wash Care Instructions" but it's meant for general content.

## Solution: Add Two New Fields to Label

Replace the generic `content` field with two specific fields:
- `fabricContent` - For fabric composition
- `washcareInstructions` - For care instructions

**Note:** Keep the old `content` field for backward compatibility but show the new fields prominently in the UI.

---

## 1. Database Schema Changes

**File:** [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

### label_master (around line 3854)
```prisma
model label_master {
  ...
  content              String?  // Generic content (kept for backward compatibility)
  fabricContent        String?  // NEW: Fabric composition (e.g., "100% Cotton")
  washcareInstructions String?  // NEW: Care instructions (e.g., "Machine wash cold")
  ...
}
```

---

## 2. Backend Controller Updates

**File:** [backend/src/controllers/label.controller.ts](backend/src/controllers/label.controller.ts)

### createLabel() - Add new fields (around line 30)
```typescript
const {
  ...
  content,
  fabricContent,        // NEW
  washcareInstructions, // NEW
  ...
} = req.body;

// In label_master.create data:
content: content || null,
fabricContent: fabricContent || null,
washcareInstructions: washcareInstructions || null,
```

### updateLabel() - Add new fields
Same pattern as createLabel - accept and save the new fields.

---

## 3. Frontend Type Updates

**File:** [frontend/src/types/label.types.ts](frontend/src/types/label.types.ts)

### Label interface (around line 86)
```typescript
export interface Label {
  ...
  content?: string | null;
  fabricContent?: string | null;        // NEW
  washcareInstructions?: string | null; // NEW
  ...
}
```

### LabelFormData interface (around line 126)
```typescript
export interface LabelFormData {
  ...
  content?: string;
  fabricContent?: string;        // NEW
  washcareInstructions?: string; // NEW
  ...
}
```

### CreateLabelRequest interface (around line 149)
```typescript
export interface CreateLabelRequest {
  ...
  content?: string;
  fabricContent?: string;        // NEW
  washcareInstructions?: string; // NEW
  ...
}
```

### BulkImportRow interface (around line 215)
```typescript
export interface BulkImportRow {
  ...
  content?: string;
  fabricContent?: string;        // NEW
  washcareInstructions?: string; // NEW
  ...
}
```

---

## 4. Frontend Form Updates

**File:** [frontend/src/pages/LabelForm.tsx](frontend/src/pages/LabelForm.tsx)

### Replace the Content field (lines 360-368) with two new fields:

**Before:**
```tsx
{/* Content */}
<div>
  <Label htmlFor="content">Content</Label>
  <Input
    id="content"
    {...register('content')}
    placeholder="e.g., Wash Care Instructions"
  />
</div>
```

**After:**
```tsx
{/* Fabric Content */}
<div>
  <Label htmlFor="fabricContent">Fabric Content / Composition</Label>
  <Input
    id="fabricContent"
    {...register('fabricContent')}
    placeholder="e.g., 100% Cotton, 60% Polyester 40% Cotton"
  />
  <p className="text-xs text-gray-500 mt-1">
    The fabric composition to be printed on the label
  </p>
</div>

{/* Washcare Instructions */}
<div className="md:col-span-2">
  <Label htmlFor="washcareInstructions">Washcare Instructions</Label>
  <Textarea
    id="washcareInstructions"
    {...register('washcareInstructions')}
    rows={2}
    placeholder="e.g., Machine wash cold, tumble dry low, do not bleach, iron on low heat"
  />
  <p className="text-xs text-gray-500 mt-1">
    Care instructions for washing, drying, ironing, etc.
  </p>
</div>
```

### Update edit mode data loading (around line 98):
```typescript
setValue('fabricContent', label.fabricContent || '');
setValue('washcareInstructions', label.washcareInstructions || '');
```

---

## 5. Files to Modify (Summary)

| # | File | Change |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Add `fabricContent` and `washcareInstructions` to label_master |
| 2 | `backend/src/controllers/label.controller.ts` | Handle new fields in create/update |
| 3 | `frontend/src/types/label.types.ts` | Add new fields to all interfaces |
| 4 | `frontend/src/pages/LabelForm.tsx` | Replace Content input with two new fields |

---

## 6. Migration Steps

1. Add new columns to Prisma schema
2. Run `npx prisma db push` or create migration
3. Run `npx prisma generate` to update client
4. Update backend controller
5. Update frontend types
6. Update frontend form
7. Test create/edit functionality

---

## 7. Expected Result After Implementation

```
LabelForm.tsx UI:
┌─────────────────────────────────────────────────────────────────┐
│ Label Information                                               │
├─────────────────────────────────────────────────────────────────┤
│ Label Code: [Auto-generated]                                    │
│ Label Name: [Auto-generated]                                    │
│                                                                 │
│ Label Category: [Sewn-in Label ▼]                               │
│ Customer: [H&M (CUST-001) ▼]                                    │
│ Label Type: [Washcare Label ▼]                                  │
│                                                                 │
│ Size: [2x3 inches        ]                                      │
│                                                                 │
│ Fabric Content / Composition:                                   │
│ [100% Cotton                                       ]            │
│ The fabric composition to be printed on the label               │
│                                                                 │
│ Washcare Instructions:                                          │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Machine wash cold, tumble dry low, do not bleach,         │  │
│ │ iron on low heat if needed                                 │  │
│ └───────────────────────────────────────────────────────────┘  │
│ Care instructions for washing, drying, ironing, etc.            │
│                                                                 │
│ Print Method: [Screen Print    ]  Material: [Satin      ]      │
│ Color: [White            ]                                      │
└─────────────────────────────────────────────────────────────────┘
```
