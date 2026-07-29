-- Add GRAM, LITER, ROLL to the Unit enum.
-- These units are offered in the app's material unit dropdowns (OtherMaterialForm, StockInForm)
-- and are accepted by the Zod UnitEnum, but were missing from the Prisma Unit enum — so a PO line
-- or an MRP manual requirement carrying one of them wrote a raw invalid value into a non-nullable
-- enum column and 500'd on create. Additive-only; no data change.
-- (bug-hunt pre-existing-error triage: enum-drift ED-03 / ED-04)
ALTER TYPE "Unit" ADD VALUE IF NOT EXISTS 'GRAM';
ALTER TYPE "Unit" ADD VALUE IF NOT EXISTS 'LITER';
ALTER TYPE "Unit" ADD VALUE IF NOT EXISTS 'ROLL';
