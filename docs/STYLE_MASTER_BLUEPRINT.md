# Style Master Module - Complete Implementation Blueprint

**Status**: Ready for Implementation
**Approved By**: User (Option B selected)
**Date**: 2025-10-18
**Session Context**: Fresh session implementation after requirements gathering

---

## Overview

The Style Master module is the core production tracking system for the Kashaya Fabs ERP. It manages garment styles from initial design through production completion, including components, fabrics, accessories, processes, costing, and production tracking.

### Key Features
- ✅ Create styles with or without order quantity
- ✅ Multi-component support (2-pc, 3-pc sets)
- ✅ CAD average entry per fabric (from external software)
- ✅ Multiple fabrics per component
- ✅ Accessories tracking per component
- ✅ Flexible process flow (optional stages)
- ✅ Complete costing breakdown
- ✅ Size-wise quantity breakdown
- ✅ Piece-level production tracking across all stages
- ✅ Dashboard integration with drill-down

---

## Database Schema

### 1. Styles Table (Main Master)

```prisma
model Style {
  id                String   @id @default(cuid())
  styleCode         String   @unique
  styleName         String
  buyerName         String   // Customer/Buyer name (free text, will use Customer Master later)
  brandName         String   // Brand name
  imageUrl          String?  // Path to style image (JPG/PNG)
  description       String?
  season            String?

  // Order fields (OPTIONAL - can be null if style created without order)
  orderQuantity     Int?
  orderDate         DateTime?
  deliveryDate      DateTime?
  orderValue        Decimal? @db.Decimal(15, 2)

  // Relationships
  components        StyleComponent[]
  processes         StyleProcess[]
  costing           StyleCosting?
  sizeBreakdown     StyleSizeBreakdown[]
  productionTracking ProductionTracking[]
  orders            Order[]  // For multiple orders per style

  // Metadata
  createdBy         String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  isActive          Boolean  @default(true)

  @@index([styleCode])
  @@index([buyerName])
  @@index([createdAt])
}
```

### 2. StyleComponent Table

```prisma
model StyleComponent {
  id              String   @id @default(cuid())
  styleId         String
  style           Style    @relation(fields: [styleId], references: [id], onDelete: Cascade)

  componentName   String   // e.g., "Top", "Bottom", "Dupatta", "Shirt", "Trouser"
  componentType   String   // e.g., "Kurta", "Pant", "Dupatta"
  sortOrder       Int      @default(0)

  // Relationships
  fabrics         StyleFabric[]
  accessories     StyleAccessory[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([styleId])
}
```

### 3. StyleFabric Table

```prisma
model StyleFabric {
  id                  String   @id @default(cuid())
  componentId         String
  component           StyleComponent @relation(fields: [componentId], references: [id], onDelete: Cascade)

  fabricName          String
  fabricType          String   // e.g., "Cotton", "Silk", "Polyester", "Georgette"
  fabricColor         String?
  fabricGSM           String?  // Grams per square meter
  fabricWidth         Decimal? @db.Decimal(10, 2) // Width in inches

  // CAD Averages (entered manually from external CAD software)
  cadAverageMeters    Decimal? @db.Decimal(10, 3) // Average consumption in meters per piece
  cadAverageYards     Decimal? @db.Decimal(10, 3) // Average consumption in yards per piece

  supplierName        String?
  unitPrice           Decimal? @db.Decimal(10, 2)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([componentId])
}
```

### 4. StyleAccessory Table

```prisma
model StyleAccessory {
  id                  String   @id @default(cuid())
  componentId         String
  component           StyleComponent @relation(fields: [componentId], references: [id], onDelete: Cascade)

  accessoryName       String   // e.g., "Button", "Zipper", "Thread", "Label", "Lace"
  accessoryType       String
  quantityPerPiece    Decimal  @db.Decimal(10, 3)
  unit                String   // e.g., "pcs", "meters", "dozen"

  supplierName        String?
  unitPrice           Decimal? @db.Decimal(10, 2)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([componentId])
}
```

