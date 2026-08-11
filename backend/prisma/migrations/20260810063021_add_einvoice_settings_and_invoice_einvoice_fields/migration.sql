-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "eInvoiceCancelReason" TEXT,
ADD COLUMN     "eInvoiceCancelledAt" TIMESTAMP(3),
ADD COLUMN     "eInvoiceLastError" TEXT;

-- CreateTable
CREATE TABLE "einvoice_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "einvEnabled" BOOLEAN NOT NULL DEFAULT false,
    "einvMode" TEXT NOT NULL DEFAULT 'SANDBOX',
    "einvProvider" TEXT NOT NULL DEFAULT 'NIC',
    "einvBaseUrl" TEXT,
    "einvClientId" TEXT NOT NULL DEFAULT '',
    "einvClientSecret" TEXT NOT NULL DEFAULT '',
    "einvApiUsername" TEXT NOT NULL DEFAULT '',
    "einvApiPassword" TEXT NOT NULL DEFAULT '',
    "einvGstin" TEXT NOT NULL DEFAULT '',
    "einvPublicKeyPem" TEXT,
    "einvAutoGenerateOnCreate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "einvoice_settings_pkey" PRIMARY KEY ("id")
);
