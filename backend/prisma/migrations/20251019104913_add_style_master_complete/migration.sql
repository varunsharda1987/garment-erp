-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductionStage" ADD VALUE 'ORDER_RECEIVED';
ALTER TYPE "ProductionStage" ADD VALUE 'PENDING_COSTING';
ALTER TYPE "ProductionStage" ADD VALUE 'PENDING_GREIGE_ORDER';
ALTER TYPE "ProductionStage" ADD VALUE 'TRIMS_NOT_ORDERED';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_PRINTING';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_DYING';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_EMBROIDERY';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_HANDWORK';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_CUTTING';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_STITCHING';
ALTER TYPE "ProductionStage" ADD VALUE 'IN_FINISHING';
ALTER TYPE "ProductionStage" ADD VALUE 'READY_TO_SHIP';
ALTER TYPE "ProductionStage" ADD VALUE 'SHIPPED';
ALTER TYPE "ProductionStage" ADD VALUE 'COMPLETED';

-- DropForeignKey
ALTER TABLE "public"."styles" DROP CONSTRAINT "styles_categoryId_fkey";

-- AlterTable
ALTER TABLE "styles" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "orderDate" TIMESTAMP(3),
ADD COLUMN     "orderQuantity" INTEGER,
ADD COLUMN     "orderValue" DECIMAL(15,2),
ADD COLUMN     "season" TEXT,
ALTER COLUMN "categoryId" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "ageGroup" DROP NOT NULL;

-- CreateTable
CREATE TABLE "style_components" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_fabrics" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "fabricType" TEXT NOT NULL,
    "fabricColor" TEXT,
    "fabricGSM" TEXT,
    "fabricWidth" DECIMAL(10,2),
    "cadAverageMeters" DECIMAL(10,3),
    "cadAverageYards" DECIMAL(10,3),
    "supplierName" TEXT,
    "unitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_fabrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_accessories" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "accessoryName" TEXT NOT NULL,
    "accessoryType" TEXT NOT NULL,
    "quantityPerPiece" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "supplierName" TEXT,
    "unitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_processes" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vendorName" TEXT,
    "estimatedCost" DECIMAL(10,2),
    "estimatedDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_costing" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "totalFabricCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAccessoryCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalMaterialCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "printingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dyingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "embroideryCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "handworkCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalProcessingCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cuttingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stitchingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "finishingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "checkingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "packingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalProductionCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "overheadCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "profitMargin" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCostPerPiece" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sellingPricePerPiece" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_costing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_size_breakdown" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_size_breakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_production_tracking" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "currentStage" "ProductionStage" NOT NULL,
    "piecesInStage" INTEGER NOT NULL DEFAULT 0,
    "sizeName" TEXT,
    "piecesOrderReceived" INTEGER NOT NULL DEFAULT 0,
    "piecesPendingCosting" INTEGER NOT NULL DEFAULT 0,
    "piecesPendingGreige" INTEGER NOT NULL DEFAULT 0,
    "piecesTrimsNotOrdered" INTEGER NOT NULL DEFAULT 0,
    "piecesInPrinting" INTEGER NOT NULL DEFAULT 0,
    "piecesInDying" INTEGER NOT NULL DEFAULT 0,
    "piecesInEmbroidery" INTEGER NOT NULL DEFAULT 0,
    "piecesInHandwork" INTEGER NOT NULL DEFAULT 0,
    "piecesInCutting" INTEGER NOT NULL DEFAULT 0,
    "piecesInStitching" INTEGER NOT NULL DEFAULT 0,
    "piecesInFinishing" INTEGER NOT NULL DEFAULT 0,
    "piecesReadyToShip" INTEGER NOT NULL DEFAULT 0,
    "piecesShipped" INTEGER NOT NULL DEFAULT 0,
    "piecesCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedStage" "ProductionStage",
    "lastUpdatedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_production_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_orders" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "orderValue" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "buyerName" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "style_components_styleId_idx" ON "style_components"("styleId");

-- CreateIndex
CREATE INDEX "style_fabrics_componentId_idx" ON "style_fabrics"("componentId");

-- CreateIndex
CREATE INDEX "style_accessories_componentId_idx" ON "style_accessories"("componentId");

-- CreateIndex
CREATE INDEX "style_processes_styleId_idx" ON "style_processes"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "style_costing_styleId_key" ON "style_costing"("styleId");

-- CreateIndex
CREATE INDEX "style_size_breakdown_styleId_idx" ON "style_size_breakdown"("styleId");

-- CreateIndex
CREATE INDEX "style_production_tracking_styleId_idx" ON "style_production_tracking"("styleId");

-- CreateIndex
CREATE INDEX "style_production_tracking_currentStage_idx" ON "style_production_tracking"("currentStage");

-- CreateIndex
CREATE UNIQUE INDEX "style_orders_orderNumber_key" ON "style_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "style_orders_styleId_idx" ON "style_orders"("styleId");

-- CreateIndex
CREATE INDEX "style_orders_orderNumber_idx" ON "style_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "styles_buyerName_idx" ON "styles"("buyerName");

-- CreateIndex
CREATE INDEX "styles_createdAt_idx" ON "styles"("createdAt");

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "style_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_components" ADD CONSTRAINT "style_components_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_fabrics" ADD CONSTRAINT "style_fabrics_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_accessories" ADD CONSTRAINT "style_accessories_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "style_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_processes" ADD CONSTRAINT "style_processes_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_costing" ADD CONSTRAINT "style_costing_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_size_breakdown" ADD CONSTRAINT "style_size_breakdown_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_production_tracking" ADD CONSTRAINT "style_production_tracking_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_orders" ADD CONSTRAINT "style_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
