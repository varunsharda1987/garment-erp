-- CreateTable
CREATE TABLE "fabric_costing_run_items" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "cad_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "backfilled" BOOLEAN NOT NULL DEFAULT false,
    "component_name" TEXT,
    "greige_code" TEXT,
    "greige_name" TEXT,
    "cutable_width" DECIMAL(10,2),
    "cad_average" DECIMAL(10,4),
    "order_quantity_pcs" INTEGER,
    "costed_at_quantity_meters" DECIMAL(12,2),
    "costed_rate_is_batch" BOOLEAN NOT NULL DEFAULT false,
    "batch_color_name" TEXT,
    "cost_input_mode" TEXT,
    "greige_cost_per_meter" DECIMAL(10,2),
    "greige_rate_source" "GreigeRateSource",
    "greige_rate_source_ref" TEXT,
    "greige_rate_source_date" TIMESTAMP(3),
    "greige_rate_override_reason" TEXT,
    "transport_cost_per_meter" DECIMAL(10,2),
    "processor_id" TEXT,
    "processor_name" TEXT,
    "processing_type" TEXT,
    "printing_type" "PrintingType",
    "number_of_colors" INTEGER,
    "processing_price_per_meter" DECIMAL(10,2),
    "shrinkage_percent" DECIMAL(5,2),
    "shrinkage_cost_per_meter" DECIMAL(10,2),
    "screen_type" TEXT,
    "screen_cost_per_meter" DECIMAL(10,2),
    "total_cost_per_meter" DECIMAL(10,2),
    "costing_approval_status" "CadApprovalStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabric_costing_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fabric_costing_run_items_run_id_idx" ON "fabric_costing_run_items"("run_id");

-- CreateIndex
CREATE INDEX "fabric_costing_run_items_cad_id_idx" ON "fabric_costing_run_items"("cad_id");

-- AddForeignKey
ALTER TABLE "fabric_costing_run_items" ADD CONSTRAINT "fabric_costing_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fabric_costing_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_costing_run_items" ADD CONSTRAINT "fabric_costing_run_items_cad_id_fkey" FOREIGN KEY ("cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

