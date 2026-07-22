// Find which greige masters are missing materials records
import prisma from '../src/config/database';

async function findMissingGreige() {
  // Get all greige IDs that have materials records
  const materialsWithGreige = await prisma.materials.findMany({
    where: { greigeId: { not: null } },
    select: { greigeId: true }
  });
  const greigeIdsWithMaterial = new Set(materialsWithGreige.map(m => m.greigeId));

  // Get all greige masters
  const allGreige = await prisma.greige_master.findMany({
    select: { id: true, greigeCode: true, greigeName: true, isActive: true, createdAt: true }
  });

  // Find missing
  const missing = allGreige.filter(g => !greigeIdsWithMaterial.has(g.id));

  console.log('=== Greige Masters MISSING materials records ===');
  console.log(`Total missing: ${missing.length}`);
  for (const g of missing) {
    console.log(`  ${g.greigeCode} - ${g.greigeName} (active: ${g.isActive}, created: ${g.createdAt.toISOString().split('T')[0]})`);
  }

  await prisma.$disconnect();
}

findMissingGreige().catch(console.error);
