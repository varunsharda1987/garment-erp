/**
 * Seed script for Pattern Part to Component Group associations
 * Maps which pattern parts are applicable to which component groups
 *
 * Component Groups:
 * - TOP (Top Wear): Blouse, Shirt, Kameez, Kurti, T-Shirt, Choli
 * - BOTTOM (Bottom Wear): Pants, Skirt, Salwar, Palazzo, Lehenga, Dhoti
 * - FULL (Full Garment): Dress, Gown, Jumpsuit, Saree, Anarkali
 * - INNER (Inner Wear): Lining, Petticoat, Slip, Camisole
 * - OUTER (Outer Wear): Jacket, Shrug, Coat, Blazer, Cape
 * - ACCESS (Accessory): Dupatta, Belt, Scarf, Stole
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define pattern part to component group mappings
const patternPartGroupMappings: Record<string, string[]> = {
  // Body parts - used in most garments
  BODY_FRONT: ['TOP', 'BOTTOM', 'FULL', 'INNER', 'OUTER'],
  BODY_BACK: ['TOP', 'BOTTOM', 'FULL', 'INNER', 'OUTER'],

  // Sleeve - only for upper body and full garments
  SLEEVE: ['TOP', 'FULL', 'OUTER'],

  // Collar - for shirts, blouses, jackets
  COLLAR: ['TOP', 'FULL', 'OUTER'],

  // Cuff - for shirts, blouses, kurtas, jackets
  CUFF: ['TOP', 'FULL', 'OUTER'],

  // Yoke - for shirts, kurtas, dresses
  YOKE: ['TOP', 'FULL'],

  // Pocket - can be on almost anything
  POCKET: ['TOP', 'BOTTOM', 'FULL', 'OUTER'],

  // Waistband - for bottom wear and full garments
  WAISTBAND: ['BOTTOM', 'FULL'],

  // Placket - for shirts, kurtas
  PLACKET: ['TOP', 'FULL'],

  // Gusset - for traditional garments, bottom wear
  GUSSET: ['TOP', 'BOTTOM', 'FULL'],

  // Flap - for jackets, shirts, pants (pockets)
  FLAP: ['TOP', 'BOTTOM', 'OUTER'],

  // Lining - for jackets, blazers, coats, also inner wear
  LINING: ['TOP', 'BOTTOM', 'FULL', 'INNER', 'OUTER'],
};

async function seedPatternPartGroups() {
  console.log('Starting pattern part to component group associations seed...\n');

  // Get all pattern parts
  const patternParts = await prisma.pattern_part_master.findMany({
    where: { isActive: true },
  });
  console.log(`Found ${patternParts.length} active pattern parts`);

  // Get all component groups
  const componentGroups = await prisma.component_group_master.findMany({
    where: { isActive: true },
  });
  console.log(`Found ${componentGroups.length} active component groups`);

  // Create lookup maps
  const patternPartMap = new Map(patternParts.map(pp => [pp.code, pp.id]));
  const groupMap = new Map(componentGroups.map(g => [g.code, g.id]));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process each pattern part
  for (const [patternPartCode, groupCodes] of Object.entries(patternPartGroupMappings)) {
    const patternPartId = patternPartMap.get(patternPartCode);

    if (!patternPartId) {
      console.log(`⚠ Pattern part not found: ${patternPartCode}`);
      errors++;
      continue;
    }

    for (const groupCode of groupCodes) {
      const componentGroupId = groupMap.get(groupCode);

      if (!componentGroupId) {
        console.log(`⚠ Component group not found: ${groupCode}`);
        errors++;
        continue;
      }

      try {
        // Check if association already exists
        const existing = await prisma.pattern_part_groups.findUnique({
          where: {
            patternPartId_componentGroupId: {
              patternPartId,
              componentGroupId,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create the association
        await prisma.pattern_part_groups.create({
          data: {
            patternPartId,
            componentGroupId,
          },
        });
        created++;
        console.log(`✓ ${patternPartCode} → ${groupCode}`);
      } catch (error: any) {
        console.error(`✗ Error creating ${patternPartCode} → ${groupCode}: ${error.message}`);
        errors++;
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Created: ${created} associations`);
  console.log(`Skipped: ${skipped} (already exist)`);
  console.log(`Errors: ${errors}`);
}

async function main() {
  try {
    await seedPatternPartGroups();
    console.log('\nSeed completed successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
