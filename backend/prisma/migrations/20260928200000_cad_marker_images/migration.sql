-- CAD marker images (2026-09-28): an uploaded CAD image can be a CAD row's marker, with what the
-- marker reader (backend/ocr) read from it; a row keeps the reason its values were saved although they
-- differ from the image. Rule: services/helpers/cad-marker.helper.ts.

-- CreateEnum
CREATE TYPE "MarkerReadStatus" AS ENUM ('READ', 'PARTIAL', 'UNREADABLE', 'READER_UNAVAILABLE');

-- AlterTable
ALTER TABLE "fabric_width_cad" ADD COLUMN     "marker_override_at" TIMESTAMP(3),
ADD COLUMN     "marker_override_by_id" TEXT,
ADD COLUMN     "marker_override_differences" JSONB,
ADD COLUMN     "marker_override_reason" TEXT;

-- AlterTable
ALTER TABLE "cad_corrections" ADD COLUMN     "markerFileId" TEXT;

-- AlterTable
ALTER TABLE "cad_purpose_files" ADD COLUMN     "cad_id" TEXT,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "read_efficiency_pct" DECIMAL(5,2),
ADD COLUMN     "read_error" TEXT,
ADD COLUMN     "read_length_m" DECIMAL(10,4),
ADD COLUMN     "read_placed" INTEGER,
ADD COLUMN     "read_sizes" JSONB,
ADD COLUMN     "read_status" "MarkerReadStatus",
ADD COLUMN     "read_text" TEXT,
ADD COLUMN     "read_title" TEXT,
ADD COLUMN     "read_total" INTEGER,
ADD COLUMN     "read_width_in" DECIMAL(10,2),
ADD COLUMN     "reader_version" TEXT,
ADD COLUMN     "replaced_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "cad_purpose_files_cad_id_idx" ON "cad_purpose_files"("cad_id");

-- AddForeignKey
ALTER TABLE "cad_corrections" ADD CONSTRAINT "cad_corrections_markerFileId_fkey" FOREIGN KEY ("markerFileId") REFERENCES "cad_purpose_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_purpose_files" ADD CONSTRAINT "cad_purpose_files_cad_id_fkey" FOREIGN KEY ("cad_id") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One CURRENT marker image per CAD row. Prisma cannot express a partial unique index — do not drop it;
-- a replaced image keeps its cad_id (the row's history) with replaced_at set.
CREATE UNIQUE INDEX "cad_marker_one_current" ON "cad_purpose_files"("cad_id") WHERE "cad_id" IS NOT NULL AND "replaced_at" IS NULL;
