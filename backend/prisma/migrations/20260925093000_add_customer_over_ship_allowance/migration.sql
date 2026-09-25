-- How far over the ordered quantity a size may ship, in percent. 0 = never over (the old rule).
ALTER TABLE "customers" ADD COLUMN "overShipAllowancePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
