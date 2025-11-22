const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validate() {
  console.log('\n📊 Phase 2 Migration Validation\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const greiges = await prisma.greige_master.count();
  const fabrics = await prisma.fabric_master.count();
  const materials = await prisma.materials.count({
    where: {
      materialType: { in: ['GREIGE_FABRIC', 'FINISHED_FABRIC'] },
    },
  });
  const linkedStyleFabrics = await prisma.style_fabrics.count({
    where: { fabricId: { not: null } },
  });
  const totalStyleFabrics = await prisma.style_fabrics.count();

  console.log('✅ Greige Masters Created:', greiges);
  console.log('✅ Fabric Masters Created:', fabrics);
  console.log('✅ Materials Entries (Fabric types):', materials);
  console.log('✅ Style Fabrics Linked:', linkedStyleFabrics, '/', totalStyleFabrics);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Show sample data
  const sampleFabric = await prisma.fabric_master.findFirst({
    include: {
      greige: true,
      styleFabrics: true,
    },
  });

  if (sampleFabric) {
    console.log('📋 Sample Fabric Master:\n');
    console.log('Code:', sampleFabric.fabricCode);
    console.log('Name:', sampleFabric.fabricName);
    console.log('Greige Base:', sampleFabric.greige?.greigeName);
    console.log('Width:', sampleFabric.actualWidth, '"');
    console.log('Cost/Meter: $', sampleFabric.costPerMeter.toString());
    console.log('Style Fabrics Using:', sampleFabric.styleFabrics.length);
  }

  console.log('\n✅ Migration validation complete!\n');

  await prisma.$disconnect();
}

validate().catch((e) => {
  console.error('❌ Validation failed:', e);
  process.exit(1);
});