### 5. StyleProcess Table

```prisma
model StyleProcess {
  id                  String   @id @default(cuid())
  styleId             String
  style               Style    @relation(fields: [styleId], references: [id], onDelete: Cascade)

  processName         String   // e.g., "Printing", "Dying", "Embroidery", "Handwork"
  processType         String   // Same as processName for now
  isRequired          Boolean  @default(true)
  sortOrder           Int      @default(0)

  vendorName          String?
  estimatedCost       Decimal? @db.Decimal(10, 2)
  estimatedDays       Int?

  notes               String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([styleId])
}
```

### 6. StyleCosting Table

```prisma
model StyleCosting {
  id                  String   @id @default(cuid())
  styleId             String   @unique
  style               Style    @relation(fields: [styleId], references: [id], onDelete: Cascade)

  // Material Costs
  totalFabricCost     Decimal  @default(0) @db.Decimal(15, 2)
  totalAccessoryCost  Decimal  @default(0) @db.Decimal(15, 2)
  totalMaterialCost   Decimal  @default(0) @db.Decimal(15, 2)

  // Processing Costs
  printingCost        Decimal  @default(0) @db.Decimal(10, 2)
  dyingCost           Decimal  @default(0) @db.Decimal(10, 2)
  embroideryCost      Decimal  @default(0) @db.Decimal(10, 2)
  handworkCost        Decimal  @default(0) @db.Decimal(10, 2)
  totalProcessingCost Decimal  @default(0) @db.Decimal(15, 2)

  // Production Costs
  cuttingCost         Decimal  @default(0) @db.Decimal(10, 2)
  stitchingCost       Decimal  @default(0) @db.Decimal(10, 2)
  finishingCost       Decimal  @default(0) @db.Decimal(10, 2)
  checkingCost        Decimal  @default(0) @db.Decimal(10, 2)
  packingCost         Decimal  @default(0) @db.Decimal(10, 2)
  totalProductionCost Decimal  @default(0) @db.Decimal(15, 2)

  // Overhead & Margins
  overheadCost        Decimal  @default(0) @db.Decimal(10, 2)
  profitMargin        Decimal  @default(0) @db.Decimal(10, 2)

  // Final Totals
  totalCostPerPiece   Decimal  @default(0) @db.Decimal(15, 2)
  sellingPricePerPiece Decimal @default(0) @db.Decimal(15, 2)

  notes               String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### 7. StyleSizeBreakdown Table

```prisma
model StyleSizeBreakdown {
  id                  String   @id @default(cuid())
  styleId             String
  style               Style    @relation(fields: [styleId], references: [id], onDelete: Cascade)

  sizeName            String   // e.g., "XS", "S", "M", "L", "XL", "XXL", "32", "34"
  quantity            Int

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([styleId])
}
```

### 8. ProductionTracking Table

```prisma
enum ProductionStage {
  ORDER_RECEIVED
  PENDING_COSTING
  PENDING_GREIGE_ORDER
  TRIMS_NOT_ORDERED
  IN_PRINTING
  IN_DYING
  IN_EMBROIDERY
  IN_HANDWORK
  IN_CUTTING
  IN_STITCHING
  IN_FINISHING
  READY_TO_SHIP
  SHIPPED
  COMPLETED
}

