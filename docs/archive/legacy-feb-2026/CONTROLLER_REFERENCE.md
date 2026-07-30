# Controller Reference Guide

**Version:** 1.0
**Last Updated:** February 6, 2026

This guide documents controllers not covered in specialized guides.

---

## Table of Contents

1. [Dashboard Controller](#1-dashboard-controller)
2. [Style Controller](#2-style-controller)
3. [Quick Reference](#3-quick-reference)

---

## 1. Dashboard Controller

**Controller:** [backend/src/controllers/dashboard.controller.ts](../backend/src/controllers/dashboard.controller.ts:1)
**Routes:** [backend/src/routes/dashboard.routes.ts](../backend/src/routes/dashboard.routes.ts:1)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Get complete dashboard summary (orders, production, inventory, financials) |
| GET | `/api/dashboard/stage/:stage` | Get styles filtered by production stage |

### Dashboard Summary Response

```typescript
GET /api/dashboard/summary

Response:
{
  // Orders
  orders: {
    total: number;
    pending: number;
    approved: number;
    inProduction: number;
    completed: number;
    totalValue: number;
  },

  // Production
  production: {
    workOrders: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
    },
    cutting: {
      batches: number;
      inProgress: number;
      completed: number;
    },
    stitching: {
      issues: number;
      inProgress: number;
      completed: number;
    },
    finishing: {
      issues: number;
      inProgress: number;
      completed: number;
    }
  },

  // Inventory
  inventory: {
    materials: {
      total: number;
      lowStock: number;
      outOfStock: number;
    },
    fabrics: {
      total: number;
      totalValue: number;
      lowStock: number;
    }
  },

  // Financials
  financials: {
    invoices: {
      total: number;
      totalAmount: number;
      paid: number;
      unpaid: number;
      overdue: number;
    },
    purchaseOrders: {
      total: number;
      totalAmount: number;
      pending: number;
      acknowledged: number;
    }
  },

  // Quick Stats
  quickStats: {
    todaysOrders: number;
    pendingApprovals: number;
    criticalStockItems: number;
    overdueDeliveries: number;
  }
}
```

### Use Cases

**1. Main Dashboard Display:**
```typescript
const summary = await getDashboardSummary();

// Display KPI cards
<Card>
  <CardTitle>Total Orders</CardTitle>
  <CardValue>{summary.orders.total}</CardValue>
  <CardSubtext>{summary.orders.pending} pending approval</CardSubtext>
</Card>
```

**2. Production Stage Filter:**
```typescript
GET /api/dashboard/stage/CUTTING

Response:
{
  styles: [
    {
      id: string;
      styleNumber: string;
      styleName: string;
      currentStage: "CUTTING";
      workOrders: number;
      totalQuantity: number;
    }
  ]
}
```

---

## 2. Style Controller

**Controller:** [backend/src/controllers/style.controller.ts](../backend/src/controllers/style.controller.ts:1)
**Routes:** [backend/src/routes/style.routes.ts](../backend/src/routes/style.routes.ts:1)

### Core Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/styles` | ADMIN/MERCHANDISER | Create new style |
| GET | `/api/styles/drafts` | Required | Get draft styles |
| GET | `/api/styles/drafts/:id` | Required | Get draft by ID |
| DELETE | `/api/styles/drafts/:id` | ADMIN/MERCHANDISER | Delete draft |
| GET | `/api/styles/deleted` | ADMIN/MERCHANDISER | Get deleted styles |
| GET | `/api/styles` | Required | Get all styles (paginated, filterable) |
| GET | `/api/styles/:id` | Required | Get style by ID with full details |
| PUT | `/api/styles/:id` | ADMIN/MERCHANDISER | Update style |
| DELETE | `/api/styles/:id` | Admin | Delete style (soft delete) |
| GET | `/api/styles/:id/can-deactivate` | ADMIN/MERCHANDISER | Check if style can be deactivated |
| GET | `/api/styles/:id/fabric-stock` | Required | Get available fabric stock for style |

### Component Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/styles/:id/components` | ADMIN/MERCHANDISER | Add component to style |
| PUT | `/api/styles/components/:id` | ADMIN/MERCHANDISER | Update style component |
| DELETE | `/api/styles/components/:id` | ADMIN/MERCHANDISER | Remove component from style |

### Fabric Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/styles/:id/fabrics` | ADMIN/MERCHANDISER | Add fabric to style |
| PUT | `/api/styles/fabrics/:id` | ADMIN/MERCHANDISER | Update style fabric |
| DELETE | `/api/styles/fabrics/:id` | ADMIN/MERCHANDISER | Remove fabric from style |

### Accessory Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/styles/:id/accessories` | ADMIN/MERCHANDISER | Add accessory to style |
| PUT | `/api/styles/accessories/:id` | ADMIN/MERCHANDISER | Update style accessory |
| DELETE | `/api/styles/accessories/:id` | ADMIN/MERCHANDISER | Remove accessory from style |

### Process Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/styles/:id/processes` | ADMIN/MERCHANDISER | Add process to style |
| PUT | `/api/styles/processes/:id` | ADMIN/MERCHANDISER | Update style process |
| DELETE | `/api/styles/processes/:id` | ADMIN/MERCHANDISER | Remove process from style |

### Request/Response Examples

**Create Style:**
```typescript
POST /api/styles
{
  styleNumber: string;       // Unique identifier
  styleName: string;
  description?: string;
  categoryId: string;
  brandId?: string;
  seasonId?: string;
  targetPrice?: number;
  currency?: string;
  imagePath?: string;

  // Components (parts that make up the garment)
  components?: [
    {
      componentId: string;
      quantity: number;
      unit: string;
    }
  ],

  // Fabrics
  fabrics?: [
    {
      fabricId: string;
      consumptionPerPiece: number;  // meters or kg
      unit: string;
      allowancePercent?: number;
    }
  ],

  // Accessories (buttons, zippers, labels, etc.)
  accessories?: [
    {
      accessoryType: string;  // "BUTTON", "ZIPPER", "LABEL", etc.
      materialId: string;
      quantity: number;
      unit: string;
    }
  ],

  // Processes (embroidery, printing, dyeing, etc.)
  processes?: [
    {
      processType: string;   // "EMBROIDERY", "PRINTING", "DYEING", etc.
      processorId?: string;
      costPerPiece?: number;
      remarks?: string;
    }
  ]
}

Response:
{
  success: true;
  data: {
    id: string;
    styleNumber: string;
    styleName: string;
    status: "DRAFT";
    // ... full style object with relations
  }
}
```

**Get Style by ID:**
```typescript
GET /api/styles/:id

Response:
{
  id: string;
  styleNumber: string;
  styleName: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";

  // Relations (serialized to camelCase)
  category: {
    id: string;
    categoryName: string;
  },

  components: [
    {
      id: string;
      component: {
        componentName: string;
        componentCode: string;
      },
      quantity: number;
      unit: string;
    }
  ],

  fabrics: [
    {
      id: string;
      fabric: {
        fabricName: string;
        fabricType: string;
      },
      consumptionPerPiece: number;
      unit: string;
      allowancePercent: number;
    }
  ],

  accessories: [
    {
      id: string;
      accessoryType: string;
      material: {
        materialName: string;
        materialCode: string;
      },
      quantity: number;
      unit: string;
    }
  ],

  processes: [
    {
      id: string;
      processType: string;
      processor: {
        processorName: string;
      },
      costPerPiece: number;
    }
  ],

  // Usage statistics
  usageStats: {
    totalOrders: number;
    totalQuantityProduced: number;
    activeWorkOrders: number;
  }
}
```

**Get All Styles (Filtered):**
```typescript
GET /api/styles?page=1&limit=20&search=shirt&categoryId=uuid&brandId=uuid&status=ACTIVE

Response:
{
  data: Style[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Add Component to Style:**
```typescript
POST /api/styles/:id/components
{
  componentId: string;
  quantity: number;
  unit: string;
  remarks?: string;
}

Response:
{
  success: true;
  data: {
    id: string;
    styleId: string;
    componentId: string;
    quantity: number;
    unit: string;
  }
}
```

**Get Fabric Stock for Style:**
```typescript
GET /api/styles/:id/fabric-stock

Response:
{
  fabrics: [
    {
      fabricId: string;
      fabricName: string;
      requiredPerPiece: number;
      unit: string;
      availableStock: [
        {
          warehouseId: string;
          warehouseName: string;
          quantity: number;
          unit: string;
        }
      ],
      totalAvailable: number;
      canProduceQuantity: number;  // Based on available stock
    }
  ]
}
```

### Use Cases

**1. Style Creation Workflow:**
```typescript
// Step 1: Create base style
const style = await createStyle({
  styleNumber: 'ST-2026-001',
  styleName: 'Classic Cotton Shirt',
  categoryId: 'shirts-category-uuid',
  seasonId: 'SS26-uuid',
});

// Step 2: Add components
await addComponent(style.id, {
  componentId: 'collar-uuid',
  quantity: 1,
  unit: 'piece',
});

await addComponent(style.id, {
  componentId: 'cuff-uuid',
  quantity: 2,
  unit: 'pieces',
});

// Step 3: Add fabrics
await addFabric(style.id, {
  fabricId: 'cotton-fabric-uuid',
  consumptionPerPiece: 2.5,  // 2.5 meters per shirt
  unit: 'meters',
  allowancePercent: 5,        // 5% wastage allowance
});

// Step 4: Add accessories
await addAccessory(style.id, {
  accessoryType: 'BUTTON',
  materialId: 'button-uuid',
  quantity: 8,
  unit: 'pieces',
});

// Step 5: Add processes
await addProcess(style.id, {
  processType: 'EMBROIDERY',
  processorId: 'processor-uuid',
  costPerPiece: 25.00,
});
```

**2. Style Cloning:**
```typescript
// Get existing style
const originalStyle = await getStyleById(originalStyleId);

// Create new style with same structure
const clonedStyle = await createStyle({
  styleNumber: 'ST-2026-002',
  styleName: originalStyle.styleName + ' - Variant',
  categoryId: originalStyle.categoryId,

  // Clone components
  components: originalStyle.components.map(c => ({
    componentId: c.componentId,
    quantity: c.quantity,
    unit: c.unit,
  })),

  // Clone fabrics
  fabrics: originalStyle.fabrics.map(f => ({
    fabricId: f.fabricId,
    consumptionPerPiece: f.consumptionPerPiece,
    unit: f.unit,
    allowancePercent: f.allowancePercent,
  })),

  // ... clone accessories and processes
});
```

**3. Production Feasibility Check:**
```typescript
// Check if we can produce an order quantity
const style = await getStyleById(styleId);
const stockInfo = await getFabricStockForStyle(styleId);

const orderQuantity = 1000;

for (const fabric of stockInfo.fabrics) {
  const required = fabric.requiredPerPiece * orderQuantity;

  if (fabric.totalAvailable < required) {
    console.log(`Shortage: ${fabric.fabricName}`);
    console.log(`Required: ${required} ${fabric.unit}`);
    console.log(`Available: ${fabric.totalAvailable} ${fabric.unit}`);
    console.log(`Shortfall: ${required - fabric.totalAvailable} ${fabric.unit}`);

    // Trigger procurement
    await createMaterialRequirement({
      materialId: fabric.fabricId,
      quantity: required - fabric.totalAvailable,
      requiredBy: order.expectedDeliveryDate,
    });
  }
}
```

**4. Style Performance Analysis:**
```typescript
// Get all active styles
const styles = await getAllStyles({ status: 'ACTIVE' });

// Rank by total orders
const rankedStyles = styles.sort((a, b) =>
  b.usageStats.totalOrders - a.usageStats.totalOrders
);

// Top 10 best-selling styles
const topStyles = rankedStyles.slice(0, 10);

// Styles with no orders (candidates for deactivation)
const unusedStyles = styles.filter(s =>
  s.usageStats.totalOrders === 0 &&
  daysSince(s.createdAt) > 180  // Created more than 6 months ago
);

// Deactivate unused styles
for (const style of unusedStyles) {
  const canDeactivate = await canDeactivateStyle(style.id);
  if (canDeactivate) {
    await deleteStyle(style.id);  // Soft delete
  }
}
```

### Integration Points

#### With Orders
- Order items link to styles
- Style BOM used for MRP calculation
- Style processes trigger outsourcing requirements

#### With Production
- Work orders created from style + order quantity
- Cutting batches use style fabric consumption
- Stitching uses style component definitions

#### With Costing
- Style cost sheets calculate total cost per piece
- Fabric + accessory + process costs aggregated
- Target price vs actual cost comparison

#### With CAD Planning
- CAD plans optimize fabric consumption per style
- Marker efficiency improves with style complexity analysis
- Pattern parts linked to style components

---

## 3. Quick Reference

### Dashboard Summary Sections

| Section | Key Metrics | Use Case |
|---------|-------------|----------|
| Orders | Total, pending, in production, value | Sales performance tracking |
| Production | Work orders, cutting, stitching, finishing | Production bottleneck identification |
| Inventory | Materials, fabrics, stock levels | Procurement planning |
| Financials | Invoices, POs, cash flow | Financial health monitoring |

### Style Hierarchy

```
Style
├── Components (parts: collar, cuff, pocket, etc.)
├── Fabrics (main fabric, lining, interlining)
├── Accessories (buttons, zippers, labels, thread)
└── Processes (embroidery, printing, washing)
```

### Common Style Queries

```typescript
// Get all active styles for a category
GET /api/styles?categoryId=shirts&status=ACTIVE

// Get styles by brand and season
GET /api/styles?brandId=brandX&seasonId=SS26

// Search styles by name or number
GET /api/styles?search=cotton

// Get draft styles (not yet finalized)
GET /api/styles/drafts

// Get deleted styles (for restoration)
GET /api/styles/deleted
```

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [ORDER_PROCUREMENT_GUIDE.md](ORDER_PROCUREMENT_GUIDE.md) - Order management
- [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) - Production workflow
- [MATERIALS_MASTER_GUIDE.md](MATERIALS_MASTER_GUIDE.md) - Material management

---

**Maintained By:** Kashaya Fabs Development Team
