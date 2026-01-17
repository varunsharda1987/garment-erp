# Add Brand Support to Labels and Packaging

## Problem Statement

Currently, labels and packaging can be linked to a **customer** but not to specific **brands**. Since one customer can have multiple brands (e.g., H&M has H&M, COS, Monki, Weekday), and each brand may need different labels and packaging, we need to add brand-level filtering.

**Current Limitation**:
```
Customer: H&M
  ├── Label: "Washcare Label" (linked to H&M, but no brand)
  └── Packaging: "Polybag" (linked to H&M, but no brand)
```

**Desired Feature**:
```
Customer: H&M
  ├── Brand: H&M
  │   ├── Label: "H&M Washcare Label"
  │   └── Packaging: "H&M Polybag"
  ├── Brand: COS
  │   ├── Label: "COS Washcare Label"
  │   └── Packaging: "COS Premium Box"
  └── Brand: Monki
      ├── Label: "Monki Washcare Label"
      └── Packaging: "Monki Eco Bag"
```

---

## Current Brand Implementation

**Brand Architecture**:
- Brands are NOT standalone entities
- Implemented via `brand_categories` table (Prisma schema lines 201-216)
- Each record combines: `customerId` + `brandName` + `category` + optional sub-categories
- Styles already use `brandCategoryId` to link to brands

**brand_categories Schema**:
```prisma
model brand_categories {
  id             String    @id @default(uuid())
  customerId     String
  brandName      String
  category       String
  subCategory    String?
  subSubCategory String?
  customer       customers @relation(fields: [customerId], references: [id])
  styles         styles[]
}
```

---

## Solution: Add brandCategoryId to Labels and Packaging

Following the same pattern used by `styles` table, add `brandCategoryId` as an optional foreign key.

---

## Implementation Plan

### Phase 1: Database Schema Changes

**File**: `backend/prisma/schema.prisma`

#### 1.1 Update label_master (around line 3850)

```prisma
model label_master {
  id              String         @id @default(uuid())
  labelCode       String         @unique
  labelName       String
  supplierCode    String?
  buyerCode       String?
  customerId      String?        // Link to customer
  brandCategoryId String?        // NEW: Link to specific brand
  labelCategory   LabelCategory  @default(SEWN_IN)
  // ... rest of fields

  // Relations
  customer           customers?           @relation(fields: [customerId], references: [id])
  brandCategory      brand_categories?    @relation("LabelBrands", fields: [brandCategoryId], references: [id])  // NEW
  suppliers          suppliers?           @relation(fields: [supplierId], references: [id])
  // ... rest of relations

  @@index([labelCode])
  @@index([supplierId])
  @@index([customerId])
  @@index([brandCategoryId])  // NEW: Index for filtering
}
```

#### 1.2 Update packaging_master (around line 3887)

```prisma
model packaging_master {
  id              String   @id @default(uuid())
  packagingCode   String   @unique
  packagingName   String
  supplierCode    String?
  buyerCode       String?
  customerId      String?  // Link to customer
  brandCategoryId String?  // NEW: Link to specific brand
  packagingType   String?
  // ... rest of fields

  // Relations
  customer           customers?           @relation(fields: [customerId], references: [id])
  brandCategory      brand_categories?    @relation("PackagingBrands", fields: [brandCategoryId], references: [id])  // NEW
  suppliers          suppliers?           @relation(fields: [supplierId], references: [id])
  // ... rest of relations

  @@index([packagingCode])
  @@index([supplierId])
  @@index([customerId])
  @@index([brandCategoryId])  // NEW: Index for filtering
}
```

#### 1.3 Add reverse relations to brand_categories

```prisma
model brand_categories {
  id             String    @id @default(uuid())
  customerId     String
  brandName      String
  // ... rest of fields

  customer       customers        @relation(fields: [customerId], references: [id])
  styles         styles[]
  labels         label_master[]   @relation("LabelBrands")    // NEW
  packaging      packaging_master[] @relation("PackagingBrands")  // NEW
}
```

**Migration Steps**:
1. Run `npx prisma db push` or create migration
2. Run `npx prisma generate` to update Prisma Client

---

### Phase 2: Backend Controller Updates

#### 2.1 Update label.controller.ts

**File**: `backend/src/controllers/label.controller.ts`