model ProductionTracking {
  id                  String   @id @default(cuid())
  styleId             String
  style               Style    @relation(fields: [styleId], references: [id], onDelete: Cascade)

  currentStage        ProductionStage
  piecesInStage       Int      @default(0)
  sizeName            String?  // For size-wise tracking

  // Stage-wise piece counts
  piecesOrderReceived      Int @default(0)
  piecesPendingCosting     Int @default(0)
  piecesPendingGreige      Int @default(0)
  piecesTrimsNotOrdered    Int @default(0)
  piecesInPrinting         Int @default(0)
  piecesInDying            Int @default(0)
  piecesInEmbroidery       Int @default(0)
  piecesInHandwork         Int @default(0)
  piecesInCutting          Int @default(0)
  piecesInStitching        Int @default(0)
  piecesInFinishing        Int @default(0)
  piecesReadyToShip        Int @default(0)
  piecesShipped            Int @default(0)
  piecesCompleted          Int @default(0)

  lastUpdatedStage    ProductionStage?
  lastUpdatedDate     DateTime?

  notes               String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([styleId])
  @@index([currentStage])
}
```

### 9. Order Table (Optional - for multiple orders per style)

```prisma
model Order {
  id                  String   @id @default(cuid())
  styleId             String
  style               Style    @relation(fields: [styleId], references: [id])

  orderNumber         String   @unique
  orderQuantity       Int
  orderDate           DateTime
  deliveryDate        DateTime?
  orderValue          Decimal  @db.Decimal(15, 2)

  status              String   @default("PENDING")

  buyerName           String
  brandName           String

  notes               String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([styleId])
  @@index([orderNumber])
}
```

---

## Backend Implementation

### File Structure

```
backend/src/
├── controllers/
│   ├── style.controller.ts
│   ├── styleComponent.controller.ts
│   ├── styleFabric.controller.ts
│   ├── styleAccessory.controller.ts
│   ├── styleProcess.controller.ts
│   ├── styleCosting.controller.ts
│   ├── productionTracking.controller.ts
│   └── dashboard.controller.ts
├── routes/
│   ├── style.routes.ts
│   ├── styleComponent.routes.ts
│   └── dashboard.routes.ts
├── middleware/
│   └── upload.middleware.ts (for image uploads)
└── types/
    └── style.types.ts
```

### API Endpoints

#### Style Management
- `POST /api/styles` - Create new style
- `GET /api/styles` - Get all styles (paginated, searchable)
- `GET /api/styles/:id` - Get style by ID (with all related data)
- `PUT /api/styles/:id` - Update style
- `DELETE /api/styles/:id` - Soft delete style
- `POST /api/styles/:id/image` - Upload style image

#### Component Management
- `POST /api/styles/:styleId/components` - Add component to style
- `PUT /api/components/:id` - Update component
- `DELETE /api/components/:id` - Delete component

#### Fabric Management
- `POST /api/components/:componentId/fabrics` - Add fabric to component
- `PUT /api/fabrics/:id` - Update fabric (including CAD averages)
- `DELETE /api/fabrics/:id` - Delete fabric

#### Accessory Management
- `POST /api/components/:componentId/accessories` - Add accessory to component
- `PUT /api/accessories/:id` - Update accessory
- `DELETE /api/accessories/:id` - Delete accessory

#### Process Management
- `POST /api/styles/:styleId/processes` - Add process to style
- `PUT /api/processes/:id` - Update process
- `DELETE /api/processes/:id` - Delete process

#### Costing Management
- `POST /api/styles/:styleId/costing` - Create/update costing
- `GET /api/styles/:styleId/costing` - Get costing
- `POST /api/styles/:styleId/costing/calculate` - Auto-calculate costing from components

#### Production Tracking
- `POST /api/styles/:styleId/production` - Create production tracking
- `PUT /api/production/:id/update-stage` - Update production stage with piece count
- `GET /api/production/by-stage/:stage` - Get all styles in a specific stage

#### Dashboard
- `GET /api/dashboard/summary` - Get dashboard summary with counts per stage
- `GET /api/dashboard/stage/:stage` - Get styles in a specific stage (for drill-down)

### Controller Example: style.controller.ts

```typescript
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';

/**
 * Create new style
 * POST /api/styles
 */
