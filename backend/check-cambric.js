const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const greiges = await prisma.greige_master.findMany({
    where: {
      genericFabricName: {
        contains: 'Cambric',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      greigeCode: true,
      greigeName: true,
      genericFabricName: true,
      isActive: true
    }
  });

  console.log('Greige records with Cambric:');
  greiges.forEach(g => {
    console.log('  -', g.greigeCode, '|', g.greigeName, '| generic:', g.genericFabricName, '| active:', g.isActive);
  });

  const styleFabrics = await prisma.style_fabrics.findMany({
    where: {
      genericFabricName: {
        contains: 'Cambric',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      genericFabricName: true,
      fabricFinishType: true
    }
  });

  console.log('\nStyle fabrics with Cambric:');
  styleFabrics.forEach(f => {
    console.log('  -', f.genericFabricName, '| finish:', f.fabricFinishType);
  });

  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
