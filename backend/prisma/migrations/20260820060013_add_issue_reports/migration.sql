-- CreateTable
CREATE TABLE "issue_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "screenshot_url" TEXT,
    "page_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_reports_user_id_idx" ON "issue_reports"("user_id");

-- CreateIndex
CREATE INDEX "issue_reports_status_idx" ON "issue_reports"("status");

-- AddForeignKey
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
