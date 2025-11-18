# Naming Conventions & Case Standardization

## Overview

This document explains the naming convention standards implemented across the Garment ERP application and how automatic case conversion is handled between different layers.

## Problem Statement

The application faced inconsistent naming conventions between different layers:
- **Database**: Uses `snake_case` (PostgreSQL standard)
- **Backend API**: Mixed `snake_case` relations and `camelCase` fields
- **Frontend**: Uses `camelCase` (JavaScript/TypeScript standard)

This caused issues when data passed between layers, with mismatched property names like:
- `material_categories` (backend) vs `category` (frontend expected)
- `order_items` (backend) vs `orderItems` (frontend expected)
- `users_orders_createdByIdTousers` (Prisma verbose) vs `createdBy` (frontend expected)

## Solution: Automatic Case Conversion

We implemented an automatic transformation layer that converts between naming conventions at the API boundary.

---

## Naming Convention Standards

### By Layer

| Layer | Convention | Example | Rationale |
|-------|-----------|---------|-----------|
| **Database (PostgreSQL)** | `snake_case` | `material_categories`, `created_by_id` | PostgreSQL standard |
| **Prisma Schema** | `snake_case` | Tables & columns use `snake_case` | Matches database |
| **Backend API Responses** | `camelCase` | `materialCategories`, `createdById` | JavaScript standard (after transformation) |
| **Frontend TypeScript** | `camelCase` | `categoryId`, `orderItems` | TypeScript/JavaScript standard |

### Examples

#### Database Schema
```sql
CREATE TABLE material_categories (
  id UUID PRIMARY KEY,
  parent_category_id UUID,
  created_by_id UUID
);
```

#### Prisma Model
```prisma
model material_categories {
  id                 String   @id @default(uuid())
  parent_category_id String?
  created_by_id      String
}
```

#### Backend API Response (After Transformation)
```json
{
  "id": "abc123",
  "parentCategoryId": "def456",
  "createdById": "ghi789",
  "materialCategories": [...]
}
```

#### Frontend TypeScript Type
```typescript
interface MaterialCategory {
  id: string;
  parentCategoryId?: string;
  createdById: string;
  materialCategories?: MaterialCategory[];
}
```

---

## Implementation Details

### Backend Transformation

#### 1. Serializer Utility ([backend/src/utils/serializer.ts](../backend/src/utils/serializer.ts))

The serializer provides utility functions for case conversion:

```typescript
// Convert database responses to camelCase
export function serialize<T>(data: any): T {
  // Converts snake_case to camelCase
  // Handles nested objects and arrays
  // Maps relation names (material_categories -> materialCategories)
}

// Convert request data to snake_case (if needed)
export function deserialize<T>(data: any): T {
  // Converts camelCase to snake_case
}
```

**Features:**
- Converts all object keys from `snake_case` to `camelCase`
- Handles Prisma's verbose relation names (e.g., `users_orders_createdByIdTousers` → `createdBy`)
- Recursively processes nested objects and arrays
- Uses `humps` library for reliable conversion

#### 2. Transformation Middleware ([backend/src/middleware/transform.middleware.ts](../backend/src/middleware/transform.middleware.ts))

Automatically applied to all API responses:

```typescript
export function transformResponse(req: Request, res: Response, next: NextFunction) {
  // Intercepts res.json() calls
  // Transforms data using serialize()
  // Sends transformed data to frontend
}
```

**Registration** in [backend/src/app.ts](../backend/src/app.ts):
```typescript
import { transformResponse } from './middleware/transform.middleware';

app.use(express.json());
app.use(transformResponse); // Applied to all routes
```

### Frontend Transformation

#### API Client ([frontend/src/lib/api.ts](../frontend/src/lib/api.ts))

The Axios client is configured with interceptors:

```typescript
import humps from 'humps';

// Response interceptor (optional - backend already transforms)
api.interceptors.response.use((response) => {
  // Backend handles transformation
  // This is a safety net for error responses
  if (error.response?.data) {
    error.response.data = humps.camelizeKeys(error.response.data);
  }
  return response;
});
```

---

## Relation Name Mapping

Special attention is given to Prisma relation names:

### Database Table Names → Frontend Property Names

| Database Table | Prisma Relation | Frontend Property |
|----------------|-----------------|-------------------|
| `material_categories` | `material_categories` | `category` or `materialCategories` |
| `inventory_stock` | `inventory_stock` | `inventoryStock` |
| `order_items` | `order_items` | `orderItems` |
| `purchase_orders` | `purchase_orders` | `purchaseOrders` |
| `bill_of_materials` | `bill_of_materials` | `billOfMaterials` |
| `goods_receiving_notes` | `goods_receiving_notes` | `goodsReceivingNotes` |

### Prisma Verbose Relations → Simple Names

Prisma sometimes generates verbose relation names like `users_orders_createdByIdTousers`. These are automatically simplified:

