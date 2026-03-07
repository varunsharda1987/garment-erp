const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fixBomLinks() {
  const orderId = '7b7f72f7-baf3-481c-b3d1-cf1238a40c4c';

  const bom = await p.order_bom.findFirst({
    where: { orderId, isActive: true },
    include: { items: true }
  });

  if (!bom) {
    console.log('No active BOM found');
    return;
  }

  console.log('BOM ID:', bom.id);
  console.log('Fixing', bom.items.length, 'items...\n');

  for (const item of bom.items) {
    console.log('---');
    console.log('Processing:', item.componentName, '| Type:', item.materialType);

    if (item.materialType === 'BUTTON' && !item.materialId) {
      // Find button by name
      const button = await p.button_master.findFirst({
        where: { buttonName: { contains: item.componentName.replace(' 16L', ''), mode: 'insensitive' } }
      });
      if (button) {
        // Find materials record
        const mat = await p.materials.findFirst({ where: { buttonId: button.id } });
        if (mat) {
          await p.order_bom_items.update({
            where: { id: item.id },
            data: { materialId: mat.id, buttonId: button.id }
          });
          console.log('  -> Linked to button:', button.buttonCode, '| materialId:', mat.id);
        }
      } else {
        console.log('  -> Button not found');
      }
    }

    if (item.materialType === 'FABRIC' && !item.materialId && !item.fabricId) {
      // Find fabric by name
      const fabric = await p.fabric_master.findFirst({
        where: { fabricName: { contains: 'Cotton Flex', mode: 'insensitive' } }
      });
      if (fabric) {
        // Find materials record
        const mat = await p.materials.findFirst({ where: { fabricId: fabric.id } });
        await p.order_bom_items.update({
          where: { id: item.id },
          data: {
            fabricId: fabric.id,
            materialId: mat ? mat.id : null
          }
        });
        console.log('  -> Linked to fabric:', fabric.fabricCode, '| fabricId:', fabric.id, '| materialId:', mat?.id);
      } else {
        console.log('  -> Fabric not found');
      }
    }

    if (item.materialType === 'THREAD' && !item.materialId) {
      // Find thread materials record
      const mat = await p.materials.findFirst({
        where: { materialType: 'THREAD' },
        orderBy: { createdAt: 'asc' }
      });
      if (mat) {
        await p.order_bom_items.update({
          where: { id: item.id },
          data: { materialId: mat.id, threadId: mat.threadId }
        });
        console.log('  -> Linked to thread materialId:', mat.id);
      } else {
        console.log('  -> No thread materials found');
      }
    }
  }

  console.log('\nDone! Run MRP calculation again.');
}

fixBomLinks().catch(console.error).finally(() => p.$disconnect());
