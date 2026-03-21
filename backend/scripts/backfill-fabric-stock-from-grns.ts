import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function backfillFabricStock(): Promise<void> {
  console.log(`Starting fabric_stock backfill... ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}\n`);

  // Find all approved FABRIC PO GRNs
  const fabricGRNs = await prisma.goods_receiving_notes.findMany({
    where: {
      status: 'ACCEPTED',
      purchase_orders: {
        poCategory: 'FABRIC',
      },
    },
    include: {
      grn_items: {
        include: {
          purchase_order_items: {
            select: { unitPrice: true },
          },
          materials: {
            select: {
              id: true,
              name: true,
              fabricId: true,
              fabric_master: {
                select: { id: true, fabricCode: true, actualWidth: true, cutableWidth: true },
              },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${fabricGRNs.length} approved FABRIC GRNs to process\n`);

  let created = 0;
  let skipped = 0;
  let noFabricLink = 0;

  for (const grn of fabricGRNs) {
    console.log(`Processing GRN: ${grn.grnNumber}`);

    for (const item of grn.grn_items) {
      const acceptedQty = Number(item.acceptedQuantity);
      if (acceptedQty <= 0) {
        skipped++;
        continue;
      }

      const material = item.materials;
      if (!material?.fabricId || !material.fabric_master) {
        console.log(`  SKIP item ${item.id}: material "${material?.name || item.materialId}" has no fabric_master link`);
        noFabricLink++;
        continue;
      }

      const fabric = material.fabric_master;

      // Check if fabric_stock already exists for this GRN item (idempotent)
      const existingStock = await prisma.fabric_stock.findFirst({
        where: {
          fabricId: fabric.id,
          receivedDate: grn.receivingDate,
          quantityAvailable: acceptedQty,
        },
      });

      if (existingStock) {
        console.log(`  SKIP ${fabric.fabricCode}: fabric_stock already exists`);
        skipped++;
        continue;
      }

      const unitPrice = item.purchase_order_items
        ? Number(item.purchase_order_items.unitPrice)
        : 0;
      const actualWidth = Number(fabric.actualWidth || 0);
      const cutableWidth = Number(
        fabric.cutableWidth || (actualWidth > 2 ? actualWidth - 2 : actualWidth)
      );

      if (!DRY_RUN) {
        await prisma.fabric_stock.create({
          data: {
            fabricId: fabric.id,
            finishedWidth: actualWidth,
            cutableWidth: cutableWidth,
            quantityAvailable: acceptedQty,
            quantityReserved: 0,
            quantityConsumed: 0,
            unit: 'meters',
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            qualityGrade: 'A',
            weightedAvgCost: unitPrice,
            purchaseCost: unitPrice,
            receivedDate: grn.receivingDate || new Date(),
            createdById: grn.receivedById,
          },
        });
      }

      console.log(`  ${DRY_RUN ? 'WOULD CREATE' : 'CREATED'} fabric_stock: ${acceptedQty}m of ${fabric.fabricCode}`);
      created++;
    }
  }

  console.log(`\n=== Backfill Complete ===`);
  console.log(`Created:        ${created}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`No fabric link: ${noFabricLink}`);
  if (noFabricLink > 0) {
    console.log(`\nWARNING: ${noFabricLink} item(s) had no fabric_master link.`);
    console.log(`These materials need fabricId set in the materials table before they can be backfilled.`);
  }
}

async function main(): Promise<void> {
  try {
    await backfillFabricStock();
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
