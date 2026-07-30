-- Add explicit TBD marker for job-work rates: rate=0 is ambiguous (free? unset?), so the
-- quick-issue/processing flow marks intentional to-be-decided rates with isRateTbd=true.
-- Additive + idempotent (IF NOT EXISTS), matching the hand-authored precedent of
-- 20260729000000_add_gram_liter_roll_units. Applied by `prisma migrate deploy` inside npm run deploy.
ALTER TABLE "job_work_orders" ADD COLUMN IF NOT EXISTS "isRateTbd" BOOLEAN NOT NULL DEFAULT false;
