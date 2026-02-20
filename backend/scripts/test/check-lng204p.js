const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLNG204P() {
  try {
    // 1. Get the style
    const style = await prisma.styles.findFirst({
      where: { styleCode: 'LNG204P' },
      select: { id: true, styleCode: true, styleName: true, status: true, cadStatus: true, customerAccessoriesPresetId: true }
    });

    if (!style) {
      console.log('❌ Style LNG204P NOT FOUND in database');
      await prisma.$disconnect();
      return;
    }

    console.log('\n=== STYLE FOUND ===');
    console.log(`ID: ${style.id}`);
    console.log(`Code: ${style.styleCode}`);
    console.log(`Name: ${style.styleName}`);
    console.log(`Status: ${style.status}`);
    console.log(`CAD Status: ${style.cadStatus}`);
    console.log(`Customer Accessory Preset ID: ${style.customerAccessoriesPresetId || 'NONE'}\n`);

    // 2. Check style_material_bom
    const materialBom = await prisma.style_material_bom.findMany({
      where: { styleId: style.id },
      include: {
        label_master: { select: { labelCode: true, labelName: true }},
        packaging_master: { select: { packagingCode: true, packagingName: true }}
      },
      orderBy: { sortOrder: 'asc' }
    });

    console.log('=== MATERIAL BOM ===');
    console.log(`Total BOM items: ${materialBom.length}`);

    const labelItems = materialBom.filter(m => m.materialType === 'LABEL');
    const packagingItems = materialBom.filter(m => m.materialType === 'PACKAGING');
    const trimItems = materialBom.filter(m => m.usageCategory === 'GARMENT_TRIM');

    console.log(`LABEL items: ${labelItems.length}`);
    console.log(`PACKAGING items: ${packagingItems.length}`);
    console.log(`GARMENT_TRIM items: ${trimItems.length}\n`);

    if (labelItems.length === 0) {
      console.log('⚠️  WARNING: No LABEL items found in style_material_bom!');
      console.log('This explains why labels are missing in the cost sheet.\n');
    } else {
      console.log('--- LABEL ITEMS ---');
      labelItems.forEach((item, i) => {
        console.log(`\nLabel ${i + 1}:`);
        console.log(`  Material Type: ${item.materialType}`);
        console.log(`  Usage Category: ${item.usageCategory}`);
        console.log(`  Component Name: ${item.componentName}`);
        console.log(`  Label Master: ${item.label_master?.labelCode} - ${item.label_master?.labelName}`);
        console.log(`  Qty: ${item.quantityPerGarment} ${item.unit}`);
      });
      console.log('');
    }

    if (packagingItems.length > 0) {
      console.log('--- PACKAGING ITEMS ---');
      packagingItems.forEach((item, i) => {
        console.log(`\nPackaging ${i + 1}:`);
        console.log(`  Material Type: ${item.materialType}`);
        console.log(`  Usage Category: ${item.usageCategory}`);
        console.log(`  Component Name: ${item.componentName}`);
        console.log(`  Packaging Master: ${item.packaging_master?.packagingCode} - ${item.packaging_master?.packagingName}`);
        console.log(`  Qty: ${item.quantityPerGarment} ${item.unit}`);
      });
      console.log('');
    }

    // 3. Check fabric data
    const fabricData = await prisma.style_fabrics.findMany({
      where: {
        style_components: { styleId: style.id }
      },
      include: {
        style_components: { select: { componentName: true }}
      }
    });

    console.log('=== FABRIC DATA ===');
    console.log(`Fabric entries: ${fabricData.length}\n`);

    if (fabricData.length === 0) {
      console.log('⚠️  No fabric data found\n');
    } else {
      fabricData.forEach((fabric, i) => {
        console.log(`Fabric ${i + 1} (${fabric.style_components.componentName}):`);
        console.log(`  Generic Name: ${fabric.genericGreigeName}`);
        console.log(`  Cutable Width: ${fabric.cutableWidth || 'NOT SET'} inches`);
        console.log(`  CAD Average (deprecated): ${fabric.cadAverageMeters || 'NOT SET'}`);
        console.log(`  Quantity Needed: ${fabric.quantityNeeded || 'NOT SET'}`);
        console.log(`  Unit Price: ${fabric.unitPrice || 'NOT SET'}\n`);
      });
    }

    // 4. Check fabric_width_cad (approved costing)
    const cadData = await prisma.fabric_width_cad.findMany({
      where: { costingStyleId: style.id, approvalStatus: 'APPROVED' },
      select: {
        id: true,
        cutableWidth: true,
        cadAverage: true,
        totalCostPerMeter: true,
        purpose: true,
        createdAt: true
      }
    });

    console.log('=== APPROVED FABRIC COSTING ===');
    if (cadData.length > 0) {
      console.log(`✓ Found ${cadData.length} approved costing entries:\n`);
      cadData.forEach((cad, i) => {
        console.log(`Costing ${i + 1}:`);
        console.log(`  Purpose: ${cad.purpose}`);
        console.log(`  Cutable Width: ${cad.cutableWidth} inches`);
        console.log(`  CAD Average: ${cad.cadAverage} meters`);
        console.log(`  Total Cost/meter: ₹${cad.totalCostPerMeter}\n`);
      });
    } else {
      console.log('⚠️  No approved fabric costing found');
      console.log('Cost sheet will show ₹0.00 for fabric costs.\n');
    }

    // 5. If preset exists, show what it contains
    if (style.customerAccessoriesPresetId) {
      const preset = await prisma.customer_accessories_presets.findUnique({
        where: { id: style.customerAccessoriesPresetId },
        include: {
          items: {
            include: {
              label: { select: { labelCode: true, labelName: true }},
              material: { select: { code: true, name: true }}
            }
          }
        }
      });

      if (preset) {
        console.log('=== CUSTOMER ACCESSORY PRESET ===');
        console.log(`Preset Name: ${preset.presetName}`);
        console.log(`Total items: ${preset.items.length}\n`);

        const presetLabels = preset.items.filter(i => i.materialType === 'LABEL');
        const presetPackaging = preset.items.filter(i => i.materialType === 'PACKAGING');

        console.log(`LABEL items in preset: ${presetLabels.length}`);
        console.log(`PACKAGING items in preset: ${presetPackaging.length}\n`);

        if (presetLabels.length > 0) {
          console.log('--- PRESET LABEL ITEMS ---');
          presetLabels.forEach((item, i) => {
            console.log(`\nPreset Label ${i + 1}:`);
            console.log(`  Label: ${item.label?.labelCode} - ${item.label?.labelName}`);
            console.log(`  Material Type: ${item.materialType}`);
            console.log(`  Has labelId: ${item.labelId ? 'YES' : 'NO'}`);
          });
          console.log('');
        }

        if (presetPackaging.length > 0) {
          console.log('--- PRESET PACKAGING ITEMS ---');
          presetPackaging.forEach((item, i) => {
            console.log(`\nPreset Packaging ${i + 1}:`);
            console.log(`  Packaging: ${item.material?.code} - ${item.material?.name}`);
            console.log(`  Material Type: ${item.materialType}`);
            console.log(`  Has materialId: ${item.materialId ? 'YES' : 'NO'}`);
          });
          console.log('');
        }
      }
    }

  } catch (e) {
    console.error('❌ ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkLNG204P();
