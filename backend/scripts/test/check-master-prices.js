const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMasterPrices() {
  try {
    // 1. Get the style and its BOM
    const style = await prisma.styles.findFirst({
      where: { styleCode: 'LNG204P' },
      select: { id: true, styleCode: true }
    });

    if (!style) {
      console.log('❌ Style LNG204P NOT FOUND');
      await prisma.$disconnect();
      return;
    }

    console.log(`\n=== CHECKING MASTER PRICES FOR ${style.styleCode} ===\n`);

    // 2. Get all accessories from BOM
    const materialBom = await prisma.style_material_bom.findMany({
      where: {
        styleId: style.id,
        OR: [
          { materialType: 'LABEL' },
          { materialType: 'PACKAGING' }
        ]
      },
      select: {
        id: true,
        materialType: true,
        componentName: true,
        labelId: true,
        packagingId: true,
        unitPrice: true,
        quantityPerGarment: true,
        unit: true
      }
    });

    console.log(`Found ${materialBom.length} accessories in BOM\n`);

    // 3. Check each accessory
    for (const bom of materialBom) {
      console.log(`--- ${bom.componentName} ---`);
      console.log(`Material Type: ${bom.materialType}`);
      console.log(`BOM Unit Price: ${bom.unitPrice || 'NOT SET'}`);
      console.log(`BOM Quantity: ${bom.quantityPerGarment || 0} ${bom.unit || ''}`);

      if (bom.materialType === 'LABEL' && bom.labelId) {
        const label = await prisma.label_master.findUnique({
          where: { id: bom.labelId },
          select: {
            id: true,
            labelCode: true,
            labelName: true,
            pricePerPiece: true
          }
        });

        if (label) {
          console.log(`Label Master Found: ${label.labelCode} - ${label.labelName}`);
          console.log(`Master Price Per Piece: ₹${label.pricePerPiece || '0.00 (NOT SET)'}`);
        } else {
          console.log(`⚠️  Label Master NOT FOUND for ID: ${bom.labelId}`);
        }
      } else if (bom.materialType === 'PACKAGING' && bom.packagingId) {
        const packaging = await prisma.packaging_master.findUnique({
          where: { id: bom.packagingId },
          select: {
            id: true,
            packagingCode: true,
            packagingName: true,
            pricePerPiece: true
          }
        });

        if (packaging) {
          console.log(`Packaging Master Found: ${packaging.packagingCode} - ${packaging.packagingName}`);
          console.log(`Master Price Per Piece: ₹${packaging.pricePerPiece || '0.00 (NOT SET)'}`);
        } else {
          console.log(`⚠️  Packaging Master NOT FOUND for ID: ${bom.packagingId}`);
        }
      } else {
        console.log(`⚠️  No master ID set for this item`);
      }

      console.log('');
    }

    // 4. Summary
    console.log('=== SUMMARY ===');
    const labelCount = materialBom.filter(b => b.materialType === 'LABEL').length;
    const packagingCount = materialBom.filter(b => b.materialType === 'PACKAGING').length;
    const bomWithPrice = materialBom.filter(b => b.unitPrice && b.unitPrice > 0).length;

    console.log(`Total LABEL items: ${labelCount}`);
    console.log(`Total PACKAGING items: ${packagingCount}`);
    console.log(`Items with BOM price set: ${bomWithPrice}/${materialBom.length}`);
    console.log(`\nIf master prices are NOT SET, that's why rates aren't populating in cost sheet.`);

  } catch (e) {
    console.error('❌ ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkMasterPrices();
