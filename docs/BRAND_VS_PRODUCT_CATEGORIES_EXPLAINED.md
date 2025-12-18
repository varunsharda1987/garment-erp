# Brand Categories vs Product Categories - Relationship Explained

## Overview

Your garment ERP has **two different category systems** that serve different purposes and can work together:

1. **Brand Categories** - Customer/brand-specific classifications
2. **Product Categories** - Global/universal product classifications

---

## 1. Brand Categories (`brand_categories`)

### Purpose
**Customer-specific brand categorization** - Each customer (buyer) has their own way of categorizing their products by brand and product lines.

### Structure
```
Customer → Brand Name → Category → Sub-Category → Sub-Sub-Category
```

### Example
```
Customer: Nike
  Brand: Nike Pro
    Category: Activewear
      Sub-Category: Running
        Sub-Sub-Category: Marathon Series

Customer: Adidas
  Brand: Adidas Originals
    Category: Streetwear
      Sub-Category: Retro
        Sub-Sub-Category: Classic Line
```

### Schema Definition
```prisma
model brand_categories {
  id             String    @id @default(uuid())
  customerId     String    // Which customer/buyer
  brandName      String    // Brand within customer (Nike Pro, Nike Kids, etc.)
  category       String    // Main category
  subCategory    String?   // Sub-category (optional)
  subSubCategory String?   // Sub-sub-category (optional)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relations
  customer  customers @relation(...)
  styles    styles[]           // Styles linked to this brand category
  labels    label_master[]     // Labels for this brand
  packaging packaging_master[] // Packaging for this brand
}
```

### Key Characteristics
- ✅ **Customer-specific** - Each customer defines their own categories
- ✅ **Marketing/Brand-focused** - Based on customer's product lines and brands
- ✅ **Hierarchical** - Up to 3 levels (category → sub → sub-sub)
- ✅ **Flexible naming** - Customers use their own terminology
- ✅ **Used for filtering** - Labels, packaging, and styles by brand

### Where It's Used
1. **Styles** - Each style can be linked to a brand category
2. **Labels** - Labels specific to a brand within a customer
3. **Packaging** - Packaging specific to a brand within a customer
4. **Customer filtering** - Filter products by brand/category

---

## 2. Product Categories (`product_category_master`)

### Purpose
**Global product classification** - Universal categorization of garment types across all customers based on garment structure and components.

### Structure
```
Level 1 (L1) → Level 2 (L2) → Level 3 (L3)
```

### Example
```
L1: Ethnic Wear
  L2: Traditional Indian
    L3: Salwar Kameez Set
    L3: Lehenga Choli Set
    L3: Saree
  L2: Indo-Western
    L3: Kurti Set
    L3: Palazzo Set

L1: Western Wear
  L2: Casual Wear
    L3: T-Shirt
    L3: Jeans
    L3: Co-Ords Set
  L2: Formal Wear
    L3: Suit (3-Piece)
    L3: Blazer
```

### Schema Definition
```prisma
model product_category_master {
  id            String   @id @default(uuid())
  code          String   @unique
  name          String
  description   String?
  parentId      String?                    // Parent category (for hierarchy)
  level         Int      @default(1)       // L1, L2, or L3
  sortOrder     Int      @default(0)
  minComponents Int      @default(1)       // NEW: Min components required
  maxComponents Int      @default(1)       // NEW: Max components allowed
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  parent            product_category_master?    @relation("ProductCategoryHierarchy", ...)
  children          product_category_master[]   @relation("ProductCategoryHierarchy")
  styles            styles[]                     // Styles in this category
  defaultComponents category_component_defaults[] // Default components for this category
}
```

### Key Characteristics
- ✅ **Universal/Global** - Same categories across all customers
- ✅ **Garment-structure-focused** - Based on actual garment construction
- ✅ **Hierarchical** - 3 levels (L1 → L2 → L3)
- ✅ **Component-aware** - Each category defines min/max components
- ✅ **Standardized naming** - Consistent terminology across system
- ✅ **Linked to components** - Defines which components are typical/required