| Prisma Verbose Name | Simplified Frontend Name |
|---------------------|-------------------------|
| `users_orders_createdByIdTousers` | `createdBy` |
| `users_orders_approvedByIdTousers` | `approvedBy` |

---

## Dependencies

### Backend
```json
{
  "dependencies": {
    "humps": "^2.0.1"
  },
  "devDependencies": {
    "@types/humps": "^2.0.6"
  }
}
```

### Frontend
```json
{
  "dependencies": {
    "humps": "^2.0.1"
  },
  "devDependencies": {
    "@types/humps": "^2.0.6"
  }
}
```

---

## Best Practices

### When Writing Backend Code

1. **Database Operations**: Use snake_case for table/column names
   ```typescript
   await prisma.material_categories.findMany({
     include: {
       material_categories: true  // Prisma uses snake_case
     }
   });
   ```

2. **API Responses**: Don't manually transform - middleware handles it
   ```typescript
   // ✅ Good - let middleware transform
   res.json(materials);

   // ❌ Bad - don't manually transform
   res.json(humps.camelizeKeys(materials));
   ```

3. **Request Bodies**: Prisma accepts camelCase, no conversion needed
   ```typescript
   const material = await prisma.materials.create({
     data: {
       categoryId: req.body.categoryId,  // camelCase works
       supplierId: req.body.supplierId
     }
   });
   ```

### When Writing Frontend Code

1. **TypeScript Types**: Always use camelCase
   ```typescript
   interface Material {
     categoryId: string;        // ✅ camelCase
     materialCategories?: MaterialCategory[];  // ✅ camelCase
   }
   ```

2. **API Calls**: Send camelCase, receive camelCase
   ```typescript
   const response = await api.post('/materials', {
     categoryId: '123',  // ✅ camelCase
     supplierId: '456'
   });

   const material = response.data;  // Already camelCase from backend
   console.log(material.categoryId);  // ✅ Works
   ```

3. **Property Access**: Use camelCase
   ```typescript
   // ✅ Good
   material.materialCategories?.forEach(cat => ...)

   // ❌ Bad - won't work
   material.material_categories?.forEach(cat => ...)
   ```

---

## Testing the Transformation

### Verify Backend Transformation

```bash
# Test an API endpoint
curl http://localhost:5000/api/materials | jq '.[0]'

# Expected response (camelCase):
{
  "id": "...",
  "categoryId": "...",
  "materialCategories": { ... }
}
```

### Verify Frontend Reception

```typescript
// In browser console
const response = await api.get('/materials');
console.log(response.data[0]);
// Should show camelCase properties
```

---

## Troubleshooting

### Issue: Properties are undefined in frontend

**Symptoms:**
```typescript
console.log(material.category);  // undefined
console.log(material.material_categories);  // Has data
```

**Cause**: Backend transformation not working

**Solution**:
1. Check that `transformResponse` middleware is registered in `app.ts`
2. Verify middleware is registered BEFORE route handlers
3. Check browser Network tab to see actual API response format

### Issue: TypeScript errors for missing properties

**Symptoms:**
```typescript
// TS2339: Property 'materialCategories' does not exist
material.materialCategories
```

**Cause**: Frontend types don't match backend response

**Solution**:
1. Update TypeScript interface to use camelCase
2. Check RELATION_MAPPINGS in serializer.ts
3. Add custom mapping if needed

### Issue: Nested objects not transformed

**Symptoms**:
```typescript
material.category.parent_category  // snake_case in nested object
```

**Cause**: Recursive transformation not working

**Solution**:
1. Check `toCamelCase` function handles nested objects
2. Verify `applyRelationMappings` is called recursively

---

## Migration Guide

If you have existing code using snake_case:

1. **Update Frontend Types**:
   ```typescript
   // Before
   interface Material {
     category_id: string;
     material_categories?: any;
   }

   // After
   interface Material {
     categoryId: string;
     category?: MaterialCategory;
   }
   ```

2. **Update Component Code**:
   ```typescript
   // Before
   {materials.map(m => m.material_categories?.name)}

   // After
   {materials.map(m => m.category?.name)}
   ```

3. **No Backend Changes Needed**: Middleware handles everything automatically

---

## Future Improvements

1. **Type-Safe Mappings**: Generate TypeScript types from Prisma schema
2. **Performance Optimization**: Cache transformation results
3. **Custom Mappings**: Allow per-route transformation rules
4. **Validation**: Add runtime validation of transformed data

---

## References

- [humps library](https://github.com/domchristie/humps) - String and object key case conversion
- [Prisma Naming Conventions](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#naming-conventions)
- [PostgreSQL Naming Conventions](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
- [JavaScript/TypeScript Style Guide](https://google.github.io/styleguide/jsguide.html#naming)

---

## Summary

✅ **Database**: `snake_case` (PostgreSQL standard)
✅ **Backend API**: `camelCase` (automatic transformation)
✅ **Frontend**: `camelCase` (JavaScript/TypeScript standard)
✅ **Automatic**: No manual conversion needed in controllers or components
✅ **Consistent**: All layers follow language-specific best practices