export const createStyle = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      styleCode,
      styleName,
      buyerName,
      brandName,
      description,
      season,
      orderQuantity,
      orderDate,
      deliveryDate,
      orderValue,
      components,
      processes,
    } = req.body;

    // Validation
    if (!styleCode || !styleName || !buyerName || !brandName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'styleCode, styleName, buyerName, and brandName are required',
      });
      return;
    }

    // Check for duplicate style code
    const existingStyle = await prisma.style.findUnique({
      where: { styleCode },
    });

    if (existingStyle) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Style code already exists',
      });
      return;
    }

    // Create style with nested components and processes
    const style = await prisma.style.create({
      data: {
        styleCode,
        styleName,
        buyerName,
        brandName,
        description,
        season,
        orderQuantity: orderQuantity || null,
        orderDate: orderDate ? new Date(orderDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        orderValue: orderValue || null,
        createdBy: req.user?.userId || 'system',
        components: {
          create: components?.map((comp: any, index: number) => ({
            componentName: comp.componentName,
            componentType: comp.componentType,
            sortOrder: index,
          })) || [],
        },
        processes: {
          create: processes?.map((proc: any, index: number) => ({
            processName: proc.processName,
            processType: proc.processType,
            isRequired: proc.isRequired !== false,
            sortOrder: index,
          })) || [],
        },
      },
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
        },
        processes: true,
        costing: true,
      },
    });

    // Create initial production tracking if order quantity exists
    if (orderQuantity) {
      await prisma.productionTracking.create({
        data: {
          styleId: style.id,
          currentStage: ProductionStage.ORDER_RECEIVED,
          piecesInStage: orderQuantity,
          piecesOrderReceived: orderQuantity,
        },
      });
    }

    res.status(201).json({
      data: style,
      message: 'Style created successfully',
    });
  } catch (error) {
    console.error('Create style error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create style',
    });
  }
};

/**
 * Get all styles with pagination and search
 * GET /api/styles
 */
export const getAllStyles = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const whereClause: any = { isActive: true };

    if (search) {
      whereClause.OR = [
        { styleCode: { contains: search, mode: 'insensitive' } },
        { styleName: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalStyles = await prisma.style.count({ where: whereClause });

    const styles = await prisma.style.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
        },
        processes: true,
        costing: true,
        productionTracking: true,
        _count: {
          select: {
            components: true,
            processes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      data: styles,
      pagination: {
        page,
        limit,
        total: totalStyles,
        totalPages: Math.ceil(totalStyles / limit),
      },
    });
  } catch (error) {
    console.error('Get all styles error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch styles',
    });
  }
};

/**
 * Get style by ID with all related data
 * GET /api/styles/:id
 */
export const getStyleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const style = await prisma.style.findUnique({
      where: { id },
      include: {
        components: {
          include: {
            fabrics: true,
            accessories: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        processes: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        costing: true,
        sizeBreakdown: true,
        productionTracking: true,
      },
    });

    if (!style) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Style not found',
      });
      return;
    }

    res.status(200).json({ data: style });
  } catch (error) {
    console.error('Get style by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch style',
    });
  }
};
```

### Controller Example: dashboard.controller.ts

```typescript
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';

