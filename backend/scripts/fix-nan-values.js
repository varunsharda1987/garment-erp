const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNaNValues() {
  try {
    console.log('Finding greige records with NaN values...');

    // Find all greige masters
    const allGreige = await prisma.greige_master.findMany();

    let fixed = 0;
    for (const greige of allGreige) {
      let needsUpdate = false;
      const updates = {};

      // Check if greigeWidth is NaN
      if (isNaN(Number(greige.greigeWidth)) || greige.greigeWidth === null) {
        console.log(`Found NaN width in ${greige.greigeCode}: ${greige.greigeName}`);

        // Try to extract width from greige name (format: "Name Count / Construction / Width"")
        const nameParts = greige.greigeName.split('/');
        if (nameParts.length >= 3) {
          const widthPart = nameParts[2].trim().replace(/"/g, '').replace(/[^0-9.]/g, '');
          const extractedWidth = parseFloat(widthPart);
          if (!isNaN(extractedWidth) && extractedWidth > 0) {
            updates.greigeWidth = extractedWidth;
            needsUpdate = true;
            console.log(`  -> Extracted width from name: ${extractedWidth}`);
          }
        }

        // If we couldn't extract, set a default
        if (!updates.greigeWidth) {
          updates.greigeWidth = 60; // Default width
          console.log(`  -> Using default width: 60`);
        }
      }

      // Check if averageShrinkagePercent is NaN
      if (isNaN(Number(greige.averageShrinkagePercent)) || greige.averageShrinkagePercent === null) {
        console.log(`Found NaN shrinkage in ${greige.greigeCode}`);
        updates.averageShrinkagePercent = 8.0; // Default shrinkage
        needsUpdate = true;
        console.log(`  -> Using default shrinkage: 8.0`);
      }

      // Update if needed
      if (needsUpdate) {
        await prisma.greige_master.update({
          where: { id: greige.id },
          data: updates,
        });
        fixed++;
        console.log(`Fixed ${greige.greigeCode}\n`);
      }
    }

    console.log(`\nCompleted! Fixed ${fixed} records.`);
  } catch (error) {
    console.error('Error fixing NaN values:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixNaNValues();
