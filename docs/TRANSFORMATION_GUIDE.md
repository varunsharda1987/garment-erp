# Data Transformation Guide

This guide explains how the Garment ERP system handles data transformation between the database (snake_case) and the API/frontend (camelCase).

## Overview

The application uses a **global transformation middleware** that automatically converts:
- Database/Prisma responses: `snake_case` → `camelCase`
- Prisma relation names: `material_categories` → `category`
- Verbose Prisma relations: `users_orders_createdByIdTousers` → `createdBy`

This ensures the frontend always receives consistent camelCase data without manual transformation in each controller.

## Architecture

### Components

1. **Transform Middleware** (`backend/src/middleware/transform.middleware.ts`)
   - Intercepts all `res.json()` calls globally
   - Applies transformation before sending response
   - Registered in `app.ts` line 38-39

2. **Serializer Utility** (`backend/src/utils/serializer.ts`)
   - `toCamelCase()`: Converts snake_case to camelCase using `humps` library
   - `applyRelationMappings()`: Maps relation names to frontend-friendly names
   - `serialize()`: Combines both transformations
   - `RELATION_MAPPINGS`: Dictionary of custom relation name mappings

3. **Relation Mappings** (`RELATION_MAPPINGS` in `serializer.ts`)
   - Maps Prisma relation names to simplified names
   - Applied AFTER `toCamelCase()`, so keys must be in camelCase
   - Example: `materialCategories: 'category'`

## How It Works

### Transformation Flow

```
Database/Prisma Response (snake_case)
    ↓
toCamelCase() - Converts all keys to camelCase
    ↓
applyRelationMappings() - Maps relation names
    ↓
Frontend Response (camelCase with friendly names)
```

### Example

**Database Response:**
```json
{
  "id": "123",
  "material_name": "Cotton Fabric",
  "cost_price": 100.50,
  "material_categories": {
    "id": "cat1",
    "category_name": "Fabric",
    "parent_category_id": null
  }
}
```

**After toCamelCase():**
```json
{
  "id": "123",
  "materialName": "Cotton Fabric",
  "costPrice": 100.50,
  "materialCategories": {
    "id": "cat1",
    "categoryName": "Fabric",
    "parentCategoryId": null
  }
}
```

**After applyRelationMappings():**
```json
{
  "id": "123",
  "materialName": "Cotton Fabric",
  "costPrice": 100.50,
  "category": {
    "id": "cat1",
    "categoryName": "Fabric",
    "parentCategoryId": null
  }
}
```

## Developer Guidelines

### ✅ DO: Let the Global Middleware Handle Transformations

**Good:**
```typescript
// material.controller.ts
const materials = await prisma.materials.findMany({
  include: {
    material_categories: true,  // Use snake_case (Prisma's format)
    suppliers: true,
  },
});

res.json({ data: materials });  // Let middleware transform automatically
```

**Frontend receives:**
```typescript
{
  data: [{
    id: "123",
    materialName: "Cotton",
    category: { ... },      // Automatically mapped from materialCategories
    suppliers: { ... }
  }]
}
```

### ❌ DON'T: Manually Transform in Controllers

**Bad:**
```typescript
// DON'T DO THIS!
const transformedMaterials = materials.map(m => ({
  ...m,
  category: m.material_categories,  // Manual transformation
  material_categories: undefined,    // Removing original
}));

res.json({ data: transformedMaterials });
```

**Why?**
- Creates code duplication
- Inconsistent across controllers
- Defeats the purpose of global middleware
- Hard to maintain

### Adding New Relations

When you add a new Prisma include that should have a simplified name:

1. **Add mapping to `RELATION_MAPPINGS`** in `backend/src/utils/serializer.ts`:

```typescript
export const RELATION_MAPPINGS: Record<string, string> = {
  // ... existing mappings

  // Your new mapping (use camelCase key!)
  myNewRelation: 'simpleName',
};
```

2. **Use the snake_case relation name in Prisma queries**:

```typescript
const data = await prisma.myTable.findMany({
  include: {
    my_new_relation: true,  // snake_case in Prisma
  },
});
```

3. **Frontend receives the mapped name**:

```typescript
// Frontend receives:
{
  simpleName: { ... }  // Not myNewRelation or my_new_relation
}
```

### Handling Verbose Prisma Relations

Prisma generates verbose relation names for multiple relations to the same table:

**Example:**
```prisma
model orders {
  users_orders_createdByIdTousers  users  @relation("orders_createdByIdTousers", ...)
  users_orders_approvedByIdTousers users? @relation("orders_approvedByIdTousers", ...)
}
```

