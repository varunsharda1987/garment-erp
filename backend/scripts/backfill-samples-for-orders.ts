/**
 * Backfill Samples for Existing Orders
 *
 * Creates samples for all existing orders based on customer sample requirements.
 * Safe to run multiple times - skips samples that already exist.
 *
 * Usage: cd backend && npx ts-node scripts/backfill-samples-for-orders.ts
 */

import { PrismaClient, SampleType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Lead days before ship date for each sample type
const SAMPLE_LEAD_DAYS: Record<SampleType, number> = {
  FIT_SAMPLE: 21,
  PP_SAMPLE: 14,
  SIZE_SET_SAMPLE: 10,
  PHOTO_SAMPLE: 7,
  PRODUCTION_SAMPLE: 5,
  SHIPMENT_SAMPLE: 3,
};

async function generateSampleNumber(sampleType: SampleType): Promise<string> {
  const prefix = sampleType.replace('_SAMPLE', '').replace(/_/g, '');
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find the highest existing number for this prefix/month
  const existing = await prisma.samples.findMany({
    where: {
      sampleNumber: {
        startsWith: `${prefix}${yymm}-`,
      },
    },
    select: { sampleNumber: true },
    orderBy: { sampleNumber: 'desc' },
    take: 1,
  });

  let nextSeq = 1;
  if (existing.length > 0) {
    const lastNum = existing[0].sampleNumber;
    const seqPart = lastNum.split('-')[1];
    if (seqPart) {
      nextSeq = parseInt(seqPart, 10) + 1;
    }
  }

  return `${prefix}${yymm}-${String(nextSeq).padStart(4, '0')}`;
}

async function backfillSamples() {
  console.log('=== Backfill Samples for Existing Orders ===\n');

  // 1. Get all orders with their items and customer
  const orders = await prisma.orders.findMany({
    include: {
      customers: true,
      order_items: {
        include: {
          styles: {
            select: { id: true, styleCode: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${orders.length} orders to process\n`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let customersWithoutRequirements = new Set<string>();

  for (const order of orders) {
    const customerId = order.customerId;
    const customerName = order.customers?.name || 'Unknown';

    // 2. Get customer sample requirements
    const requirements = await prisma.customer_sample_requirements.findMany({
      where: {
        customerId,
        isRequired: true,
      },
    });

    if (requirements.length === 0) {
      customersWithoutRequirements.add(`${customerName} (${customerId})`);
      continue;
    }

    // 3. Get unique styles from order items
    const styleIds = [...new Set(order.order_items.map(item => item.styleId))];
    const shipDate = order.expectedDeliveryDate || order.createdAt;

    console.log(`Order ${order.orderNumber}: ${styleIds.length} styles, ${requirements.length} sample types required`);

    for (const styleId of styleIds) {
      const style = order.order_items.find(i => i.styleId === styleId)?.styles;

      for (const req of requirements) {
        // 4. Check if sample already exists
        const existing = await prisma.samples.findFirst({
          where: {
            styleId,
            customerId,
            sampleType: req.sampleType,
          },
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        // 5. Calculate required date
        const leadDays = SAMPLE_LEAD_DAYS[req.sampleType] || 14;
        const requiredDate = new Date(shipDate);
        requiredDate.setDate(requiredDate.getDate() - leadDays);

        // 6. Generate sample number
        const sampleNumber = await generateSampleNumber(req.sampleType);

        // 7. Create sample
        // Get a system user for createdById (first admin user)
        const systemUser = await prisma.users.findFirst({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true },
        });

        await prisma.samples.create({
          data: {
            id: randomUUID(),
            sampleNumber,
            customerId,
            styleId,
            sampleType: req.sampleType,
            status: 'REQUESTED',
            requestDate: new Date(),
            requiredDate,
            version: 1,
            remarks: `Auto-created for order ${order.orderNumber}`,
            createdById: systemUser?.id || 'system',
          },
        });

        totalCreated++;
        console.log(`  ✓ Created ${req.sampleType} for ${style?.styleCode || styleId}`);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Samples created: ${totalCreated}`);
  console.log(`Samples skipped (already exist): ${totalSkipped}`);

  if (customersWithoutRequirements.size > 0) {
    console.log(`\nCustomers without sample requirements configured:`);
    customersWithoutRequirements.forEach(c => console.log(`  - ${c}`));
    console.log('\nTo configure: Masters → Customers → Edit → Sample Requirements section');
  }
}

backfillSamples()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
