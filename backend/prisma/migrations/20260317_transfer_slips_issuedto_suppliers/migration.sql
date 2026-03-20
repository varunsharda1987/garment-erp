-- Change transfer_slips.issuedToId FK from users to suppliers
-- Stitching is issued to a contractor (supplier), not a system user

ALTER TABLE "transfer_slips" DROP CONSTRAINT IF EXISTS "transfer_slips_issuedToId_fkey";
ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_issuedToId_fkey"
  FOREIGN KEY ("issuedToId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
