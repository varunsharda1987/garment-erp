import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generates lace name following the consistent naming convention:
 * - GREIGE:    {laceCode} | {laceType} | {composition} | {width}" | GREIGE
 * - READY:     {laceCode} | {laceType} | {composition} | {width}" | {color}
 * - PROCESSED: {laceCode} | {laceType} | {composition} | {width}" | {color} | {sourceGreigeCode} → {styleCode}
 */
function generateLaceName(lace: {
  laceCode: string;
  laceType?: string | null;
  composition?: string | null;
  width?: any; // Decimal from Prisma
  color?: string | null;
  isGreige: boolean;
  sourceGreigeLaceCode?: string | null;
  processedForStyleCode?: string | null;
}): string {
  const parts: string[] = [lace.laceCode];

  // Add laceType (use 'Lace' as fallback)
  parts.push(lace.laceType || 'Lace');

  // Add composition if present
  if (lace.composition) {
    parts.push(lace.composition);
  }

  // Add width if present
  if (lace.width) {
    const widthNum = parseFloat(String(lace.width));
    parts.push(`${widthNum}"`);
  }

  // Type-specific suffix
  if (lace.isGreige) {
    parts.push('GREIGE');
  } else if (lace.sourceGreigeLaceCode) {
    // Processed lace
    parts.push(lace.color || 'Unspecified');
    parts.push(`${lace.sourceGreigeLaceCode} → ${lace.processedForStyleCode || '?'}`);
  } else {
    // Ready lace
    parts.push(lace.color || 'Unspecified');
  }

  return parts.join(' | ');
}

async function updateLaceNames() {
  console.log('=== Updating ALL Lace Names to Follow Naming Convention ===\n');
  console.log('Convention:');
  console.log('  GREIGE:    {code} | {type} | {composition} | {width}" | GREIGE');
  console.log('  READY:     {code} | {type} | {composition} | {width}" | {color}');
  console.log('  PROCESSED: {code} | {type} | {composition} | {width}" | {color} | {greige} → {style}\n');

  // Get all laces with their source greige info
  const allLaces = await prisma.lace_master.findMany({
    include: {
      sourceGreigeLace: true,
    },
    orderBy: { laceCode: 'asc' },
  });

  console.log(`Total laces: ${allLaces.length}\n`);

  // Categorize laces
  const greigeLaces = allLaces.filter(l => l.isGreige);
  const processedLaces = allLaces.filter(l => !l.isGreige && l.sourceGreigeLaceId);
  const readyLaces = allLaces.filter(l => !l.isGreige && !l.sourceGreigeLaceId);

  console.log(`Greige laces: ${greigeLaces.length}`);
  console.log(`Ready laces: ${readyLaces.length}`);
  console.log(`Processed laces: ${processedLaces.length}\n`);

  let totalUpdated = 0;

  // Update GREIGE laces
  console.log('--- GREIGE Laces ---\n');
  for (const lace of greigeLaces) {
    const newName = generateLaceName({
      laceCode: lace.laceCode,
      laceType: lace.laceType,
      composition: lace.composition,
      width: lace.width,
      color: lace.color,
      isGreige: true,
      sourceGreigeLaceCode: null,
      processedForStyleCode: null,
    });

    if (lace.laceName !== newName) {
      await prisma.lace_master.update({
        where: { id: lace.id },
        data: { laceName: newName },
      });
      console.log(`  ${lace.laceCode}: "${lace.laceName}" → "${newName}"`);
      totalUpdated++;
    } else {
      console.log(`  ${lace.laceCode}: Already correct`);
    }
  }

  // Update READY laces
  console.log('\n--- READY Laces ---\n');
  for (const lace of readyLaces) {
    const newName = generateLaceName({
      laceCode: lace.laceCode,
      laceType: lace.laceType,
      composition: lace.composition,
      width: lace.width,
      color: lace.color,
      isGreige: false,
      sourceGreigeLaceCode: null,
      processedForStyleCode: null,
    });

    if (lace.laceName !== newName) {
      await prisma.lace_master.update({
        where: { id: lace.id },
        data: { laceName: newName },
      });
      console.log(`  ${lace.laceCode}: "${lace.laceName}" → "${newName}"`);
      totalUpdated++;
    } else {
      console.log(`  ${lace.laceCode}: Already correct`);
    }
  }

  // Update PROCESSED laces
  console.log('\n--- PROCESSED Laces ---\n');
  for (const lace of processedLaces) {
    const newName = generateLaceName({
      laceCode: lace.laceCode,
      laceType: lace.laceType,
      composition: lace.composition,
      width: lace.width,
      color: lace.color,
      isGreige: false,
      sourceGreigeLaceCode: lace.sourceGreigeLace?.laceCode || null,
      processedForStyleCode: lace.processedForStyleCode,
    });

    if (lace.laceName !== newName) {
      await prisma.lace_master.update({
        where: { id: lace.id },
        data: { laceName: newName },
      });
      console.log(`  ${lace.laceCode}: "${lace.laceName}" → "${newName}"`);
      totalUpdated++;
    } else {
      console.log(`  ${lace.laceCode}: Already correct`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total updated: ${totalUpdated} lace(s)`);
  console.log('=== Done ===');
}

updateLaceNames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