**Changes in createLabel()** (around line 22):
```typescript
const {
  labelName,
  supplierCode,
  buyerCode,
  customerId,
  brandCategoryId,  // NEW
  labelCategory = 'SEWN_IN',
  // ... rest
} = req.body;

// Validation: If brandCategoryId provided, validate it belongs to customer
if (brandCategoryId && customerId) {
  const brandCategory = await prisma.brand_categories.findFirst({
    where: { id: brandCategoryId, customerId }
  });

  if (!brandCategory) {
    return res.status(400).json({
      error: 'Invalid brand - brand must belong to the selected customer'
    });
  }
}

// Create label
const labelRecord = await prisma.label_master.create({
  data: {
    labelCode,
    labelName: finalLabelName,
    supplierCode: supplierCode || null,
    buyerCode: buyerCode || null,
    customerId: customerId || null,
    brandCategoryId: brandCategoryId || null,  // NEW
    // ... rest of fields
  },
  include: {
    customer: { select: { id: true, code: true, name: true } },
    brandCategory: {  // NEW: Include brand info
      select: {
        id: true,
        brandName: true,
        category: true,
        subCategory: true
      }
    },
    // ... rest of includes
  }
});
```

**Changes in updateLabel()** (around line 357):
```typescript
const {
  labelName,
  supplierCode,
  buyerCode,
  customerId,
  brandCategoryId,  // NEW
  // ... rest
} = req.body;

// Validation for update
if (brandCategoryId !== undefined) {
  if (brandCategoryId && customerId !== undefined) {
    const brandCategory = await prisma.brand_categories.findFirst({
      where: { id: brandCategoryId, customerId }
    });

    if (!brandCategory) {
      return res.status(400).json({
        error: 'Invalid brand - brand must belong to the selected customer'
      });
    }
  }
}

// Update label
const updated = await prisma.label_master.update({
  where: { id },
  data: {
    ...(labelName !== undefined && { labelName }),
    ...(customerId !== undefined && { customerId: customerId || null }),
    ...(brandCategoryId !== undefined && { brandCategoryId: brandCategoryId || null }),  // NEW
    // ... rest of fields
  },
  include: {
    customer: { select: { id: true, code: true, name: true } },
    brandCategory: {  // NEW
      select: {
        id: true,
        brandName: true,
        category: true,
        subCategory: true
      }
    },
    // ... rest
  }
});
```

**Changes in getAllLabel() and getLabelById()**:
Add `brandCategory` to the `include` objects for queries to return brand information.

#### 2.2 Update packaging.controller.ts

Apply the same changes as label.controller.ts:
- Add `brandCategoryId` parameter extraction
- Add validation logic
- Add to create/update data
- Include `brandCategory` in query results

---

### Phase 3: Frontend Type Updates

#### 3.1 Update label.types.ts

**File**: `frontend/src/types/label.types.ts`

```typescript
// Add brand category interface (if not already exists)
export interface BrandCategory {
  id: string;
  brandName: string;
  category: string;
  subCategory?: string | null;
  subSubCategory?: string | null;
}

export interface Label {
  id: string;
  labelCode: string;
  labelName: string;
  customerId?: string | null;
  brandCategoryId?: string | null;  // NEW
  // ... rest of fields

  // Relationships
  customer?: {
    id: string;
    code: string;
    name: string;
  } | null;
  brandCategory?: BrandCategory | null;  // NEW
}

export interface LabelFormData {
  labelName: string;
  customerId?: string;
  brandCategoryId?: string;  // NEW
  // ... rest of fields
}

export interface CreateLabelRequest {
  labelName: string;
  customerId?: string;
  brandCategoryId?: string;  // NEW
  // ... rest of fields
}
```

#### 3.2 Update packaging.types.ts

**File**: `frontend/src/types/packaging.types.ts`

Apply the same changes as label.types.ts:
- Add `brandCategoryId` to `Packaging` interface
- Add `brandCategory` relationship
- Update `PackagingFormData` and `CreatePackagingRequest`

#### 3.3 Update customer.types.ts (if needed)

Ensure `BrandCategory` interface is exported if it's not already available.

---

### Phase 4: Frontend Form Updates

#### 4.1 Update LabelForm.tsx

**File**: `frontend/src/pages/LabelForm.tsx`

**Add State** (around line 30):
```typescript
const [customers, setCustomers] = useState<Customer[]>([]);
const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
const [availableBrands, setAvailableBrands] = useState<BrandCategory[]>([]);  // NEW
const [selectedBrandCategoryId, setSelectedBrandCategoryId] = useState<string>('');  // NEW
```

**Load Brands When Customer Changes** (new useEffect):
```typescript
useEffect(() => {
  if (selectedCustomerId) {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer && customer.brandCategories) {
      setAvailableBrands(customer.brandCategories);
    } else {
      setAvailableBrands([]);
    }
    // Reset brand selection when customer changes
    setSelectedBrandCategoryId('');
  } else {
    setAvailableBrands([]);
    setSelectedBrandCategoryId('');
  }
}, [selectedCustomerId, customers]);
```

