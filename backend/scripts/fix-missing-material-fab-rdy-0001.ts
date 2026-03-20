/**
 * One-time fix: create the missing materials record for fabric FAB-EMFK00262-002
 * (was never created because the controller bypassed materialService.createFromMaster)
 *
 * Run: cd backend && npx ts-node scripts/fix-missing-material-fab-rdy-0001.ts
 */

import { materialService } from '../src/services/material.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingMaterial() {
  const FABRIC_CODE = 'FAB-EMFK00262-002';

  const fabric = await prisma.fabric_master.findFirst({
    where: { fabricCode: FABRIC_CODE },
    select: { id: true, fabricCode: true, fabricName: true },
  });

  if (!fabric) {
    console.log(`Fabric ${FABRIC_CODE} not found.`);
    return;
  }

  console.log(`Found fabric: ${fabric.id} — ${fabric.fabricName}`);

  // Check if materials record already exists
  const existing = await prisma.materials.findUnique({ where: { id: fabric.id } });
  if (existing) {
    console.log(`Materials record already exists: ${existing.code}`);
    return;
  }

  const material = await materialService.createFromMaster(
    { id: fabric.id, code: fabric.fabricCode, name: fabric.fabricName },
    'FABRIC'
  );

  console.log(`✅ Materials record created: id=${material.id}, code=${material.code}`);
}

fixMissingMaterial()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