/**
 * Get dashboard summary
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Count styles by production stage
    const stageCounts = await Promise.all([
      // Pre-Production
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.ORDER_RECEIVED },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.PENDING_COSTING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.PENDING_GREIGE_ORDER },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.TRIMS_NOT_ORDERED },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),

      // Processing
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_PRINTING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_DYING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_EMBROIDERY },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_HANDWORK },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),

      // Production
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_CUTTING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_STITCHING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_FINISHING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.productionTracking.aggregate({
        where: { currentStage: ProductionStage.READY_TO_SHIP },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
    ]);

    const summary = {
      preProduction: {
        ordersReceived: { styles: stageCounts[0]._count.id, pieces: stageCounts[0]._sum.piecesInStage || 0 },
        pendingCosting: { styles: stageCounts[1]._count.id, pieces: stageCounts[1]._sum.piecesInStage || 0 },
        pendingGreige: { styles: stageCounts[2]._count.id, pieces: stageCounts[2]._sum.piecesInStage || 0 },
        trimsNotOrdered: { styles: stageCounts[3]._count.id, pieces: stageCounts[3]._sum.piecesInStage || 0 },
      },
      processing: {
        inPrinting: { styles: stageCounts[4]._count.id, pieces: stageCounts[4]._sum.piecesInStage || 0 },
        inDying: { styles: stageCounts[5]._count.id, pieces: stageCounts[5]._sum.piecesInStage || 0 },
        inEmbroidery: { styles: stageCounts[6]._count.id, pieces: stageCounts[6]._sum.piecesInStage || 0 },
        inHandwork: { styles: stageCounts[7]._count.id, pieces: stageCounts[7]._sum.piecesInStage || 0 },
      },
      production: {
        inCutting: { styles: stageCounts[8]._count.id, pieces: stageCounts[8]._sum.piecesInStage || 0 },
        inStitching: { styles: stageCounts[9]._count.id, pieces: stageCounts[9]._sum.piecesInStage || 0 },
        inFinishing: { styles: stageCounts[10]._count.id, pieces: stageCounts[10]._sum.piecesInStage || 0 },
        readyToShip: { styles: stageCounts[11]._count.id, pieces: stageCounts[11]._sum.piecesInStage || 0 },
      },
    };

    res.status(200).json({ data: summary });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard summary',
    });
  }
};

/**
 * Get styles in a specific production stage
 * GET /api/dashboard/stage/:stage
 */
export const getStylesByStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stage } = req.params;

    // Validate stage
    if (!Object.values(ProductionStage).includes(stage as ProductionStage)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid production stage',
      });
      return;
    }

    const trackingRecords = await prisma.productionTracking.findMany({
      where: {
        currentStage: stage as ProductionStage,
        piecesInStage: { gt: 0 },
      },
      include: {
        style: {
          include: {
            components: true,
            processes: true,
            costing: true,
          },
        },
      },
    });

    const styles = trackingRecords.map(record => ({
      ...record.style,
      productionInfo: {
        piecesInStage: record.piecesInStage,
        sizeName: record.sizeName,
        lastUpdated: record.lastUpdatedDate,
      },
    }));

    res.status(200).json({ data: styles });
  } catch (error) {
    console.error('Get styles by stage error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch styles',
    });
  }
};
```

---

## Frontend Implementation

### File Structure

```
frontend/src/
├── pages/
│   ├── StyleList.tsx
│   ├── StyleForm.tsx
│   ├── StyleDetail.tsx
│   └── Dashboard.tsx (update existing)
├── components/
│   └── style/
│       ├── StyleBasicForm.tsx
│       ├── StyleComponentForm.tsx
│       ├── StyleFabricForm.tsx
│       ├── StyleAccessoryForm.tsx
│       ├── StyleProcessForm.tsx
│       ├── StyleCostingForm.tsx
│       └── StyleProductionView.tsx
├── services/
│   └── style.service.ts
├── types/
│   └── style.types.ts
└── stores/
    └── style.store.ts (optional)
```

### Frontend Types

```typescript
// frontend/src/types/style.types.ts

export interface Style {
  id: string;
  styleCode: string;
  styleName: string;
  buyerName: string;
  brandName: string;
  imageUrl: string | null;
  description: string | null;
  season: string | null;
  orderQuantity: number | null;
  orderDate: string | null;
  deliveryDate: string | null;
  orderValue: number | null;
  components: StyleComponent[];
  processes: StyleProcess[];
  costing: StyleCosting | null;
  sizeBreakdown: StyleSizeBreakdown[];
  productionTracking: ProductionTracking[];
  createdAt: string;
  updatedAt: string;
}

export interface StyleComponent {
  id: string;
  componentName: string;
  componentType: string;
  sortOrder: number;
  fabrics: StyleFabric[];
  accessories: StyleAccessory[];
}

