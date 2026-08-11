-- CreateTable
CREATE TABLE "cad_purpose_files" (
    "id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    "purpose" "CadPurpose" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "file_size" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cad_purpose_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cad_purpose_files_style_id_purpose_idx" ON "cad_purpose_files"("style_id", "purpose");

-- AddForeignKey
ALTER TABLE "cad_purpose_files" ADD CONSTRAINT "cad_purpose_files_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_purpose_files" ADD CONSTRAINT "cad_purpose_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
