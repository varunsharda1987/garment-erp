-- AlterTable
ALTER TABLE "company_profile" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- One-time data split: two different contacts had been sharing one pair of columns.
--
-- `phone`/`email` on this row held the TRF/lab contact (the person a buyer's testing lab
-- rings), while invoices, purchase orders and challans printed a DIFFERENT accounts-side
-- contact hardcoded in backend/src/config/company.config.ts. Consolidating identity onto this
-- table without separating them would have made customers ring the merchandiser about a bill.
--
-- Step 1: preserve the existing lab contact in its own columns.
UPDATE "company_profile"
SET "contactPhone" = "phone",
    "contactEmail" = "email"
WHERE "contactPhone" IS NULL AND "contactEmail" IS NULL;

-- Step 2: put the accounts contact — the values these documents have actually been printing —
-- into the main columns. Scoped to the one real entity by GSTIN so it cannot touch a second
-- entity added later.
UPDATE "company_profile"
SET "phone" = '8890729433',
    "email" = 'kashayafabs.acc@gmail.com'
WHERE "gstin" = '08DCDPS0146D1ZU';
