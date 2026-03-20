/**
 * One-time data fix: update FAB-RDY-0001 → FAB-EMFK00262-002
 * and sync the corresponding materials record.
 *
 * Run: cd backend && npx ts-node scripts/fix-fabric-code-fab-rdy-0001.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFabricCode() {
  const OLD_CODE = 'FAB-RDY-0001';
  const NEW_CODE = 'FAB-EMFK00262-002';

  console.log(`Looking for fabric with code: ${OLD_CODE}`);

  const fabric = await prisma.fabric_master.findFirst({
    where: { fabricCode: OLD_CODE },
    select: { id: true, fabricCode: true, fabricName: true },
  });

  if (!fabric) {
    console.log('Fabric not found — nothing to update.');
    return;
  }

  console.log(`Found fabric: ${fabric.id} — ${fabric.fabricName}`);

  // Update fabric_master.fabricCode
  await prisma.fabric_master.update({
    where: { id: fabric.id },
    data: { fabricCode: NEW_CODE },
  });
  console.log(`✅ fabric_master.fabricCode updated: ${OLD_CODE} → ${NEW_CODE}`);

  // Sync materials.code
  const materialsUpdated = await prisma.materials.updateMany({
    where: { fabricId: fabric.id },
    data: { code: NEW_CODE },
  });
  console.log(`✅ materials.code synced: ${materialsUpdated.count} record(s) updated`);

  console.log('\nDone.');
}

fixFabricCode()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