**Update Edit Mode Loading** (around line 85):
```typescript
setSelectedCustomerId(label.customerId || '');
setSelectedBrandCategoryId(label.brandCategoryId || '');  // NEW
```

**Add Brand Dropdown in Form** (after Customer dropdown, around line 310):
```tsx
{/* Customer */}
<div>
  <Label htmlFor="customerId">Customer (Optional)</Label>
  <Select
    value={selectedCustomerId || '_none_'}
    onValueChange={(value) => setSelectedCustomerId(value === '_none_' ? '' : value)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select customer..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="_none_">No Customer (Generic Label)</SelectItem>
      {customers.map(c => (
        <SelectItem key={c.id} value={c.id}>
          {c.name} ({c.code})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

{/* Brand - NEW */}
{selectedCustomerId && (
  <div>
    <Label htmlFor="brandCategoryId">Brand (Optional)</Label>
    <Select
      value={selectedBrandCategoryId || '_none_'}
      onValueChange={(value) => setSelectedBrandCategoryId(value === '_none_' ? '' : value)}
      disabled={availableBrands.length === 0}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select brand..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none_">No Brand (All Brands)</SelectItem>
        {availableBrands.map(bc => (
          <SelectItem key={bc.id} value={bc.id}>
            {bc.brandName} - {bc.category}
            {bc.subCategory && ` > ${bc.subCategory}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-gray-500 mt-1">
      Link this label to a specific brand under this customer
    </p>
  </div>
)}
```

**Update Submit Payload** (around line 161):
```typescript
const payload: LabelFormData = {
  ...data,
  labelCategory,
  labelType: finalLabelType || undefined,
  customerId: selectedCustomerId || undefined,
  brandCategoryId: selectedBrandCategoryId || undefined,  // NEW
  // ... rest
};
```

#### 4.2 Update PackagingForm.tsx

Apply the same changes as LabelForm.tsx:
- Add brand state management
- Load brands when customer selected
- Add brand dropdown UI
- Include brandCategoryId in payload

#### 4.3 Update LabelList.tsx and PackagingList.tsx

**Add Brand Column** (after Customer column):
```tsx
{
  key: 'brand',
  header: 'Brand',
  render: (label) => (
    <div className="text-sm text-gray-700">
      {label.brandCategory ? (
        <span className="font-medium">{label.brandCategory.brandName}</span>
      ) : (
        <span className="text-gray-400 italic">All Brands</span>
      )}
    </div>
  ),
},
```

---

### Phase 5: Update AccessoryPresetPicker

**File**: `frontend/src/components/AccessoryPresetPicker.tsx`

Currently, the picker filters by `customerId`. After adding brands, we should optionally filter by brand as well.

**Add brandCategoryId prop** (around line 34):
```typescript
interface AccessoryPresetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: PresetItemSelection[]) => void;
  customerId?: string;
  brandCategoryId?: string;  // NEW: Optional brand filter
}
```

**Update loadLabels()** (around line 104):
```typescript
const loadLabels = async () => {
  try {
    const params: any = { limit: 500 };
    if (customerId) params.customerId = customerId;
    if (brandCategoryId) params.brandCategoryId = brandCategoryId;  // NEW

    const response = await getAllLabels(params);
    // ... rest
  }
};
```

**Update loadPackaging()** similarly.

---

### Phase 6: Update Label/Packaging Services

#### 6.1 Update label.service.ts

**File**: `frontend/src/services/label.service.ts`

**Add brandCategoryId to query params**:
```typescript
export const getAllLabels = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  customerId?: string;
  brandCategoryId?: string;  // NEW
  labelCategory?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  // ... rest
  if (params?.brandCategoryId) queryParams.append('brandCategoryId', params.brandCategoryId);  // NEW

  const response = await api.get(`/api/materials/label?${queryParams}`);
  return response.data;
};
```

#### 6.2 Update packaging.service.ts

Apply the same changes to `getAllPackaging()`.

---

### Phase 7: Backend API Filtering

**Update getAllLabel() in label.controller.ts** (around line 158):
```typescript
export const getAllLabel = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      supplierId = '',
      customerId = '',
      brandCategoryId = '',  // NEW
      labelCategory = ''
    } = req.query;

    // Build where clause
    const whereConditions: any[] = [{ isActive: true }];

    // Filter by brand
    if (brandCategoryId) {
      whereConditions.push({ brandCategoryId: String(brandCategoryId) });
    }

    // Filter by customer (show customer-specific + generic)
    if (customerId) {
      whereConditions.push({
        OR: [
          { customerId: String(customerId) },
          { customerId: null }
        ]
      });
    }

    // ... rest of filtering logic
  }
};
```

Apply the same to `getAllPackaging()` in packaging.controller.ts.

---

## Files to Create/Modify Summary

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `backend/prisma/schema.prisma` | **MODIFY** | Add brandCategoryId to label_master, packaging_master, reverse relations |
| 2 | `backend/src/controllers/label.controller.ts` | **MODIFY** | Handle brandCategoryId in CRUD, validation, filtering |
| 3 | `backend/src/controllers/packaging.controller.ts` | **MODIFY** | Handle brandCategoryId in CRUD, validation, filtering |
| 4 | `frontend/src/types/label.types.ts` | **MODIFY** | Add brandCategoryId and brandCategory to interfaces |
| 5 | `frontend/src/types/packaging.types.ts` | **MODIFY** | Add brandCategoryId and brandCategory to interfaces |
| 6 | `frontend/src/pages/LabelForm.tsx` | **MODIFY** | Add brand dropdown, state management |
| 7 | `frontend/src/pages/PackagingForm.tsx` | **MODIFY** | Add brand dropdown, state management |
| 8 | `frontend/src/pages/LabelList.tsx` | **MODIFY** | Add Brand column |
| 9 | `frontend/src/pages/PackagingList.tsx` | **MODIFY** | Add Brand column |
| 10 | `frontend/src/services/label.service.ts` | **MODIFY** | Add brandCategoryId param to API calls |
| 11 | `frontend/src/services/packaging.service.ts` | **MODIFY** | Add brandCategoryId param to API calls |
| 12 | `frontend/src/components/AccessoryPresetPicker.tsx` | **MODIFY** | Optional brand filtering |

---

## Expected User Experience After Implementation

### Creating a Label:

```
1. Select Customer: "H&M"
   → Brand dropdown appears with H&M's brands

