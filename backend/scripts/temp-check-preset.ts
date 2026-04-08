import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all accessory presets with name containing nihsamah
  const presets = await prisma.customer_accessories_presets.findMany({
    where: { presetName: { contains: 'nihsamah', mode: 'insensitive' } },
    include: {
      customer: { select: { customerName: true } },
      items: {
        include: {
          label: { select: { id: true, labelCode: true, labelName: true } },
          material: { select: { id: true, code: true, name: true, packagingId: true } }
        }
      }
    }
  });
  
  console.log('Found presets:', presets.length);
  for (const p of presets) {
    console.log('\nPreset:', p.presetName, '| Customer:', p.customer?.customerName, '| isActive:', p.isActive);
    console.log('Items count:', p.items?.length || 0);
    if (p.items) {
      for (const item of p.items) {
        console.log('  -', item.materialType, 
          'labelId:', item.labelId || 'null', 
          'materialId:', item.materialId || 'null',
          'label:', item.label?.labelCode || 'null',
          'material:', item.material?.code || 'null'
        );
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
