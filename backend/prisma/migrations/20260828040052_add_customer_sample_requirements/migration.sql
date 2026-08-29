-- CreateTable
CREATE TABLE "customer_sample_requirements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sampleType" "SampleType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "blocksProduction" BOOLEAN NOT NULL DEFAULT true,
    "targetDaysToSend" INTEGER,
    "targetDaysToFeedback" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_sample_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_sample_requirements_customerId_idx" ON "customer_sample_requirements"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sample_requirements_customerId_sampleType_key" ON "customer_sample_requirements"("customerId", "sampleType");

-- AddForeignKey
ALTER TABLE "customer_sample_requirements" ADD CONSTRAINT "customer_sample_requirements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