2. Select Brand (Optional): "COS - Premium"
   → Label will be linked to COS brand specifically

3. Fill in label details (type, size, etc.)

4. Save → Label is created as "COS Washcare Label"
```

### Filtering in Preset Picker:

When creating customer presets:
```
- If customer = H&M, brand = COS
  → Shows: COS-specific labels + H&M generic labels + truly generic labels

- If customer = H&M, brand = not selected
  → Shows: All H&M labels (all brands) + truly generic labels
```

### List View:

```
Label List:
┌─────────────┬──────────────┬──────────┬────────────┐
│ Code        │ Customer     │ Brand    │ Label Type │
├─────────────┼──────────────┼──────────┼────────────┤
│ LBL-0001    │ H&M          │ COS      │ Washcare   │
│ LBL-0002    │ H&M          │ Monki    │ Hangtag    │
│ LBL-0003    │ H&M          │ All      │ Size       │
│ LBL-0004    │ Generic      │ -        │ Barcode    │
└─────────────┴──────────────┴──────────┴────────────┘
```

---

## Key Design Decisions

### 1. Use brandCategoryId (not just brandName)

**Why**: Maintains consistency with `styles` table architecture and preserves full brand-category hierarchy information.

### 2. Make Brand Optional (like Customer)

**Why**:
- Labels can be customer-level (all brands)
- Labels can be brand-specific
- Labels can be generic (no customer/brand)

### 3. Cascading Relationship: Customer → Brand → Label

**Why**: Brand can't exist without customer, so selecting brand requires customer first.

### 4. Validation: Brand Must Belong to Customer

**Why**: Prevents data integrity issues where a label could reference a brand from a different customer.

### 5. Filter Logic: Show Brand-Specific + Parent-Level Items

When filtering by brand, show:
- Items linked to that specific brand
- Items linked to customer (but no brand = all brands)
- Generic items (no customer)

**Example**:
```
User filters: Customer = H&M, Brand = COS
Show:
  ✅ Labels with customerId=H&M, brandCategoryId=COS
  ✅ Labels with customerId=H&M, brandCategoryId=null (all H&M brands)
  ✅ Labels with customerId=null (generic for everyone)
  ❌ Labels with customerId=H&M, brandCategoryId=Monki (different brand)
```

---

## Migration Considerations

### Existing Data

All existing labels/packaging currently have:
- `customerId` = some value or null
- `brandCategoryId` = **will be null after migration**

This means existing customer-specific labels become "customer-level, all brands" which is backward-compatible.

### No Data Loss

The migration is additive (adding nullable field), so no existing data will be lost or need manual updates.

---

## Testing Checklist

After implementation:

- [ ] Create label with customer + brand
- [ ] Create label with customer only (no brand)
- [ ] Create generic label (no customer, no brand)
- [ ] Edit label to add brand
- [ ] Edit label to remove brand
- [ ] List labels - verify Brand column shows correctly
- [ ] Filter by customer in preset picker
- [ ] Filter by brand in preset picker (future enhancement)
- [ ] Validate that brand must belong to selected customer
- [ ] Test same flow for packaging
