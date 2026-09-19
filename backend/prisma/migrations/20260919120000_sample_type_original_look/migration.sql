-- Catch-up migration.
--
-- ORIGINAL_SAMPLE and LOOK_SAMPLE were added to the SampleType enum in schema.prisma and
-- applied to the live database out of band, so the running system already has them
-- (verified against pg_enum on 2026-09-19) and sample.service.ts + the sample pages use
-- them. What was missing was this file: nothing in migration history recorded the change,
-- so a database rebuilt from migrations would not have the two values.
--
-- Written here so history matches reality. On the live database this migration is marked
-- applied rather than executed (`prisma migrate resolve --applied`); it runs for real only
-- on a fresh build and on the shadow database.
--
-- BEFORE 'FIT_SAMPLE' reproduces the order the values already have in Postgres and in
-- schema.prisma: the sample pipeline reads earliest-to-latest, and ORIGINAL_SAMPLE /
-- LOOK_SAMPLE come before the fit sample (28 and 25 days before ship, against FIT's 21 —
-- see SAMPLE_LEAD_DAYS in sample.service.ts).
--
-- IF NOT EXISTS keeps it idempotent, since the values are already present wherever this
-- has effectively run once.

-- AlterEnum
ALTER TYPE "SampleType" ADD VALUE IF NOT EXISTS 'ORIGINAL_SAMPLE' BEFORE 'FIT_SAMPLE';
ALTER TYPE "SampleType" ADD VALUE IF NOT EXISTS 'LOOK_SAMPLE' BEFORE 'FIT_SAMPLE';
