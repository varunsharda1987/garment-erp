const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Setup supplier pricing for accessories used in style LNG204P
 *
 * This script demonstrates the multi-vendor pricing system by:
 * 1. Creating a default supplier if needed
 * 2. Setting up supplier pricing via junction tables
 * 3. Marking preferred suppliers for costing
 */

async function setupAccessoryPricing() {
  try {
    console.log('\n=== SETTING UP ACCESSORY PRICING ===\n');

    // Step 1: Get existing supplier (we'll use master pricing for now)
    const supplier = await prisma.suppliers.findFirst({
      where: { isActive: true }
    });

    if (supplier) {
      console.log(`✓ Found supplier for junction setup: ${supplier.code} - ${supplier.name}\n`);
    } else {
      console.log('⚠️  No suppliers found - will use master pricing only\n');
    }

    // Step 2: Get all accessories from style LNG204P
    const style = await prisma.styles.findFirst({
      where: { styleCode: 'LNG204P' },
      select: { id: true }
    });

    if (!style) {
      console.log('❌ Style LNG204P not found');
      await prisma.$disconnect();
      return;
    }

    const materialBom = await prisma.style_material_bom.findMany({
      where: {
        styleId: style.id,
        OR: [
          { materialType: 'LABEL' },
          { materialType: 'PACKAGING' }
        ]
      },
      select: {
        materialType: true,
        componentName: true,
        labelId: true,
        packagingId: true
      }
    });

    console.log(`Found ${materialBom.length} accessories to price\n`);

    // Step 3: Sample pricing data (you would typically get this from your supplier)
    const pricingData = {
      'LBL-0015': { name: 'Price Tag', price: 0.50 },           // ₹0.50 per piece
      'LBL-0014': { name: 'Washcare Label', price: 1.20 },      // ₹1.20 per piece
      'LBL-0013': { name: 'Size Label', price: 0.80 },          // ₹0.80 per piece
      'LBL-0012': { name: 'Main Label', price: 1.50 },          // ₹1.50 per piece
      'PKG-0001': { name: 'Poly Bag', price: 2.50 }             // ₹2.50 per piece
    };

    let updated = 0;
    let created = 0;

    // Step 4: Process each accessory
    for (const bom of materialBom) {
      if (bom.materialType === 'LABEL' && bom.labelId) {
        // Get label details
        const label = await prisma.label_master.findUnique({
          where: { id: bom.labelId },
          select: { id: true, labelCode: true, labelName: true, pricePerPiece: true }
        });

        if (!label) continue;

        const pricing = pricingData[label.labelCode];
        if (!pricing) continue;

        console.log(`--- ${label.labelCode}: ${label.labelName} ---`);

        // Option A: Update master table price (reference price)
        if (!label.pricePerPiece || label.pricePerPiece === 0) {
          await prisma.label_master.update({
            where: { id: label.id },
            data: { pricePerPiece: pricing.price }
          });
          console.log(`✓ Set master price: ₹${pricing.price}/piece`);
          updated++;
        } else {
          console.log(`  Master price already set: ₹${label.pricePerPiece}/piece`);
        }

        // Option B: Create supplier junction record (multi-vendor support)
        if (supplier) {
          const existingSupplierLink = await prisma.label_suppliers.findFirst({
            where: {
              labelId: label.id,
              supplierId: supplier.id
            }
          });

          if (!existingSupplierLink) {
            await prisma.label_suppliers.create({
              data: {
                labelId: label.id,
                supplierId: supplier.id,
                pricePerPiece: pricing.price,
                pricePerHundred: pricing.price * 100,
                isPreferred: true,  // Mark as preferred supplier for costing
                isActive: true,
                moq: 100,           // Minimum order quantity
                leadTimeDays: 7     // Lead time in days
              }
            });
            console.log(`✓ Created supplier link: ₹${pricing.price}/piece (PREFERRED)`);
            created++;
          } else {
            console.log(`  Supplier link already exists`);
          }
        }

      } else if (bom.materialType === 'PACKAGING' && bom.packagingId) {
        // Get packaging details
        const packaging = await prisma.packaging_master.findUnique({
          where: { id: bom.packagingId },
          select: { id: true, packagingCode: true, packagingName: true, pricePerPiece: true }
        });

        if (!packaging) continue;

        const pricing = pricingData[packaging.packagingCode];
        if (!pricing) continue;

        console.log(`--- ${packaging.packagingCode}: ${packaging.packagingName} ---`);

        // Option A: Update master table price
        if (!packaging.pricePerPiece || packaging.pricePerPiece === 0) {
          await prisma.packaging_master.update({
            where: { id: packaging.id },
            data: { pricePerPiece: pricing.price }
          });
          console.log(`✓ Set master price: ₹${pricing.price}/piece`);
          updated++;
        } else {
          console.log(`  Master price already set: ₹${packaging.pricePerPiece}/piece`);
        }

        // Option B: Create supplier junction record
        if (supplier) {
          const existingSupplierLink = await prisma.packaging_suppliers.findFirst({
            where: {
              packagingId: packaging.id,
              supplierId: supplier.id
            }
          });

          if (!existingSupplierLink) {
            await prisma.packaging_suppliers.create({
              data: {
                packagingId: packaging.id,
                supplierId: supplier.id,
                pricePerPiece: pricing.price,
                isPreferred: true,  // Mark as preferred supplier
                isActive: true,
                moq: 500,           // Minimum order quantity
                leadTimeDays: 5
              }
            });
            console.log(`✓ Created supplier link: ₹${pricing.price}/piece (PREFERRED)`);
            created++;
          } else {
            console.log(`  Supplier link already exists`);
          }
        }
      }

      console.log('');
    }

    // Step 5: Summary
    console.log('=== SUMMARY ===');
    console.log(`Master prices updated: ${updated}`);
    console.log(`Supplier links created: ${created}`);
    console.log(`\n✓ Pricing setup complete!`);
    console.log(`\nNow create a cost sheet for LNG204P to see the prices populate.`);

  } catch (e) {
    console.error('❌ ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

setupAccessoryPricing();
