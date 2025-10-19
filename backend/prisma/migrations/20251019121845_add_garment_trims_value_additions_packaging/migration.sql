-- CreateTable
CREATE TABLE "style_garment_trims" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "trimName" TEXT NOT NULL,
    "trimType" TEXT NOT NULL,
    "quantityPerPiece" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_garment_trims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_value_additions" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "additionType" TEXT NOT NULL,
    "description" TEXT,
    "estimatedCost" DECIMAL(10,2),
    "vendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_value_additions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_packaging" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "specification" TEXT,
    "quantityPerPack" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_packaging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "style_garment_trims_styleId_idx" ON "style_garment_trims"("styleId");

-- CreateIndex
CREATE INDEX "style_value_additions_styleId_idx" ON "style_value_additions"("styleId");

-- CreateIndex
CREATE INDEX "style_packaging_styleId_idx" ON "style_packaging"("styleId");

-- AddForeignKey
ALTER TABLE "style_garment_trims" ADD CONSTRAINT "style_garment_trims_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_value_additions" ADD CONSTRAINT "style_value_additions_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_packaging" ADD CONSTRAINT "style_packaging_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
