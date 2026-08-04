-- CreateEnum
CREATE TYPE "GreigeQuality" AS ENUM ('PRINTING', 'DYEING', 'SUPER_DYEING');

-- AlterTable
ALTER TABLE "greige_master" ADD COLUMN     "greigeQuality" "GreigeQuality";
