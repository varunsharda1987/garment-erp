# Style-Order Integration: Manual Cleanup Instructions

**Status:** Database migration complete, manual code cleanup needed

## Summary

We've successfully:
- ✅ Removed `orderQuantity`, `orderDate`, `deliveryDate`, `orderValue` from Style model
- ✅ Removed `StyleOrder` model
- ✅ Removed `StyleSizeBreakdown` model
- ✅ Updated Prisma schema and pushed to database
- ✅ Removed fields from TypeScript interfaces

## Files That Need Manual Cleanup

### 1. backend/src/controllers/style.controller.ts

**Lines to remove/modify:**

**In createStyle function (lines 10-150):**
- Line 20-23: Remove from destructuring:
  ```typescript
  orderQuantity,
  orderDate,
  deliveryDate,
  orderValue,
  ```
- Line 26: Remove from destructuring:
  ```typescript
  sizeBreakdown,
  ```
- Lines 63-66: Remove from Prisma create:
  ```typescript
  orderQuantity: orderQuantity || null,
  orderDate: orderDate ? new Date(orderDate) : null,
  deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
  orderValue: orderValue || null,
  ```
- Lines 122-155: Remove entire size breakdown creation block:
  ```typescript
  sizeBreakdown: {
    create: sizeBreakdown?.sizes?.map((sizeData: any) => {
      ...entire block...
    }) || [],
  },
  ```
- Lines 130-137: Remove production tracking block:
  ```typescript
  if (orderQuantity) {
    await prisma.styleProductionTracking.create({
      ...
    });
  }
  ```
- Line 159: Remove from include:
  ```typescript
  sizeBreakdown: true,
  ```

**In updateStyle function (lines 280-450):**
- Lines 349-352: Remove from destructuring:
  ```typescript
  orderQuantity,
  orderDate,
  deliveryDate,
  orderValue,
  ```
- Line 326: Remove sizeBreakdown check:
  ```typescript
  if (sizeBreakdown !== undefined) { ... entire block ... }
  ```
- Lines 368-392: Remove size breakdown update block
- Lines 382-385: Remove from Prisma update:
  ```typescript
  orderQuantity: orderQuantity || null,
  orderDate: orderDate ? new Date(orderDate) : null,
  deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
  orderValue: orderValue || null,
  ```

**In getAllStyles or getStyleById:**
- Line 613: Remove from select:
  ```typescript
  orderQuantity: true,
  ```

**Search and remove all instances of:**
- `orderQuantity`
- `orderDate`
- `deliveryDate`
- `orderValue`
- `sizeBreakdown`

### 2. frontend/src/pages/StyleForm.tsx

**State variables to remove (around lines 32-38):**
```typescript
const [hasOrder, setHasOrder] = useState(false);
const [orderQuantity, setOrderQuantity] = useState('');
const [orderValue, setOrderValue] = useState('0');
const [orderDate, setOrderDate] = useState('');
const [deliveryDate, setDeliveryDate] = useState('');
```

**State variables for size breakdown (around lines 40-45):**
```typescript
const [sizeInputMethod, setSizeInputMethod] = useState<'ratio' | 'percentage' | 'absolute'>('absolute');
const [sizeBreakdown, setSizeBreakdown] = useState<{ [key: string]: string }>({});
```

**Remove UI sections:**
1. **Section 2: Order Information** (around lines 796-895) - entire section
2. **Section 6: Size Breakdown** (around lines 950-1080) - entire section

**Remove useEffect hooks:**
- Order value calculation (lines 96-104)
- Dependencies on hasOrder, orderQuantity, orderDate, deliveryDate

**Remove from form submission:**
- Lines 537-540: Order fields
- Size breakdown submission logic

**Remove from edit mode loading:**
- Lines 139-145: Order field loading
- Size breakdown loading logic

**Fix validation:**
- Lines 427-428: Remove order field validation

### 3. frontend/src/pages/StyleDetail.tsx

**Remove displays for:**
- Order information tab/section
- Size breakdown display

**Add "Create Order" button:**
```typescript
import { useNavigate } from 'react-router-dom';

// In component:
const navigate = useNavigate();

// Add button in appropriate section:
<Button 
  onClick={() => navigate(`/orders/new?styleId=${style.id}`)}
  variant="default"
>
  Create Order from This Style
</Button>
```

### 4. frontend/src/services/style.service.ts (Check if needed)

Remove any order/size breakdown field handling from API calls.

## Testing After Cleanup

1. **Backend:**
   ```bash
   cd backend
   npm run dev  # Should start without TypeScript errors
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm run dev  # Should start without errors
   npx tsc --noEmit  # Should pass TypeScript check
   ```

3. **Functional Tests:**
   - [ ] Can create new style without order fields
   - [ ] Can edit existing style
   - [ ] StyleList displays correctly
   - [ ] StyleDetail shows style info
   - [ ] "Create Order" button works
   - [ ] Can create order with style

## Quick Search Commands

```bash
# Find all order field references in backend
cd backend/src/controllers
grep -n "orderQuantity\|orderDate\|deliveryDate\|orderValue\|sizeBreakdown" style.controller.ts

# Find all order field references in frontend
cd frontend/src/pages
grep -n "orderQuantity\|orderDate\|deliveryDate\|orderValue\|hasOrder\|sizeBreakdown\|sizeInputMethod" StyleForm.tsx
```

## Alternative: Use Search & Replace in IDE

Most IDEs support multi-cursor editing and search/replace:
1. Open style.controller.ts
2. Search for "orderQuantity" - remove all lines with this
3. Search for "orderDate" - remove all lines
4. Search for "deliveryDate" - remove all lines
5. Search for "orderValue" - remove all lines
6. Search for "sizeBreakdown" - remove entire blocks
7. Repeat for StyleForm.tsx

---

**Note:** This is a significant refactor. Test thoroughly after each file cleanup!
