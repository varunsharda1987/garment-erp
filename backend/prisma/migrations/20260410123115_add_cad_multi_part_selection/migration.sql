-- CreateTable
CREATE TABLE "cad_pattern_parts" (
    "id" TEXT NOT NULL,
    "cad_id" TEXT NOT NULL,
    "pattern_part_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cad_pattern_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cad_pattern_parts_cad_id_idx" ON "cad_pattern_parts"("cad_id");

-- CreateIndex
CREATE INDEX "cad_pattern_parts_pattern_part_id_idx" ON "cad_pattern_parts"("pattern_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "cad_pattern_parts_cad_id_pattern_part_id_key" ON "cad_pattern_parts"("cad_id", "pattern_part_id");

-- AddForeignKey
ALTER TABLE "cad_pattern_parts" ADD CONSTRAINT "cad_pattern_parts_cad_id_fkey" FOREIGN KEY ("cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_pattern_parts" ADD CONSTRAINT "cad_pattern_parts_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "pattern_part_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;
