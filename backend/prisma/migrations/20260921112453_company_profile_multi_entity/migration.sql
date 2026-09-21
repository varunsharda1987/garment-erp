-- AlterTable
ALTER TABLE "company_profile" ADD COLUMN     "brandColorAccent" TEXT,
ADD COLUMN     "brandColorHeader" TEXT,
ADD COLUMN     "brandColorMuted" TEXT,
ADD COLUMN     "brandColorPrimary" TEXT,
ADD COLUMN     "brandColorText" TEXT,
ADD COLUMN     "cin" TEXT,
ADD COLUMN     "iec" TEXT,
ADD COLUMN     "invoiceTerms" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "msmeNumber" TEXT,
ADD COLUMN     "stateId" TEXT,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "tan" TEXT;

-- CreateIndex
CREATE INDEX "company_profile_isDefault_idx" ON "company_profile"("isDefault");

-- AddForeignKey
ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "indian_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: promote exactly one existing row so the invariant below holds from the first
-- moment it is enforced. Oldest active row wins; an empty table stays empty and
-- companyProfileService.ensureSeededAndWarm() creates row #1 from COMPANY_CONFIG at boot.
UPDATE "company_profile" SET "isDefault" = true
WHERE "id" = (
  SELECT "id" FROM "company_profile"
  WHERE "isActive" = true
  ORDER BY "createdAt" ASC
  LIMIT 1
);

-- THE invariant: at most one default entity, ever. Prisma cannot express a partial unique
-- index, so it lives here as raw SQL — it will NOT be regenerated if you drop it, and losing
-- it means two rows can claim default and documents silently pick one at random.
CREATE UNIQUE INDEX "company_profile_single_default" ON "company_profile"("isDefault") WHERE "isDefault" = true;
