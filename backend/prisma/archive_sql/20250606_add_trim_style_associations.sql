-- Migration: Add Trim Style Associations (Many-to-Many)
-- Purpose: Replace buyerCode with style code references for Lace, Button, and Thread masters
-- Each trim can be associated with multiple styles for searchability

-- ============================================
-- LACE STYLE ASSOCIATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "lace_style_associations" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "laceId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lace_style_associations_laceId_fkey"
        FOREIGN KEY ("laceId") REFERENCES "lace_master"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lace_style_associations_styleId_fkey"
        FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint to prevent duplicate associations
ALTER TABLE "lace_style_associations"
ADD CONSTRAINT "lace_style_associations_laceId_styleId_key"
UNIQUE ("laceId", "styleId");

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "lace_style_associations_laceId_idx" ON "lace_style_associations"("laceId");
CREATE INDEX IF NOT EXISTS "lace_style_associations_styleId_idx" ON "lace_style_associations"("styleId");

-- ============================================
-- BUTTON STYLE ASSOCIATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "button_style_associations" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "buttonId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "button_style_associations_buttonId_fkey"
        FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "button_style_associations_styleId_fkey"
        FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint to prevent duplicate associations
ALTER TABLE "button_style_associations"
ADD CONSTRAINT "button_style_associations_buttonId_styleId_key"
UNIQUE ("buttonId", "styleId");

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "button_style_associations_buttonId_idx" ON "button_style_associations"("buttonId");
CREATE INDEX IF NOT EXISTS "button_style_associations_styleId_idx" ON "button_style_associations"("styleId");

-- ============================================
-- THREAD STYLE ASSOCIATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "thread_style_associations" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "threadId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_style_associations_threadId_fkey"
        FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "thread_style_associations_styleId_fkey"
        FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint to prevent duplicate associations
ALTER TABLE "thread_style_associations"
ADD CONSTRAINT "thread_style_associations_threadId_styleId_key"
UNIQUE ("threadId", "styleId");

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "thread_style_associations_threadId_idx" ON "thread_style_associations"("threadId");
CREATE INDEX IF NOT EXISTS "thread_style_associations_styleId_idx" ON "thread_style_associations"("styleId");

-- ============================================
-- DEPRECATION COMMENTS
-- ============================================

-- Mark buyerCode as deprecated (keeping for backward compatibility)
COMMENT ON COLUMN "lace_master"."buyerCode" IS 'DEPRECATED: Use lace_style_associations instead. Will be removed in future version.';
COMMENT ON COLUMN "button_master"."buyerCode" IS 'DEPRECATED: Use button_style_associations instead. Will be removed in future version.';
COMMENT ON COLUMN "thread_master"."buyerCode" IS 'DEPRECATED: Use thread_style_associations instead. Will be removed in future version.';