### Where It's Used
1. **Styles** - Each style has a product category (garment type)
2. **Component Defaults** - Links to component masters (Blouse, Palazzo, etc.)
3. **Manufacturing** - Determines production workflow
4. **Validation** - Enforces component count rules (min/max)

---

## 3. How They Work Together

### In the Styles Table
Each **style** can have BOTH categories:

```prisma
model styles {
  id                String    @id
  styleCode         String    @unique
  styleName         String
  customerId        String    // Which customer

  // Brand Category (Customer-specific)
  brandCategoryId   String?   // Optional - customer's brand classification

  // Product Category (Global)
  productCategoryId String?   // Optional - universal garment type

  // Relations
  brand_categories  brand_categories?       @relation(...)
  product_category  product_category_master? @relation(...)
}
```

### Example: Real-World Style

**Style:** "Nike Pro Marathon Top"

```javascript
{
  styleCode: "NPM-TOP-001",
  styleName: "Nike Pro Marathon Top",
  customerId: "nike-uuid",

  // Brand Category (Marketing/Business perspective)
  brandCategoryId: "brand-cat-123",
  // Resolves to: Nike → Nike Pro → Activewear → Running → Marathon Series

  // Product Category (Manufacturing/Structure perspective)
  productCategoryId: "prod-cat-456",
  // Resolves to: Western Wear → Casual Wear → T-Shirt
  // Min components: 1, Max components: 1
  // Default component: Top
}
```

### Why Both?

| Aspect | Brand Category | Product Category |
|--------|---------------|------------------|
| **Purpose** | Marketing & Sales | Manufacturing & Operations |
| **Perspective** | Customer's view | Factory's view |
| **Naming** | Customer-specific (Nike Pro, Adidas Kids) | Universal (T-Shirt, Palazzo Set) |
| **Used For** | Filtering, reporting, brand management | Component selection, BOM, production |
| **Determines** | Which brand line it belongs to | What components it needs |
| **Changes** | Can vary per customer | Standardized across system |

---

## 4. Practical Examples

### Example 1: Customer has both categories

**Style:** "Adidas Originals Classic Tracksuit"

```
Brand Category Path:
  Customer: Adidas
  → Brand: Adidas Originals
  → Category: Streetwear
  → Sub-Category: Retro
  → Sub-Sub-Category: Classic Line

Product Category Path:
  L1: Western Wear
  → L2: Casual Wear
  → L3: Co-Ords Set

Components (from Product Category):
  - Min Components: 2
  - Max Components: 2
  - Suggested: Top + Pants
```

**Benefits:**
- ✅ Can filter by "Adidas Originals Streetwear" for customer reporting
- ✅ Can use "Co-Ords Set" template for component selection
- ✅ Get component validation (must have exactly 2 components)
- ✅ Use correct labels/packaging for "Adidas Originals" brand

### Example 2: Style with only Product Category

**Style:** "Generic Basic T-Shirt"

```
Brand Category: None (internal production)
Product Category: Western Wear → Casual Wear → T-Shirt
  - Min: 1, Max: 1
  - Component: Top
```

**Use Case:** Internal/non-branded production

### Example 3: Style with only Brand Category

**Style:** "Nike Special Project Prototype"

```
Brand Category: Nike → Nike Innovation Lab → Experimental
Product Category: None (not yet classified)
```

**Use Case:** Early-stage design, not yet standardized

---

## 5. Component Group vs Product Category

**Important:** Don't confuse these with the newly added **Component Groups**:

| System | Purpose | Examples | Used For |
|--------|---------|----------|----------|
| **Component Group** | Physical garment grouping | TOP, BOTTOM, OUTER, INNER | Organizing component masters |
| **Product Category** | Garment type classification | T-Shirt, Palazzo Set, Suit | Style classification |
| **Brand Category** | Customer brand classification | Nike Pro → Running, Adidas → Retro | Brand/marketing filtering |

### Hierarchy Example