export interface StyleFabric {
  id: string;
  fabricName: string;
  fabricType: string;
  fabricColor: string | null;
  fabricGSM: string | null;
  fabricWidth: number | null;
  cadAverageMeters: number | null;
  cadAverageYards: number | null;
  supplierName: string | null;
  unitPrice: number | null;
}

export interface StyleAccessory {
  id: string;
  accessoryName: string;
  accessoryType: string;
  quantityPerPiece: number;
  unit: string;
  supplierName: string | null;
  unitPrice: number | null;
}

export interface StyleProcess {
  id: string;
  processName: string;
  processType: string;
  isRequired: boolean;
  sortOrder: number;
  vendorName: string | null;
  estimatedCost: number | null;
  estimatedDays: number | null;
  notes: string | null;
}

export interface StyleCosting {
  id: string;
  totalFabricCost: number;
  totalAccessoryCost: number;
  totalMaterialCost: number;
  printingCost: number;
  dyingCost: number;
  embroideryCost: number;
  handworkCost: number;
  totalProcessingCost: number;
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  checkingCost: number;
  packingCost: number;
  totalProductionCost: number;
  overheadCost: number;
  profitMargin: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number;
}

export interface StyleSizeBreakdown {
  id: string;
  sizeName: string;
  quantity: number;
}

export interface ProductionTracking {
  id: string;
  currentStage: ProductionStage;
  piecesInStage: number;
  sizeName: string | null;
  piecesOrderReceived: number;
  piecesPendingCosting: number;
  piecesPendingGreige: number;
  piecesTrimsNotOrdered: number;
  piecesInPrinting: number;
  piecesInDying: number;
  piecesInEmbroidery: number;
  piecesInHandwork: number;
  piecesInCutting: number;
  piecesInStitching: number;
  piecesInFinishing: number;
  piecesReadyToShip: number;
  piecesShipped: number;
  piecesCompleted: number;
}

export enum ProductionStage {
  ORDER_RECEIVED = 'ORDER_RECEIVED',
  PENDING_COSTING = 'PENDING_COSTING',
  PENDING_GREIGE_ORDER = 'PENDING_GREIGE_ORDER',
  TRIMS_NOT_ORDERED = 'TRIMS_NOT_ORDERED',
  IN_PRINTING = 'IN_PRINTING',
  IN_DYING = 'IN_DYING',
  IN_EMBROIDERY = 'IN_EMBROIDERY',
  IN_HANDWORK = 'IN_HANDWORK',
  IN_CUTTING = 'IN_CUTTING',
  IN_STITCHING = 'IN_STITCHING',
  IN_FINISHING = 'IN_FINISHING',
  READY_TO_SHIP = 'READY_TO_SHIP',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
}

export interface DashboardSummary {
  preProduction: {
    ordersReceived: { styles: number; pieces: number };
    pendingCosting: { styles: number; pieces: number };
    pendingGreige: { styles: number; pieces: number };
    trimsNotOrdered: { styles: number; pieces: number };
  };
  processing: {
    inPrinting: { styles: number; pieces: number };
    inDying: { styles: number; pieces: number };
    inEmbroidery: { styles: number; pieces: number };
    inHandwork: { styles: number; pieces: number };
  };
  production: {
    inCutting: { styles: number; pieces: number };
    inStitching: { styles: number; pieces: number };
    inFinishing: { styles: number; pieces: number };
    readyToShip: { styles: number; pieces: number };
  };
}
```

### Service Layer

```typescript
// frontend/src/services/style.service.ts

import api from '../lib/api';
import type { Style, DashboardSummary } from '../types/style.types';

