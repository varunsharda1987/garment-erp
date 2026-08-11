-- CreateTable
CREATE TABLE "service_requirement_jwo_links" (
    "id" TEXT NOT NULL,
    "serviceRequirementId" TEXT NOT NULL,
    "jobWorkOrderId" TEXT NOT NULL,
    "allocatedQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_requirement_jwo_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_requirement_jwo_links_jobWorkOrderId_idx" ON "service_requirement_jwo_links"("jobWorkOrderId");

-- CreateIndex
CREATE INDEX "service_requirement_jwo_links_serviceRequirementId_idx" ON "service_requirement_jwo_links"("serviceRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "service_requirement_jwo_links_serviceRequirementId_jobWorkO_key" ON "service_requirement_jwo_links"("serviceRequirementId", "jobWorkOrderId");

-- AddForeignKey
ALTER TABLE "service_requirement_jwo_links" ADD CONSTRAINT "service_requirement_jwo_links_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "work_order_service_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requirement_jwo_links" ADD CONSTRAINT "service_requirement_jwo_links_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