```
Product Category: "Salwar Kameez Set" (L3)
  ↓ Has default components
  - Kameez → from Component Group "TOP"
  - Salwar → from Component Group "BOTTOM"
  - Dupatta → from Component Group "ACCESS"

Brand Category: "Nike → Nike Pro → Activewear"
  ↓ Has brand-specific
  - Labels for Nike Pro
  - Packaging for Nike Pro
  - Styles under Nike Pro brand
```

---

## 6. Database Relationships Summary

```
customers (1) ←→ (many) brand_categories
  ↓
  Each brand category can have:
  - Multiple styles
  - Brand-specific labels
  - Brand-specific packaging

product_category_master (hierarchical L1→L2→L3)
  ↓
  Each product category has:
  - Multiple styles
  - Default component masters (via category_component_defaults)
  - Min/max component constraints

styles
  ↓ Can link to BOTH:
  - brandCategoryId (optional)
  - productCategoryId (optional)
```

---

## 7. When to Use Which?

### Use Brand Categories When:
- ✅ Customer has multiple brand lines (Nike Pro, Nike Kids, etc.)
- ✅ Need to filter styles by customer's brand
- ✅ Managing brand-specific labels/packaging
- ✅ Generating reports grouped by brand
- ✅ Customer uses hierarchical categorization

### Use Product Categories When:
- ✅ Need to determine garment structure (components)
- ✅ Setting up manufacturing workflows
- ✅ Validating component selection
- ✅ Creating BOM templates
- ✅ Standardizing across customers

### Use Both When:
- ✅ Manufacturing for branded customers
- ✅ Need both marketing view and manufacturing view
- ✅ Complex product lines with specific structures
- ✅ Want maximum flexibility and filtering options

---

## 8. Frontend Usage

### Style Form
```typescript
// User selects both (optional)
const styleFormData = {
  // Brand perspective (customer's view)
  brandCategoryId: "selected-brand-category-uuid",
  // → Shows customer's brand hierarchy dropdown

  // Product perspective (factory's view)
  productCategoryId: "selected-product-category-uuid",
  // → Loads component templates and validation rules
  // → Shows grouped component selection
  // → Validates min/max component count
}
```

### Filtering
```typescript
// Filter by brand
GET /api/styles?brandCategoryId=xxx
// Returns all styles in that brand line

// Filter by product type
GET /api/styles?productCategoryId=yyy
// Returns all styles of that garment type

// Filter by both
GET /api/styles?brandCategoryId=xxx&productCategoryId=yyy
// Returns brand styles of specific garment type
```

---

## 9. Summary

**Brand Categories:**
- 👔 Customer/marketing perspective
- 📊 Business reporting and filtering
- 🏷️ Brand-specific labels/packaging
- 🎯 Flexible, customer-defined hierarchies

**Product Categories:**
- 🏭 Manufacturing/operations perspective
- 🧩 Component structure and validation
- 📋 Production workflows and BOMs
- 📏 Standardized across all customers

**Relationship:**
- 🔗 Independent but complementary
- 🔄 Both optional on styles
- ⚙️ Work together for complete classification
- 💡 Brand = "What brand line?" / Product = "What garment type?"

---

## 10. Migration Note

The recent **Component Group Master** implementation adds another layer:

```
Component Master (Blouse, Top, Palazzo)
  ↑ belongs to
Component Group (TOP, BOTTOM, OUTER)
  ↑ used by
Product Category (T-Shirt, Palazzo Set)
  ↑ independent from
Brand Category (Nike Pro → Running)
```

All three systems coexist:
1. **Component Groups** - Organize component masters
2. **Product Categories** - Classify garments by structure
3. **Brand Categories** - Classify by customer's brands

---

**Document Version:** 1.0
**Last Updated:** 2025-12-17
**Related Docs:**
- [Component Group Implementation Summary](./COMPONENT_GROUP_IMPLEMENTATION_SUMMARY.md)
- [Component Group Testing Guide](./COMPONENT_GROUP_TESTING_GUIDE.md)