export const styleService = {
  // Get all styles
  getAllStyles: async (page: number = 1, limit: number = 10, search?: string) => {
    let url = `/styles?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  // Get style by ID
  getStyleById: async (id: string): Promise<Style> => {
    const response = await api.get(`/styles/${id}`);
    return response.data.data;
  },

  // Create style
  createStyle: async (data: any): Promise<Style> => {
    const response = await api.post('/styles', data);
    return response.data.data;
  },

  // Update style
  updateStyle: async (id: string, data: any): Promise<Style> => {
    const response = await api.put(`/styles/${id}`, data);
    return response.data.data;
  },

  // Upload style image
  uploadStyleImage: async (id: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/styles/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.imageUrl;
  },

  // Dashboard
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get('/dashboard/summary');
    return response.data.data;
  },

  getStylesByStage: async (stage: string): Promise<Style[]> => {
    const response = await api.get(`/dashboard/stage/${stage}`);
    return response.data.data;
  },
};
```

### Updated Dashboard Component

```typescript
// frontend/src/pages/Dashboard.tsx (UPDATE existing file)

// Add this import
import { styleService } from '@/services/style.service';
import type { DashboardSummary } from '@/types/style.types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await styleService.getDashboardSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (stage: string) => {
    navigate(`/styles?stage=${stage}`);
  };

  // Update the card components to use real data and add onClick handlers
  // Example for first card:
  <Card
    className="border-l-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow"
    onClick={() => handleCardClick('ORDER_RECEIVED')}
  >
    <CardHeader className="pb-2">
      <CardDescription className="text-xs">Orders Received</CardDescription>
      <CardTitle className="text-2xl">
        {loading ? '...' : summary?.preProduction.ordersReceived.styles || 0}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-gray-500">
        {loading ? 'Loading...' : `${summary?.preProduction.ordersReceived.pieces || 0} pieces`}
      </p>
    </CardContent>
  </Card>

  // Repeat for all 12 cards with appropriate stage values and data paths
}
```

---

## Implementation Steps

### Phase 1: Database Setup
1. ✅ Add new schema to `backend/prisma/schema.prisma`
2. ✅ Run `npx prisma migrate dev --name add_style_master`
3. ✅ Run `npx prisma generate`

### Phase 2: Backend API
1. ✅ Create controllers (style, component, fabric, accessory, process, costing, dashboard)
2. ✅ Create routes
3. ✅ Add image upload middleware
4. ✅ Test all endpoints with Postman/Thunder Client

### Phase 3: Frontend Types & Services
1. ✅ Create TypeScript types
2. ✅ Create service layer
3. ✅ Test API integration

### Phase 4: Frontend UI
1. ✅ Create StyleList page (similar to Users list)
2. ✅ Create multi-step StyleForm (Basic → Components → Fabrics → Accessories → Processes → Costing)
3. ✅ Create StyleDetail page (view-only with edit button)
4. ✅ Update Dashboard with real data
5. ✅ Add drill-down functionality

### Phase 5: Testing
1. ✅ Write E2E tests for style creation flow
2. ✅ Test production tracking updates
3. ✅ Test dashboard drill-down

---

## Image Upload Implementation

### Backend Middleware

```typescript
// backend/src/middleware/upload.middleware.ts

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../uploads/styles');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `style-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed'));
  }
};

export const uploadStyleImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
}).single('image');
```

### Frontend Image Upload

```typescript
// In StyleForm component
const handleImageUpload = async (file: File) => {
  try {
    setUploading(true);
    const imageUrl = await styleService.uploadStyleImage(styleId, file);
    setValue('imageUrl', imageUrl);
  } catch (error) {
    console.error('Image upload failed:', error);
    alert('Failed to upload image');
  } finally {
    setUploading(false);
  }
};

// Image preview and upload UI
<div className="space-y-2">
  <Label>Style Image (JPG/PNG)</Label>
  {imagePreview && (
    <img src={imagePreview} alt="Preview" className="w-48 h-48 object-cover" />
  )}
  <Input
    type="file"
    accept="image/jpeg,image/png"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) {
        setImagePreview(URL.createObjectURL(file));
        handleImageUpload(file);
      }
    }}
  />
