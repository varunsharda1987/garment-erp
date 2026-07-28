-- Per-user WhatsApp feature — ISOLATED migration (only these 3 additive, nullable columns).
-- Phase 1: each user's own WhatsApp number (used as an internal-messaging recipient).
ALTER TABLE "users" ADD COLUMN "whatsappNumber" TEXT;

-- Phase 3: audit of the "sample couriered → buyer notified on WhatsApp" action.
ALTER TABLE "samples" ADD COLUMN "buyerNotifiedAt" TIMESTAMP(3);
ALTER TABLE "samples" ADD COLUMN "buyerNotifiedTo" TEXT;