The `toCamelCase()` function **automatically extracts the meaningful part**:

- `users_orders_createdByIdTousers` → `createdBy`
- `users_orders_approvedByIdTousers` → `approvedBy`

**No manual mapping needed!**

```typescript
const order = await prisma.orders.findUnique({
  where: { id },
  include: {
    users_orders_createdByIdTousers: true,
  },
});

// Frontend receives:
{
  id: "123",
  orderNumber: "ORD-001",
  createdBy: {  // Automatically extracted!
    id: "user1",
    firstName: "John",
    lastName: "Doe"
  }
}
```

## Testing Transformations

### Enable Debug Logging

Set the environment variable to see transformation details:

```bash
# .env or command line
DEBUG_TRANSFORM=true
```

This will log:
- Endpoint being called
- Original data before transformation
- Transformed data after transformation
- Each relation mapping applied

### Run Test Script

```bash
cd backend
npm run build  # Build TypeScript first
node test-transformation.js
```

This runs comprehensive tests on:
- Basic camelCase conversion
- Relation mappings
- Verbose Prisma relations
- Nested objects and arrays

### Manual Testing

1. Start the backend with debug logging:
   ```bash
   DEBUG_TRANSFORM=true npm run dev
   ```

2. Make an API request:
   ```bash
   curl http://localhost:5000/api/materials/123
   ```

3. Check console output for transformation logs

## Common Issues

### Issue: Frontend receives `materialCategories` instead of `category`

**Cause:** Missing or incorrect mapping in `RELATION_MAPPINGS`

**Fix:**
1. Check `RELATION_MAPPINGS` has the entry
2. Ensure the key is in camelCase (not snake_case!)
3. Verify middleware is registered in `app.ts`

### Issue: Nested relations not transforming

**Cause:** The transformation is recursive, so this should work. Check:
1. Is the middleware registered?
2. Is DEBUG_TRANSFORM=true showing the transformation?
3. Is the Prisma include correct?

### Issue: Decimal fields showing as strings

**Cause:** Prisma returns Decimal types as objects

**Fix:** Convert in controller (acceptable):
```typescript
const materials = materials.map(m => ({
  ...m,
  costPrice: m.costPrice ? Number(m.costPrice) : 0,
}));
```

Or add to serializer for global handling.

## Best Practices

1. **Always use snake_case in Prisma queries** (as defined in schema)
2. **Never manually transform relation names** in controllers
3. **Add new mappings to `RELATION_MAPPINGS`** for clarity
4. **Use DEBUG_TRANSFORM=true** during development
5. **Trust the middleware** - it's tested and consistent
6. **Document non-obvious mappings** with comments

## Migration from Manual Transformations

If you have existing controllers with manual transformations:

### Before:
```typescript
const transformedStyles = styles.map(style => ({
  ...style,
  components: style.style_components,
  processes: style.style_processes,
  style_components: undefined,
  style_processes: undefined,
}));

res.json({ data: transformedStyles });
```

### After:
```typescript
// Just return the raw Prisma result
res.json({ data: styles });
```

### Update RELATION_MAPPINGS:
```typescript
export const RELATION_MAPPINGS: Record<string, string> = {
  // Add these entries
  styleComponents: 'components',
  styleProcesses: 'processes',
};
```

## FAQ

**Q: Do I need to transform request bodies from the frontend?**
A: No, Prisma accepts camelCase field names. The `transformRequestBody` middleware exists but is not currently used.

**Q: Can I disable transformation for specific endpoints?**
A: Yes, but not recommended. You could add conditional logic in the middleware based on the request path.

**Q: What about GraphQL or other API formats?**
A: This transformation only applies to REST API responses using `res.json()`. GraphQL would need separate handling.

**Q: Does this affect performance?**
A: Minimal impact. The `humps` library is very fast, and the transformation happens in memory before sending the response.

**Q: Can I use this for external API calls?**
A: The transformation only applies to responses from this backend. External API responses are not affected.

## Reference

### Files to Know

- `backend/src/middleware/transform.middleware.ts` - Middleware registration
- `backend/src/utils/serializer.ts` - Transformation logic
- `backend/src/app.ts:38-39` - Middleware registration
- `backend/test-transformation.js` - Test script

### Environment Variables

- `DEBUG_TRANSFORM=true` - Enable detailed transformation logging
- `NODE_ENV=development` - Used by some debug features

### NPM Packages

- `humps` - Library for camelCase/snake_case conversion

---

**Last Updated:** 2025-11-17
**Maintainer:** Development Team