</div>
```

---

## Key Design Decisions

1. **Optional Order Quantity**: Style can be created without order details (null values allowed)
2. **CAD Averages**: Manual entry from external CAD software (both meters and yards supported)
3. **Multi-component Support**: Unlimited components per style (2-pc, 3-pc, or more)
4. **Multiple Fabrics**: Each component can have multiple fabrics with separate CAD averages
5. **Flexible Processes**: All processes are optional (can skip printing, dying, etc.)
6. **Piece-level Tracking**: Production tracked at piece level, not style level
7. **Size-wise Tracking**: Optional size-wise breakdown and tracking
8. **Soft Delete**: Styles marked as inactive instead of hard delete
9. **File Storage**: Images stored in file system with paths in database
10. **Dashboard Drill-down**: Clicking card navigates to filtered style list

---

## Testing Checklist

### Backend API Tests
- [ ] Create style without order quantity
- [ ] Create style with order quantity
- [ ] Add components to style
- [ ] Add multiple fabrics to component with CAD averages
- [ ] Add accessories to component
- [ ] Add optional processes
- [ ] Calculate costing automatically
- [ ] Update production stage
- [ ] Get dashboard summary
- [ ] Get styles by stage
- [ ] Upload style image
- [ ] Search styles

### Frontend UI Tests
- [ ] Create new style (multi-step form)
- [ ] Upload style image (JPG/PNG only)
- [ ] Add 2-component style (2-pc set)
- [ ] Add 3-component style (3-pc set)
- [ ] Enter CAD averages manually
- [ ] Add multiple fabrics per component
- [ ] Skip optional processes
- [ ] View style details
- [ ] Edit existing style
- [ ] Dashboard shows correct counts
- [ ] Click dashboard card to drill down
- [ ] Search styles
- [ ] Pagination works correctly

---

## Notes for Implementation

1. **Migration Strategy**: The existing schema has a Style model. We're EXTENDING it, not replacing it.

2. **Backwards Compatibility**: Existing Style records will need migration script to add default values for new required fields.

3. **Performance**: Dashboard summary uses aggregations - consider caching for large datasets.

4. **Image Handling**: Using file system storage. Path stored in database: `/uploads/styles/style-123456.jpg`

5. **Multi-step Form**: StyleForm should be a wizard with 6 steps:
   - Step 1: Basic Info (code, name, buyer, brand, image, optional order)
   - Step 2: Components (add/remove components)
   - Step 3: Fabrics (add fabrics with CAD averages per component)
   - Step 4: Accessories (add accessories per component)
   - Step 5: Processes (select which processes needed)
   - Step 6: Review & Submit

6. **Validation**: All required fields must be validated both frontend (Zod) and backend.

7. **Error Handling**: Comprehensive error messages for duplicate style codes, invalid file types, etc.

8. **User Permissions**: Only ADMIN and MERCHANDISER can create/edit styles. Others can view only.

---

## Success Criteria

✅ Can create style without order quantity
✅ Can create style with order quantity
✅ Can add 2-pc and 3-pc component sets
✅ Can enter CAD averages manually (meters/yards)
✅ Can add multiple fabrics per component
✅ Can add accessories per component
✅ Can select optional processes
✅ Can upload style image (JPG/PNG)
✅ Dashboard shows real counts per stage
✅ Clicking dashboard card shows filtered styles
✅ Can track production at piece level
✅ Can see size-wise breakdown
✅ Can search styles by code/name/buyer/brand

---

## Ready for Implementation

This blueprint contains everything needed to implement the Style Master module:
- ✅ Complete database schema
- ✅ Backend API specifications
- ✅ Frontend types and services
- ✅ UI component structure
- ✅ Image upload handling
- ✅ Dashboard integration
- ✅ Testing checklist

**Next Session**: Follow this blueprint step-by-step, starting with Phase 1 (Database Setup).
